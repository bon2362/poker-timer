import { formatTime } from '@/lib/timer';
import type { Stage } from '@/types/timer';

type Props = {
  timeLeft: number;
  stage: Stage;
  isPaused: boolean;
};

export function TimerDisplay({ timeLeft, stage, isPaused }: Props) {
  const isBreak    = stage.type === 'break';
  const isOvertime = timeLeft < 0;
  const isWarning  = timeLeft <= 60 && timeLeft >= 0 && !isBreak;

  const timerColor = isOvertime
    ? 'text-red-500'
    : isWarning
    ? 'text-orange-400'
    : isBreak
    ? 'text-blue-400'
    : 'text-white';

  const progressColor = isBreak
    ? 'bg-blue-600'
    : isWarning
    ? 'bg-orange-400'
    : 'bg-violet-700';

  const elapsed = stage.duration - timeLeft;
  const pct = Math.min(100, Math.max(0, (elapsed / stage.duration) * 100));

  return (
    <>
      <div className="flex-1 flex items-center justify-center relative">
        {isPaused && (
          <div
            className="absolute pointer-events-none select-none font-black text-white/[0.18]"
            style={{ fontSize: 'clamp(184px, 36vw, 357px)', letterSpacing: '0.15em' }}
          >
            PAUSE
          </div>
        )}
        <div
          className={`font-black leading-none tabular-nums tracking-[-4px] transition-opacity ${timerColor} ${isPaused ? 'opacity-25' : 'opacity-100'}`}
          style={{ fontSize: 'clamp(140px, 22vw, 240px)' }}
        >
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="pb-[6px]">
        <div className="h-[3px] bg-[#333]">
          <div
            className={`h-full ${progressColor} ${isOvertime ? 'w-full' : 'transition-[width] duration-[900ms]'}`}
            style={isOvertime ? {} : { width: `${pct}%` }}
          />
        </div>
      </div>
    </>
  );
}
