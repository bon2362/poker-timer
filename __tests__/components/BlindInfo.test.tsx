import { render } from '@testing-library/react';
import { BlindInfo } from '@/components/BlindInfo';
import type { LevelStage, BreakStage } from '@/types/timer';

const levelStage: LevelStage = {
  type: 'level',
  levelNum: 3,
  sb: 100,
  bb: 200,
  duration: 1200,
};

const breakStage: BreakStage = {
  type: 'break',
  duration: 600,
};

describe('BlindInfo', () => {
  test('renders "Round N" and "SB / BB" for level stage', () => {
    const { getByText } = render(<BlindInfo stage={levelStage} />);
    expect(getByText(/Round 3/)).toBeInTheDocument();
    expect(getByText(/100 \/ 200/)).toBeInTheDocument();
  });

  test('renders "☕ Break" and duration in minutes for break stage', () => {
    const { getByText } = render(<BlindInfo stage={breakStage} />);
    expect(getByText(/☕ Break/)).toBeInTheDocument();
    expect(getByText(/10 min/)).toBeInTheDocument();
  });

  test('shows correct round number', () => {
    const stage: LevelStage = { ...levelStage, levelNum: 7 };
    const { getByText } = render(<BlindInfo stage={stage} />);
    expect(getByText(/Round 7/)).toBeInTheDocument();
  });

  test('shows correct sb/bb values', () => {
    const stage: LevelStage = { ...levelStage, sb: 500, bb: 1000 };
    const { getByText } = render(<BlindInfo stage={stage} />);
    expect(getByText(/500 \/ 1000/)).toBeInTheDocument();
  });

  test('shows correct duration for break (600s → "10 min")', () => {
    const { getByText } = render(<BlindInfo stage={breakStage} />);
    expect(getByText(/10 min/)).toBeInTheDocument();
  });
});
