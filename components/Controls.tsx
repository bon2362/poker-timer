type Props = {
  isPaused: boolean;
  isOver: boolean;
  visible: boolean;
  onPrev: () => void;
  onTogglePause: () => void;
  onNext: () => void;
};

export function Controls({ isPaused, isOver, visible, onPrev, onTogglePause, onNext }: Props) {
  return (
    <div className={`pb-4 flex flex-col items-center gap-3 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <button
        className="bg-violet-700 border-none text-white rounded-xl w-16 h-14 text-[22px] flex items-center justify-center cursor-pointer hover:bg-violet-800 transition-colors"
        onClick={onTogglePause}
        disabled={isOver}
      >
        {isPaused ? '▶' : '⏸'}
      </button>
      <div className="flex gap-4">
        <button
          className="bg-transparent border border-[#333] text-[#666] rounded-lg w-10 h-8 text-[13px] flex items-center justify-center cursor-pointer hover:border-[#555] hover:text-[#999] transition-colors"
          onClick={onPrev}
          title="Previous level"
        >
          ⏪
        </button>
        <button
          className="bg-transparent border border-[#333] text-[#666] rounded-lg w-10 h-8 text-[13px] flex items-center justify-center cursor-pointer hover:border-[#555] hover:text-[#999] transition-colors"
          onClick={onNext}
          title="Next level"
        >
          ⏩
        </button>
      </div>
    </div>
  );
}
