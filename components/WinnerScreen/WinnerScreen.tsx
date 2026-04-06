// components/WinnerScreen/WinnerScreen.tsx
'use client';
import { useGame } from '@/context/GameContext';
import { calcGameStats } from '@/lib/game';
import { Avatar } from '../PlayerManager/PlayerManager';

export function WinnerScreen() {
  const { activeSession, sessionPlayers, players, finishGame } = useGame();
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

      <div className="flex flex-col items-center gap-6 text-center px-8 relative z-10">
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

        <div className="text-[36px] font-black text-yellow-400 tabular-nums">
          {stats.payouts[0]?.toLocaleString('ru')} RSD
        </div>

        {runnerUps.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {runnerUps.map(sp => {
              const p = players.find(pl => pl.id === sp.playerId);
              const payout = stats.payouts[(sp.finishPosition ?? 2) - 1];
              if (!p || !payout) return null;
              return (
                <div key={sp.id} className="text-[#666] text-[14px]">
                  {sp.finishPosition}-е место: {p.name} — {payout.toLocaleString('ru')} RSD
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
