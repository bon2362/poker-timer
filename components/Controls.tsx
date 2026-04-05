type Props = {
  isPaused: boolean;
  isOver: boolean;
  onPrev: () => void;
  onTogglePause: () => void;
  onNext: () => void;
};

const btnBase = 'bg-violet-700 border-none text-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-violet-800 transition-colors';

export function Controls({ isPaused, isOver, onPrev, onTogglePause, onNext }: Props) {
  return (
    <div className="px-7 pb-[18px] flex justify-center">
      <div className="flex gap-[10px] items-center">
        <button
          className={`${btnBase} w-11 h-[38px] text-[15px]`}
          onClick={onPrev}
          title="Previous level"
        >
          ⏪
        </button>
        <button
          className={`${btnBase} w-[52px] h-[42px] text-[18px]`}
          onClick={onTogglePause}
          disabled={isOver}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
        <button
          className={`${btnBase} w-11 h-[38px] text-[15px]`}
          onClick={onNext}
          title="Next level"
        >
          ⏩
        </button>
      </div>
    </div>
  );
}
