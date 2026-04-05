type Props = {
  isPaused: boolean;
  isOver: boolean;
  onPrev: () => void;
  onTogglePause: () => void;
  onNext: () => void;
  onJumpToEnd: () => void;
};

const btnBase = 'bg-violet-700 border-none text-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-violet-800 transition-colors';

export function Controls({ isPaused, isOver, onPrev, onTogglePause, onNext, onJumpToEnd }: Props) {
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
        <button
          className="bg-[#2a2a2a] border-none text-[#666] rounded-lg w-[52px] h-[38px] text-[12px] font-bold cursor-pointer hover:text-[#999] hover:bg-[#333]"
          onClick={onJumpToEnd}
          title="Jump to 1:05"
        >
          1:05
        </button>
      </div>
    </div>
  );
}
