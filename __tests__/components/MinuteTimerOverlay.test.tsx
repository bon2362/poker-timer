import { render, screen } from '@testing-library/react';
import { MinuteTimerOverlay } from '@/components/MinuteTimerOverlay';
import { useAdminAuth } from '@/context/AdminAuthContext';

jest.mock('@/context/AdminAuthContext', () => ({ useAdminAuth: jest.fn() }));
jest.mock('@/context/MinuteTimerContext', () => ({ useMinuteTimer: () => ({ state: { active: true, playerName: 'Alice', playerId: 'p1', timeLeft: 30 }, stopMinute: jest.fn() }) }));
jest.mock('@/context/GameContext', () => ({ useGame: () => ({ players: [] }) }));

test.each([false, true])('minute timer stays visible without a stop control for a viewer (mobile=%s)', mobile => {
  (useAdminAuth as jest.Mock).mockReturnValue({ isAdmin: false, checking: false });
  render(<MinuteTimerOverlay mobile={mobile} />);
  expect(screen.getByText('00:30')).toBeInTheDocument();
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Решение принято' })).not.toBeInTheDocument();
});
