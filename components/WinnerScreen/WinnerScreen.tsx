// components/WinnerScreen/WinnerScreen.tsx
'use client';
import { useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useTimer } from '@/context/TimerContext';
import { calcGameStats } from '@/lib/game';
import { Avatar } from '../PlayerManager/PlayerManager';
import { getWinnerImageUrl } from '@/lib/supabase/winnerImage';
import { playWinnerFanfare } from '@/lib/audio';

type Props = {
  onFinishGame?: () => void | Promise<void>;
};

export function WinnerScreen({ onFinishGame }: Props) {
  const { activeSession, sessionPlayers, players, finishGame } = useGame();
  const { state: timerState, dispatch: timerDispatch } = useTimer();
  const [winnerImageUrl, setWinnerImageUrl] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);

  const handleFinishGame = async () => {
    if (onFinishGame) {
      await onFinishGame();
      return;
    }

    if (!timerState.isPaused) {
      timerDispatch({ type: 'TOGGLE_PAUSE' });
    }
    await finishGame();
    timerDispatch({ type: 'OPEN_SETTINGS' });
  };

  const winner = sessionPlayers.find(sp => sp.status === 'winner');
  const winnerPlayer = winner ? players.find(p => p.id === winner.playerId) : null;

  useEffect(() => {
    const fanfare = playWinnerFanfare();
    const stopFanfareTimer = setTimeout(() => fanfare.stop(), 30000);

    if (winnerPlayer) {
      getWinnerImageUrl(winnerPlayer.id).then(url => setWinnerImageUrl(url));
    }

    return () => {
      clearTimeout(stopFanfareTimer);
      fanfare.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnerPlayer?.id]);

  if (!activeSession) return null;

  const stats = calcGameStats(activeSession, sessionPlayers);
  const runnerUps = sessionPlayers
    .filter(sp => sp.status === 'eliminated' && (sp.finishPosition ?? 99) <= activeSession.prizeSpots)
    .sort((a, b) => (a.finishPosition ?? 99) - (b.finishPosition ?? 99));

  /* ── Fullscreen image mode ── */
  if (winnerImageUrl) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-black">
        <ConfettiLayer />

        {/* Background image — full screen */}
        <img
          src={winnerImageUrl}
          alt="Победитель"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: imageReady ? 1 : 0, transition: 'opacity 0.6s ease' }}
          onLoad={() => setImageReady(true)}
        />

        {/* Dark gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black via-black/80 to-transparent" />

        {/* Content — anchored to bottom */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4 pb-10 px-8 text-center">

          {/* Winner name + title */}
          {winnerPlayer && (
            <div>
              <div className="text-[13px] text-violet-400 tracking-[5px] uppercase font-semibold mb-1">
                Победитель
              </div>
              <h1 className="text-[42px] font-black text-white uppercase tracking-[2px] leading-tight drop-shadow-lg">
                {winnerPlayer.name}
              </h1>
            </div>
          )}

          {/* Payout */}
          <div className="text-[38px] font-black text-yellow-400 tabular-nums drop-shadow-lg">
            {stats.payouts[0]?.toLocaleString('ru')} RSD
          </div>

          {/* Runner-ups */}
          {runnerUps.length > 0 && (
            <div className="flex flex-col gap-1">
              {runnerUps.map(sp => {
                const p = players.find(pl => pl.id === sp.playerId);
                const payout = stats.payouts[(sp.finishPosition ?? 2) - 1];
                if (!p || !payout) return null;
                return (
                  <div key={sp.id} className="flex items-center gap-2 justify-center">
                    <Avatar player={p} size={24} />
                    <span className="text-[#888] text-[13px]">
                      {sp.finishPosition}-е место: {p.name} — {payout.toLocaleString('ru')} RSD
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={handleFinishGame}
            className="mt-2 bg-black/40 border border-white/20 text-white/60 rounded-xl px-8 py-3 text-[14px] cursor-pointer hover:border-white/40 hover:text-white/90 transition-colors backdrop-blur-sm"
          >
            Завершить игру
          </button>
        </div>
      </div>
    );
  }

  /* ── Default mode (no image) ── */
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0d0d0d] overflow-hidden">
      <ConfettiLayer />

      <div className="flex flex-col items-center gap-6 text-center px-8 relative z-10 w-full max-w-[480px]">
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
          <div className="flex flex-col gap-2">
            {runnerUps.map(sp => {
              const p = players.find(pl => pl.id === sp.playerId);
              const payout = stats.payouts[(sp.finishPosition ?? 2) - 1];
              if (!p || !payout) return null;
              return (
                <div key={sp.id} className="flex items-center gap-3 justify-center">
                  <Avatar player={p} size={28} />
                  <span className="text-[#666] text-[14px]">
                    {sp.finishPosition}-е место: {p.name} — {payout.toLocaleString('ru')} RSD
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={handleFinishGame}
          className="mt-2 bg-[#1e1e1e] border border-[#333] text-[#888] rounded-xl px-8 py-3 text-[15px] cursor-pointer hover:border-[#555] hover:text-[#ccc] transition-colors"
        >
          Завершить игру
        </button>
      </div>
    </div>
  );
}

function ConfettiLayer() {
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  const colors = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#db2777'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
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
