import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Bracket from './Bracket';

const socketUrl = import.meta.env.PROD ? '/' : 'http://localhost:3000';
const socket = io(socketUrl);

function App() {
    const [view, setView] = useState('HOME'); // HOME, GAME
    const [username, setUsername] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [gameState, setGameState] = useState(null);
    const [myId, setMyId] = useState(null);
    const [inputEntry, setInputEntry] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        socket.on('room_created', ({ code, playerId, categoryImage }) => {
            setRoomCode(code);
            setMyId(playerId);
            setView('GAME');
            setGameState(prev => ({ ...prev, categoryImage }));
        });

        socket.on('joined_room', ({ code, playerId, categoryImage }) => {
            setRoomCode(code);
            setMyId(playerId);
            setView('GAME');
            setGameState(prev => ({ ...prev, categoryImage }));
        });

        socket.on('update_state', (state) => {
            setGameState(state);
        });

        socket.on('error', (msg) => alert(msg));

        return () => socket.off();
    }, []);

    const fetchImage = (query) => `https://source.unsplash.com/200x200/?${encodeURIComponent(query)}`;

    const createRoom = () => {
        if (!username || !category) return alert('Enter name and category');
        const categoryImage = fetchImage(category);
        socket.emit('create_room', { username, category });
    };

    const joinRoom = () => {
        if (!username || !roomCode) return alert('Enter details');
        socket.emit('join_room', { code: roomCode, username });
    };

    const startGame = () => socket.emit('start_submissions');

    const submitEntry = () => {
        if (!inputEntry) return;
        const imageUrl = fetchImage(inputEntry);
        socket.emit('submit_entry', { entry: inputEntry, image: imageUrl });
        setInputEntry('');
    };

    const startBracket = () => socket.emit('start_bracket');
    const vote = (choice) => socket.emit('vote', { choice });
    const endVote = () => socket.emit('end_vote');

    // --- RENDERERS ---

    if (view === 'HOME') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-6 bg-gray-900">
                <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
                    The Tourney Game
                </h1>
                <div className="bg-slate-800 p-6 rounded-xl shadow-lg w-full max-w-sm space-y-4 text-center">
                    <input
                        className="w-full bg-slate-700 p-3 rounded text-white"
                        placeholder="Your Username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        className="w-full bg-slate-700 p-3 rounded text-white"
                        placeholder="Category (e.g. Pizza, Movies)"
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                    />
                    <div className="border-t border-slate-700 pt-4 space-y-2">
                        <button onClick={createRoom} className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold">
                            Create Room
                        </button>
                        <div className="flex gap-2 mt-2">
                            <input
                                className="flex-1 bg-slate-700 p-2 rounded text-white uppercase"
                                placeholder="Room Code"
                                value={roomCode}
                                onChange={e => setRoomCode(e.target.value)}
                            />
                            <button onClick={joinRoom} className="bg-emerald-600 hover:bg-emerald-500 px-4 rounded font-bold">
                                Join
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!gameState) return <div className="p-10 text-center text-white">Loading...</div>;

    const isHost = gameState.host === myId;

    return (
        <div className="min-h-screen p-4 max-w-3xl mx-auto flex flex-col items-center bg-gray-900 text-white">
            <header className="flex justify-between items-center mb-6 w-full">
                <div className="text-sm text-slate-400">Code: <span className="text-white font-mono text-xl font-bold">{gameState.code}</span></div>
                <div className="text-sm">Players: {gameState.players.length}</div>
            </header>

            {gameState.categoryImage && (
                <img src={gameState.categoryImage} alt={gameState.category} className="w-40 h-40 object-cover rounded mb-4" />
            )}

            {gameState.state === 'LOBBY' && (
                <div className="text-center space-y-4 w-full flex flex-col items-center">
                    <h2 className="text-2xl font-bold">Waiting for players...</h2>
                    <ul className="bg-slate-800 rounded p-4 w-full max-w-md">
                        {gameState.players.map(p => <li key={p.id} className="py-1">{p.username}</li>)}
                    </ul>
                    {isHost && (
                        <button onClick={startGame} className="w-full bg-blue-600 py-3 rounded-lg font-bold text-lg animate-pulse mt-4">
                            Start Game
                        </button>
                    )}
                </div>
            )}

            {gameState.state === 'SUBMITTING' && (
                <div className="space-y-4 w-full flex flex-col items-center">
                    <h2 className="text-xl text-center">Submit Contestants!</h2>
                    <div className="flex gap-2 w-full max-w-md">
                        <input
                            className="flex-1 bg-slate-700 p-2 rounded text-white"
                            placeholder="E.g. Apple Pie"
                            value={inputEntry}
                            onChange={e => setInputEntry(e.target.value)}
                        />
                        <button onClick={submitEntry} className="bg-blue-500 px-4 rounded">Add</button>
                    </div>
                    <div className="bg-slate-800 p-4 rounded min-h-[200px] w-full max-w-md flex flex-col gap-2">
                        {gameState.submissions.map((s, i) => (
                            <div key={i} className="bg-slate-700 p-2 rounded flex items-center gap-2">
                                {s.image && <img src={s.image} alt={s.text} className="w-12 h-12 object-cover rounded" />}
                                <span>{s.text}</span>
                            </div>
                        ))}
                    </div>
                    {isHost && gameState.submissions.length >= 2 && (
                        <button onClick={startBracket} className="w-full bg-emerald-600 py-3 rounded-lg font-bold mt-4">
                            Generate Bracket
                        </button>
                    )}
                </div>
            )}

            {gameState.state === 'VOTING' && gameState.currentMatchup && (
                <div className="flex flex-col flex-1 justify-center space-y-6 w-full max-w-md items-center">
                    <h2 className="text-center text-slate-400 uppercase tracking-widest text-sm">Vote Now</h2>

                    <button
                        onClick={() => vote('a')}
                        className={`p-6 rounded-xl border-2 transition-all w-full flex justify-center ${gameState.votes[myId] === 'a' ? 'border-blue-500 bg-slate-800' : 'border-slate-700 bg-slate-800/50'}`}
                    >
                        <div className="text-2xl font-bold">{gameState.currentMatchup.a.text}</div>
                        {gameState.currentMatchup.a.image && <img src={gameState.currentMatchup.a.image} alt="" className="w-12 h-12 ml-4 object-cover rounded" />}
                    </button>

                    <div className="text-center font-bold text-slate-500">VS</div>

                    <button
                        onClick={() => vote('b')}
                        className={`p-6 rounded-xl border-2 transition-all w-full flex justify-center ${gameState.votes[myId] === 'b' ? 'border-red-500 bg-slate-800' : 'border-slate-700 bg-slate-800/50'}`}
                    >
                        <div className="text-2xl font-bold">{gameState.currentMatchup.b.text}</div>
                        {gameState.currentMatchup.b.image && <img src={gameState.currentMatchup.b.image} alt="" className="w-12 h-12 ml-4 object-cover rounded" />}
                    </button>

                    {isHost && (
                        <button onClick={endVote} className="w-full bg-slate-700 py-3 rounded text-sm uppercase font-bold tracking-wider mt-8">
                            End Vote & Next
                        </button>
                    )}

                    <div className="text-center text-sm text-slate-500">
                        Votes cast: {Object.keys(gameState.votes).length}
                    </div>
                </div>
            )}

            {(gameState.state === 'BRACKET' || gameState.state === 'WINNER') && (
                <div className="w-full flex flex-col items-center">
                    {gameState.state === 'BRACKET' && gameState.bracket && (
                        <>
                            <h2 className="text-center text-3xl font-bold mb-4">The Tourney Game</h2>
                            <Bracket bracket={gameState.bracket} />
                        </>
                    )}

                    {gameState.state === 'WINNER' && (
                        <div className="text-center flex flex-col items-center justify-center flex-1 space-y-6">
                            <div className="text-6xl">🏆</div>
                            <h2 className="text-4xl font-bold text-yellow-400">{gameState.winner.text}</h2>
                            <p className="text-slate-400">is the champion!</p>
                            <button onClick={() => window.location.reload()} className="bg-slate-700 px-6 py-2 rounded">
                                Back to Home
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default App;
