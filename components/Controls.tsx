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
    <div className={`pb-4 flex items-center justify-center gap-8 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <button
        className="bg-transparent border-none text-[#444] text-[22px] cursor-pointer p-2 hover:text-[#777] transition-colors leading-none"
        onClick={onPrev}
        title="Предыдущий уровень"
      >
        {'⏮\uFE0E'}
      </button>
      <button
        className="bg-transparent border-none text-[#666] text-[32px] cursor-pointer p-2 hover:text-[#aaa] transition-colors leading-none disabled:opacity-30 disabled:cursor-not-allowed"
        onClick={onTogglePause}
        disabled={isOver}
      >
        {isPaused ? '▶\uFE0E' : '⏸\uFE0E'}
      </button>
      <button
        className="bg-transparent border-none text-[#444] text-[22px] cursor-pointer p-2 hover:text-[#777] transition-colors leading-none"
        onClick={onNext}
        title="Следующий уровень"
      >
        {'⏭\uFE0E'}
      </button>
    </div>
  );
}
