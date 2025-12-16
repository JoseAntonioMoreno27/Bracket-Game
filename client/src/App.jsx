import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socketUrl = import.meta.env.PROD ? '/' : 'http://localhost:3000';
const socket = io(socketUrl);

function App() {
    const [view, setView] = useState('HOME'); // HOME, GAME
    const [username, setUsername] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [category, setCategory] = useState(''); // New category input
    const [gameState, setGameState] = useState(null);
    const [myId, setMyId] = useState(null);
    const [inputEntry, setInputEntry] = useState('');

    // Fetch image from Unsplash
    const fetchImage = async (query) => {
        try {
            const res = await fetch(`https://source.unsplash.com/200x200/?${query}`);
            return res.url;
        } catch (err) {
            console.error(err);
            return null;
        }
    };

    useEffect(() => {
        socket.on('room_created', async ({ code, playerId, cat }) => {
            const catImage = await fetchImage(cat);
            setRoomCode(code);
            setMyId(playerId);
            socket.emit('set_category_image', { image: catImage });
            setView('GAME');
        });

        socket.on('joined_room', ({ code, playerId }) => {
            setRoomCode(code);
            setMyId(playerId);
            setView('GAME');
        });

        socket.on('update_state', (state) => {
            setGameState(state);
        });

        return () => socket.off();
    }, []);

    const createRoom = () => {
        if (!username || !category) return alert('Enter your name and category');
        socket.emit('create_room', { username, category });
    };

    const joinRoom = () => {
        if (!username || !roomCode) return alert('Enter details');
        socket.emit('join_room', { code: roomCode.toUpperCase(), username });
    };

    const startGame = () => socket.emit('start_submissions');

    const submitEntry = async () => {
        if (!inputEntry) return;
        const image = await fetchImage(inputEntry); // fetch contestant image
        socket.emit('submit_entry', { entry: inputEntry, image });
        setInputEntry('');
    };

    const startBracket = () => socket.emit('start_bracket');
    const vote = (choice) => socket.emit('vote', { choice });
    const endVote = () => socket.emit('end_vote');

    const isHost = gameState?.host === myId;

    const Bracket = ({ bracket, votes }) => (
        <div className="flex flex-col items-center space-y-6 w-full">
            {bracket.map((match, i) => (
                <div key={i} className="flex justify-between items-center w-full max-w-md bg-slate-700 p-3 rounded-lg shadow-md">
                    <div className={`flex-1 p-2 rounded ${votes[myId] === 'a' ? 'bg-blue-500' : 'bg-slate-800'}`}>
                        <div className="text-center font-bold">{match.a.text}</div>
                        {match.a.image && <img src={match.a.image} alt={match.a.text} className="mt-1 mx-auto w-16 h-16 object-cover rounded-full" />}
                    </div>
                    <div className="text-center font-bold mx-4 text-slate-400">VS</div>
                    <div className={`flex-1 p-2 rounded ${votes[myId] === 'b' ? 'bg-red-500' : 'bg-slate-800'}`}>
                        <div className="text-center font-bold">{match.b.text}</div>
                        {match.b.image && <img src={match.b.image} alt={match.b.text} className="mt-1 mx-auto w-16 h-16 object-cover rounded-full" />}
                    </div>
                </div>
            ))}
        </div>
    );

    if (view === 'HOME') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-800 p-4 text-white space-y-8">
                <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-pink-500">
                    The Tourney Game
                </h1>
                <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md flex flex-col space-y-4">
                    <input
                        className="p-3 rounded-lg bg-slate-700 placeholder-gray-400 text-white"
                        placeholder="Your Username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        className="p-3 rounded-lg bg-slate-700 placeholder-gray-400 text-white"
                        placeholder="Category (e.g. Desserts)"
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                    />
                    <div className="flex flex-col space-y-2">
                        <button onClick={createRoom} className="w-full py-3 rounded-xl bg-gradient-to-r from-green-400 to-emerald-600 hover:from-emerald-600 hover:to-green-400 font-bold transition-all">
                            Create Room
                        </button>
                        <div className="flex gap-2">
                            <input
                                className="flex-1 p-2 rounded-lg bg-slate-700 placeholder-gray-400 text-white uppercase"
                                placeholder="Room Code"
                                value={roomCode}
                                onChange={e => setRoomCode(e.target.value)}
                            />
                            <button onClick={joinRoom} className="px-4 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">
                                Join
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!gameState) return <div className="p-10 text-center text-white">Loading...</div>;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 to-blue-800 p-4 text-white space-y-8">
            <header className="flex justify-between items-center w-full max-w-lg mb-6">
                <div className="text-sm text-slate-300">Code: <span className="text-white font-mono text-lg font-bold">{gameState.code}</span></div>
                <div className="text-sm">Players: {gameState.players.length}</div>
            </header>

            {gameState.state === 'LOBBY' && (
                <div className="flex flex-col items-center space-y-4">
                    <h2 className="text-2xl font-bold">Waiting for players...</h2>
                    <ul className="bg-slate-800 rounded-xl p-4 w-80 space-y-2 shadow-md">
                        {gameState.players.map(p => <li key={p.id} className="py-1 text-center">{p.username}</li>)}
                    </ul>
                    {isHost && (
                        <button onClick={startGame} className="mt-4 w-60 py-3 rounded-xl bg-green-500 hover:bg-green-400 font-bold animate-pulse">
                            Start Game
                        </button>
                    )}
                </div>
            )}

            {gameState.state === 'SUBMITTING' && (
                <div className="flex flex-col items-center space-y-4 w-full max-w-md">
                    <h2 className="text-xl text-center font-semibold">Submit Contestants!</h2>
                    <div className="flex gap-2 w-full">
                        <input
                            className="flex-1 p-2 rounded-lg bg-slate-700 placeholder-gray-400 text-white"
                            placeholder="Contestant Name"
                            value={inputEntry}
                            onChange={e => setInputEntry(e.target.value)}
                        />
                        <button onClick={submitEntry} className="px-4 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold">Add</button>
                    </div>
                    <div className="bg-slate-800 p-4 rounded-xl min-h-[200px] w-full space-y-2 shadow-inner overflow-auto">
                        {gameState.submissions.map((s, i) => (
                            <div key={i} className="bg-slate-700 p-2 rounded flex items-center justify-between">
                                <div>{s.text}</div>
                                {s.image && <img src={s.image} alt={s.text} className="w-10 h-10 rounded-full ml-2 object-cover" />}
                            </div>
                        ))}
                    </div>
                    {isHost && gameState.submissions.length >= 2 && (
                        <button onClick={startBracket} className="mt-4 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold">
                            Generate Bracket
                        </button>
                    )}
                </div>
            )}

            {gameState.state === 'VOTING' && gameState.currentMatchup && (
                <div className="flex flex-col items-center space-y-6 w-full max-w-md">
                    <h2 className="text-center text-slate-300 uppercase tracking-widest text-sm">Vote Now</h2>
                    <Bracket bracket={[gameState.currentMatchup]} votes={gameState.votes} />
                    {isHost && (
                        <button onClick={endVote} className="mt-6 w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold">
                            End Vote & Next
                        </button>
                    )}
                    <div className="text-sm text-slate-400">Votes cast: {Object.keys(gameState.votes).length}</div>
                </div>
            )}

            {gameState.state === 'WINNER' && (
                <div className="flex flex-col items-center justify-center space-y-6">
                    <div className="text-6xl">🏆</div>
                    <h2 className="text-4xl font-bold text-yellow-400">{gameState.winner.text}</h2>
                    <p className="text-slate-400">is the champion!</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold">
                        Back to Home
                    </button>
                </div>
            )}
        </div>
    );
}

export default App;
