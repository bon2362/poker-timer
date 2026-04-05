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
  return (
    <div
      className="fixed right-[42px] top-1/2 -translate-y-1/2 z-10 cursor-pointer"
      onClick={onToggle}
    >
      <div className={`flex flex-col gap-[7px] ${visible ? 'visible' : 'invisible'}`}>
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
