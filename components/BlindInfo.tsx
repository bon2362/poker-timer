import type { Stage } from '@/types/timer';

type Props = {
  stage: Stage;
  breakDuration: number;
};

export function BlindInfo({ stage, breakDuration }: Props) {
  if (stage.type === 'level') {
    return (
      <div className="flex-1 text-center">
        <div className="text-[13px] text-[#888] tracking-[2px] uppercase mb-1">
          Round {stage.levelNum}
        </div>
        <div className="font-bold leading-tight" style={{ fontSize: 'clamp(72px, 10vw, 120px)' }}>
          {stage.sb} / {stage.bb}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-center">
      <div className="text-[13px] text-[#888] tracking-[2px] uppercase mb-1">
        ☕ Break
      </div>
      <div className="font-bold leading-tight text-blue-400" style={{ fontSize: 'clamp(72px, 10vw, 120px)' }}>
        {breakDuration} min
      </div>
    </div>
  );
}
