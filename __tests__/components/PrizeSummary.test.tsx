import { render } from '@testing-library/react';
import { PrizeSummary } from '@/components/GamePanel/PrizeSummary';
import type { Session, SessionPlayer } from '@/types/game';

jest.mock('@/context/GameContext', () => ({
  useGame: jest.fn(),
}));

import { useGame } from '@/context/GameContext';
const mockUseGame = useGame as jest.Mock;

const mockSession: Session = {
  id: 'session-1',
  buyIn: 1000,
  initialStack: 10000,
  rebuyCost: 800,
  rebuyChips: 8000,
  maxRebuys: 2,
  addonCost: 500,
  addonChips: 5000,
  prizeSpots: 3,
  prizePcts: [60, 25, 15],
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
};

const mockSessionPlayers: SessionPlayer[] = [
  {
    id: 'sp1',
    sessionId: 'session-1',
    playerId: 'p1',
    rebuys: 0,
    hasAddon: false,
    status: 'playing',
    finishPosition: null,
    eliminatedAt: null,
  },
  {
    id: 'sp2',
    sessionId: 'session-1',
    playerId: 'p2',
    rebuys: 1,
    hasAddon: true,
    status: 'playing',
    finishPosition: null,
    eliminatedAt: null,
  },
];

// bank = 2*1000 + 1*800 + 1*500 = 2300
// payouts: 1st=floor(2300*60/100)=1380, 2nd=floor(2300*25/100)=575, 3rd=2300-1380-575=345

describe('PrizeSummary', () => {
  test('renders null when activeSession is null', () => {
    mockUseGame.mockReturnValue({ activeSession: null, sessionPlayers: [] });
    const { container } = render(<PrizeSummary />);
    expect(container.firstChild).toBeNull();
  });

  test('renders prize rows when session has 3 prize spots', () => {
    mockUseGame.mockReturnValue({
      activeSession: mockSession,
      sessionPlayers: mockSessionPlayers,
    });
    const { container } = render(<PrizeSummary />);
    // Inner rows have 'flex justify-between' class
    const rows = container.querySelectorAll('div.flex.justify-between');
    expect(rows).toHaveLength(3);
  });

  test('shows correct place labels', () => {
    mockUseGame.mockReturnValue({
      activeSession: mockSession,
      sessionPlayers: mockSessionPlayers,
    });
    const { getByText } = render(<PrizeSummary />);
    expect(getByText(/1-е место/)).toBeInTheDocument();
    expect(getByText(/2-е место/)).toBeInTheDocument();
    expect(getByText(/3-е место/)).toBeInTheDocument();
  });

  test('shows correct percentage for each place', () => {
    mockUseGame.mockReturnValue({
      activeSession: mockSession,
      sessionPlayers: mockSessionPlayers,
    });
    const { getByText } = render(<PrizeSummary />);
    expect(getByText(/60%/)).toBeInTheDocument();
    expect(getByText(/25%/)).toBeInTheDocument();
    expect(getByText(/15%/)).toBeInTheDocument();
  });

  test('shows correct payout amounts from calcGameStats', () => {
    mockUseGame.mockReturnValue({
      activeSession: mockSession,
      sessionPlayers: mockSessionPlayers,
    });
    const { container } = render(<PrizeSummary />);
    // bank = 2*1000 + 1*800 + 1*500 = 3300
    // 1st = floor(3300*60/100) = 1980, 2nd = floor(3300*25/100) = 825, 3rd = 3300-1980-825 = 495
    // toLocaleString('ru') uses a non-breaking space (\u00a0) as thousands separator
    const amountSpans = container.querySelectorAll('span.tabular-nums');
    const amounts = Array.from(amountSpans).map(el => el.textContent ?? '');
    expect(amounts[0]).toMatch(/1.980/);  // 1 980 RSD (with any whitespace/nbsp between digits)
    expect(amounts[1]).toMatch(/825/);
    expect(amounts[2]).toMatch(/495/);
  });
});
