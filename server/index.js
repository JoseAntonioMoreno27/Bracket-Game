const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- GAME STATE (In-Memory) ---
const rooms = {};

const generateCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

// Helper to build rounds from winner list
const buildRounds = (items) => {
    const rounds = [];
    let current = [...items];
    while (current.length > 0) {
        const round = [];
        while (current.length >= 2) {
            round.push({ a: current.pop(), b: current.pop() });
        }
        if (current.length === 1) {
            round.push({ a: current.pop() }); // bye
            current = [];
        }
        rounds.push(round);
        // Prepare next round: winners placeholder
        current = round.map(match => match.winner ? match[match.winner] : match.a);
    }
    return rounds;
};

io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('create_room', ({ username, category }) => {
        const code = generateCode();
        const categoryImage = `https://source.unsplash.com/200x200/?${encodeURIComponent(category)}`;

        rooms[code] = {
            code,
            host: socket.id,
            category: category || "General",
            categoryImage,
            players: [{ id: socket.id, username, score: 0 }],
            state: 'LOBBY',
            submissions: [],
            bracket: [],
            round2: [],
            currentMatchup: null,
            votes: {},
            winner: null
        };

        currentRoom = code;
        socket.join(code);
        socket.emit('room_created', { code, playerId: socket.id, categoryImage });
        io.to(code).emit('update_state', rooms[code]);
    });

    socket.on('join_room', ({ code, username }) => {
        const room = rooms[code];
        if (room && room.state === 'LOBBY') {
            currentRoom = code;
            room.players.push({ id: socket.id, username, score: 0 });
            socket.join(code);
            socket.emit('joined_room', { code, playerId: socket.id, categoryImage: room.categoryImage });
            io.to(code).emit('update_state', room);
        } else {
            socket.emit('error', 'Room not found or game started');
        }
    });

    socket.on('start_submissions', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        if (socket.id === room.host) {
            room.state = 'SUBMITTING';
            io.to(currentRoom).emit('update_state', room);
        }
    });

    socket.on('submit_entry', ({ entry }) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        if (room.state === 'SUBMITTING') {
            const imageUrl = `https://source.unsplash.com/100x100/?${encodeURIComponent(entry)}`;
            room.submissions.push({ id: socket.id, text: entry, image: imageUrl });
            io.to(currentRoom).emit('update_state', room);
        }
    });

    socket.on('start_bracket', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        if (socket.id !== room.host || room.submissions.length < 2) return;

        // Shuffle submissions
        let items = [...room.submissions];
        items.sort(() => Math.random() - 0.5);

        // Create initial bracket
        const bracket = [];
        while (items.length >= 2) {
            bracket.push({ a: items.pop(), b: items.pop() });
        }
        if (items.length === 1) room.round2.push(items[0]); // bye to next round

        room.bracket = bracket;
        room.round2 = room.round2 || [];
        room.state = 'VOTING';
        room.currentMatchup = room.bracket.shift();
        room.votes = {};

        io.to(currentRoom).emit('update_state', room);
    });

    socket.on('vote', ({ choice }) => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        if (room.state !== 'VOTING') return;

        room.votes[socket.id] = choice;
        io.to(currentRoom).emit('update_state', room);
    });

    socket.on('end_vote', () => {
        if (!currentRoom || !rooms[currentRoom]) return;
        const room = rooms[currentRoom];
        if (socket.id !== room.host) return;

        // Determine winner
        let countA = 0;
        let countB = 0;
        Object.values(room.votes).forEach(v => v === 'a' ? countA++ : countB++);

        const winner = countA >= countB ? room.currentMatchup.a : room.currentMatchup.b;
        room.round2.push(winner);

        room.votes = {};

        if (room.bracket.length > 0) {
            room.currentMatchup = room.bracket.shift();
        } else {
            // Round over
            if (room.round2.length === 1) {
                room.state = 'WINNER';
                room.winner = room.round2[0];

                db.run(
                    'INSERT INTO winners (room_code, winner_name) VALUES (?, ?)',
                    [room.code, room.winner.text],
                    (err) => { if (err) console.error(err); }
                );
            } else {
                // Next round bracket
                let items = [...room.round2];
                room.round2 = [];
                const newBracket = [];
                while (items.length >= 2) {
                    newBracket.push({ a: items.pop(), b: items.pop() });
                }
                if (items.length === 1) room.round2.push(items[0]); // bye
                room.bracket = newBracket;
                room.currentMatchup = room.bracket.shift();
            }
        }
        io.to(currentRoom).emit('update_state', room);
    });

    socket.on('disconnect', () => {
        // Optional: remove player from room
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
