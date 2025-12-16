import React from 'react';

export default function Bracket({ bracket }) {
    if (!bracket || !bracket.rounds) return null;

    return (
        <div className="overflow-x-auto py-6 px-2 flex gap-6 justify-start">
            {bracket.rounds.map((round, rIndex) => (
                <div key={rIndex} className="flex flex-col gap-6 min-w-[180px]">
                    <h3 className="text-center text-slate-400 mb-2 font-semibold">Round {rIndex + 1}</h3>
                    {round.map((match, mIndex) => (
                        <div key={mIndex} className="flex flex-col items-center bg-slate-800 p-2 rounded-lg border border-slate-700">
                            {['a', 'b'].map((side) => {
                                const contestant = match[side];
                                if (!contestant) return null;
                                const imageUrl = `https://source.unsplash.com/100x100/?${encodeURIComponent(contestant.text)}`;
                                const winner = match.winner === side;
                                return (
                                    <div key={side} className={`flex flex-col items-center mb-2 ${winner ? 'bg-emerald-600/30 rounded-lg p-1' : ''}`}>
                                        <img src={imageUrl} alt={contestant.text} className="w-20 h-20 rounded object-cover mb-1" />
                                        <span className={`text-white font-bold text-center ${winner ? 'text-yellow-400' : ''}`}>{contestant.text}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
