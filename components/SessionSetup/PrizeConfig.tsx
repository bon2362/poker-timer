'use client';

type Props = {
  spots: number;
  pcts: number[];
  onSpotsChange: (n: number) => void;
  onPctsChange: (pcts: number[]) => void;
};

const DEFAULT_PCTS: Record<number, number[]> = {
  1: [100],
  2: [65, 35],
  3: [50, 30, 20],
  4: [45, 27, 18, 10],
  5: [40, 25, 17, 11, 7],
};

export function PrizeConfig({ spots, pcts, onSpotsChange, onPctsChange }: Props) {
  const sum = pcts.reduce((a, b) => a + b, 0);
  const isValid = sum === 100;

  function handleSpotsChange(n: number) {
    onSpotsChange(n);
    onPctsChange(DEFAULT_PCTS[n] ?? Array(n).fill(Math.floor(100 / n)));
  }

  function handlePctChange(i: number, value: string) {
    const newPcts = [...pcts];
    newPcts[i] = parseInt(value, 10) || 0;
    onPctsChange(newPcts);
  }

  const inputBase = 'bg-[#333] border border-[#444] rounded-[6px] text-white px-2 py-1 text-[14px] w-[60px] text-center focus:outline-none focus:border-violet-600 tabular-nums';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="text-[13px] text-[#888]">Призовых мест:</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => spots > 1 && handleSpotsChange(spots - 1)}
            className="bg-[#333] border-none text-[#888] w-7 h-7 rounded cursor-pointer hover:text-white"
          >−</button>
          <span className="text-white text-[15px] font-bold w-6 text-center">{spots}</span>
          <button
            onClick={() => spots < 8 && handleSpotsChange(spots + 1)}
            className="bg-[#333] border-none text-[#888] w-7 h-7 rounded cursor-pointer hover:text-white"
          >+</button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {pcts.map((pct, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[#555] text-[12px] w-[56px]">{i + 1}-е место</span>
            <input
              type="number"
              min="0"
              max="100"
              value={pct}
              onChange={e => handlePctChange(i, e.target.value)}
              className={inputBase}
            />
            <span className="text-[#555] text-[12px]">%</span>
          </div>
        ))}
      </div>

      <div className={`text-[12px] ${isValid ? 'text-green-500' : 'text-red-400'}`}>
        Итого: {sum}% {isValid ? '✓' : `(нужно 100%)`}
      </div>
    </div>
  );
}
