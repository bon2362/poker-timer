import type { Stage } from '@/types/timer';

type Props = {
  stage: Stage;
  stages: Stage[];
  currentStage: number;
  breakDuration: number;
};

export function BlindInfo({ stage, stages, currentStage, breakDuration }: Props) {
  const next = stages[currentStage + 1];

  let nextText = '';
  if (!next) {
    nextText = 'Tournament finale';
  } else if (next.type === 'break') {
    const afterBreak = stages[currentStage + 2];
    const afterStr = afterBreak && afterBreak.type === 'level'
      ? ` \u2192 then ${afterBreak.sb} / ${afterBreak.bb}`
      : '';
    nextText = `\u2615 Break ${breakDuration} min${afterStr}`;
  } else if (next.type === 'level') {
    nextText = `${next.sb} / ${next.bb}`;
  }

  if (stage.type === 'level') {
    return (
      <div className="flex-1 text-center">
        <div className="text-[13px] text-[#888] tracking-[2px] uppercase mb-1">
          Round {stage.levelNum}
        </div>
        <div className="text-[46px] font-bold leading-tight">
          {stage.sb} / {stage.bb}
        </div>
        <div className="text-[14px] text-[#666] mt-1 tracking-[0.5px]">
          <strong className="text-[#888]">Next:</strong> {nextText}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-center">
      <div className="text-[13px] text-[#888] tracking-[2px] uppercase mb-1">
        ☕ Break
      </div>
      <div className="text-[46px] font-bold leading-tight text-blue-400">
        {breakDuration} min
      </div>
      <div className="text-[14px] text-[#666] mt-1 tracking-[0.5px]">
        <strong className="text-[#888]">Next:</strong> {nextText}
      </div>
    </div>
  );
}
