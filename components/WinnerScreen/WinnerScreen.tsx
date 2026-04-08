// components/WinnerScreen/WinnerScreen.tsx
'use client';
import { useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { calcGameStats } from '@/lib/game';
import { Avatar } from '../PlayerManager/PlayerManager';
import { getWinnerImageUrl } from '@/lib/supabase/winnerImage';
import { playWinnerFanfare } from '@/lib/audio';

export function WinnerScreen() {
  const { activeSession, sessionPlayers, players, finishGame } = useGame();
  const [winnerImageUrl, setWinnerImageUrl] = useState<string | null>(null);

  useEffect(() => {
    playWinnerFanfare();
    getWinnerImageUrl().then(url => setWinnerImageUrl(url));
  }, []);

  if (!activeSession) return null;

  const winner = sessionPlayers.find(sp => sp.status === 'winner');
  const winnerPlayer = winner ? players.find(p => p.id === winner.playerId) : null;
  const stats = calcGameStats(activeSession, sessionPlayers);

  const runnerUps = sessionPlayers
    .filter(sp => sp.status === 'eliminated' && (sp.finishPosition ?? 99) <= activeSession.prizeSpots)
    .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99));

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0d0d] overflow-hidden">
      {/* CSS confetti */}
      <ConfettiLayer />

      <div className="flex flex-col items-center gap-6 text-center px-8 relative z-10 w-full max-w-[640px]">

        {/* Winner image (16:9) or avatar */}
        {winnerImageUrl ? (
          <div className="w-full relative rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: '16/9' }}>
            <img
              src={winnerImageUrl}
              alt="Победитель"
              className="w-full h-full object-cover"
            />
            {/* Name overlay */}
            {winnerPlayer && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-6 py-4">
                <div className="text-[28px] font-black text-white uppercase tracking-[2px]">
                  {winnerPlayer.name}
                </div>
                <div className="text-[13px] text-violet-400 tracking-[4px] uppercase font-semibold">
                  Победитель
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="text-[48px]">🏆</div>
            {winnerPlayer && (
              <div className="flex flex-col items-center gap-3">
                <Avatar player={winnerPlayer} size={160} />
                <h1 className="text-[32px] font-black text-white uppercase tracking-[2px]">
                  {winnerPlayer.name}
                </h1>
                <div className="text-[16px] text-violet-400 tracking-[4px] uppercase font-semibold">
                  Победитель
                </div>
              </div>
            )}
          </>
        )}

        {/* Payout */}
        <div className="text-[36px] font-black text-yellow-400 tabular-nums">
          {stats.payouts[0]?.toLocaleString('ru')} RSD
        </div>

        {/* Runner-ups with avatars */}
        {runnerUps.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            {runnerUps.map(sp => {
              const p = players.find(pl => pl.id === sp.playerId);
              const payout = stats.payouts[(sp.finishPosition ?? 2) - 1];
              if (!p || !payout) return null;
              return (
                <div key={sp.id} className="flex items-center gap-3 justify-center">
                  <Avatar player={p} size={32} />
                  <span className="text-[#666] text-[14px]">
                    {sp.finishPosition}-е место: {p.name} — {payout.toLocaleString('ru')} RSD
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={finishGame}
          className="mt-4 bg-[#1e1e1e] border border-[#333] text-[#888] rounded-xl px-8 py-3 text-[15px] cursor-pointer hover:border-[#555] hover:text-[#ccc] transition-colors"
        >
          Завершить игру
        </button>
      </div>
    </div>
  );
}

function ConfettiLayer() {
  const pieces = Array.from({ length: 24 }, (_, i) => i);
  const colors = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#db2777'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.3; }
        }
      `}</style>
      {pieces.map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '-20px',
            left: `${(i / pieces.length) * 100}%`,
            width: i % 3 === 0 ? '10px' : '8px',
            height: i % 3 === 0 ? '10px' : '16px',
            backgroundColor: colors[i % colors.length],
            borderRadius: i % 2 === 0 ? '50%' : '2px',
            animation: `confetti-fall ${2.5 + (i % 5) * 0.4}s ${(i % 7) * 0.25}s ease-in infinite`,
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
}
