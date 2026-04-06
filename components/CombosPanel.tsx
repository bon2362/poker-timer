type CardProps = {
  rank: string;
  suit: string;
  red?: boolean;
  hidden?: boolean;
};

function Card({ rank, suit, red, hidden }: CardProps) {
  if (hidden) {
    return (
      <div className="w-[46px] h-[60px] rounded-[5px] flex flex-col items-center justify-center bg-[#1d1d1d] border border-[#242424] text-[#242424]">
        <span className="text-[13px] font-bold">{rank}</span>
        <span className="text-[18px]">{suit}</span>
      </div>
    );
  }
  return (
    <div className={`w-[46px] h-[60px] rounded-[5px] flex flex-col items-center justify-center bg-[#272727] border border-[#444] ${red ? 'text-[#c84040]' : 'text-[#bbb]'}`}>
      <span className="text-[13px] font-bold leading-[1.3]">{rank}</span>
      <span className="text-[18px] leading-[1.1]">{suit}</span>
    </div>
  );
}

function Row({ cards }: { cards: CardProps[] }) {
  return (
    <div className="flex gap-[5px]">
      {cards.map((c, i) => <Card key={i} {...c} />)}
    </div>
  );
}

type Props = {
  visible: boolean;
  onToggle: () => void;
};

export function CombosPanel({ visible, onToggle }: Props) {
  /* ── Collapsed strip ── */
  if (!visible) {
    return (
      <div
        className="fixed right-0 top-0 bottom-0 w-[32px] z-30 cursor-pointer group"
        onClick={onToggle}
        title="Комбинации"
      >
        {/* Subtle right edge line */}
        <div className="absolute inset-y-0 right-0 w-px bg-[#2a2a2a] group-hover:bg-[#3a3a3a] transition-colors" />
        {/* Vertical label — visible only on hover */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="opacity-0 group-hover:opacity-100 text-[#666] text-[10px] tracking-[3px] uppercase font-medium transition-opacity select-none"
            style={{ writingMode: 'vertical-rl' }}
          >
            КОМБИНАЦИИ
          </span>
        </div>
      </div>
    );
  }

  /* ── Full panel ── */
  return (
    <div className="fixed top-0 right-0 bottom-0 w-[300px] z-40 bg-[#1a1a1a] border-l border-[#2a2a2a] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase">Комбинации</div>
        <button
          onClick={onToggle}
          className="text-[#555] text-[20px] bg-transparent border-none cursor-pointer hover:text-[#999] leading-none"
        >
          ✕
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-[7px]">
        <Row cards={[
          { rank: '10', suit: '\u2665', red: true }, { rank: 'J', suit: '\u2665', red: true },
          { rank: 'Q', suit: '\u2665', red: true }, { rank: 'K', suit: '\u2665', red: true },
          { rank: 'A', suit: '\u2665', red: true },
        ]} />
        <Row cards={[
          { rank: '7', suit: '\u2663' }, { rank: '8', suit: '\u2663' }, { rank: '9', suit: '\u2663' },
          { rank: '10', suit: '\u2663' }, { rank: 'J', suit: '\u2663' },
        ]} />
        <Row cards={[
          { rank: 'K', suit: '\u2660' }, { rank: 'K', suit: '\u2666', red: true },
          { rank: 'K', suit: '\u2663' }, { rank: 'K', suit: '\u2665', red: true },
          { rank: '3', suit: '\u2666', hidden: true },
        ]} />
        <Row cards={[
          { rank: '6', suit: '\u2660' }, { rank: '6', suit: '\u2666', red: true },
          { rank: '6', suit: '\u2663' }, { rank: '10', suit: '\u2660' }, { rank: '10', suit: '\u2665', red: true },
        ]} />
        <Row cards={[
          { rank: 'J', suit: '\u2660' }, { rank: '7', suit: '\u2660' }, { rank: 'A', suit: '\u2660' },
          { rank: '2', suit: '\u2660' }, { rank: '9', suit: '\u2660' },
        ]} />
        <Row cards={[
          { rank: '5', suit: '\u2666', red: true }, { rank: '6', suit: '\u2663' },
          { rank: '7', suit: '\u2660' }, { rank: '8', suit: '\u2665', red: true },
          { rank: '9', suit: '\u2666', red: true },
        ]} />
        <Row cards={[
          { rank: 'J', suit: '\u2666', red: true }, { rank: 'J', suit: '\u2663' },
          { rank: 'J', suit: '\u2665', red: true }, { rank: '6', suit: '\u2660', hidden: true },
          { rank: 'A', suit: '\u2660', hidden: true },
        ]} />
        <Row cards={[
          { rank: '9', suit: '\u2663' }, { rank: '9', suit: '\u2660' },
          { rank: '10', suit: '\u2665', red: true }, { rank: '10', suit: '\u2666', red: true },
          { rank: '3', suit: '\u2666', hidden: true },
        ]} />
        <Row cards={[
          { rank: 'J', suit: '\u2663' }, { rank: 'J', suit: '\u2665', red: true },
          { rank: 'A', suit: '\u2666', hidden: true }, { rank: '2', suit: '\u2666', hidden: true },
          { rank: '7', suit: '\u2666', hidden: true },
        ]} />
        <Row cards={[
          { rank: 'K', suit: '\u2660' }, { rank: '9', suit: '\u2666', hidden: true },
          { rank: '3', suit: '\u2663', hidden: true }, { rank: '7', suit: '\u2665', hidden: true },
          { rank: 'J', suit: '\u2660', hidden: true },
        ]} />
      </div>
    </div>
  );
}
