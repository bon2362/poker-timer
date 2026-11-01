import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WinnerScreen } from '@/components/WinnerScreen/WinnerScreen';
import { PokerTimer } from '@/components/PokerTimer';
import { useGame } from '@/context/GameContext';
import { useTimer } from '@/context/TimerContext';
import { DEFAULT_CONFIG } from '@/lib/storage';

jest.mock('@/context/GameContext', () => ({ useGame: jest.fn() }));
jest.mock('@/context/TimerContext', () => ({ useTimer: jest.fn() }));
jest.mock('@/components/PlayerManager/PlayerManager', () => ({ Avatar: () => null }));
jest.mock('@/lib/audio', () => ({ playWinnerFanfare: () => ({ stop: jest.fn() }), playOneShot: jest.fn() }));
jest.mock('@/lib/supabase/winnerImage', () => ({ getWinnerImageUrl: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/supabase/loserImage', () => ({ getLoserImageUrl: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/supabase/slideshow', () => ({ listSlideshowPhotos: jest.fn().mockResolvedValue([]) }));
jest.mock('@/components/BreakSongPlayer', () => ({ useBreakSong: () => ({ songPaused: true, toggleSong: jest.fn(), songTime: 0 }) }));
jest.mock('@/components/BlindInfo', () => ({ BlindInfo: () => null }));
jest.mock('@/components/TimerDisplay', () => ({ TimerDisplay: () => null }));
jest.mock('@/components/Controls', () => ({ Controls: () => null }));
jest.mock('@/components/CombosPanel', () => ({ CombosPanel: () => null }));
jest.mock('@/components/SettingsScreen', () => ({ SettingsScreen: () => null }));
jest.mock('@/components/GamePanel/GamePanel', () => ({ GamePanel: () => null }));
jest.mock('@/components/SlideshowOverlay', () => ({ SlideshowOverlay: () => null }));
jest.mock('@/components/TractorOverlay', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/MinuteTimerOverlay', () => ({ MinuteTimerOverlay: () => null }));
jest.mock('@/components/LoserImageOverlay', () => ({ LoserImageOverlay: () => null }));
jest.mock('@/components/FinalGameSlideshowOverlay', () => ({ FinalGameSlideshowOverlay: ({ onFinish }: { onFinish: () => void }) => <button onClick={onFinish}>Завершить слайдшоу</button> }));

function setup() {
  const finishGame = jest.fn().mockResolvedValue({ ok: false, error: 'Не удалось завершить игру' });
  const dispatch = jest.fn();
  (useGame as jest.Mock).mockReturnValue({
    activeSession: { id: 's1', buyIn: 1000, initialStack: 2000, rebuyCost: 0, addonCost: 0, prizePcts: [100], prizeSpots: 1, numberOfTables: 1 },
    sessionPlayers: [{ id: 'sp1', playerId: 'p1', status: 'winner', rebuys: 0, hasAddon: false, finishPosition: 1 }],
    players: [{ id: 'p1', name: 'Alice' }], showWinner: true, loading: false, finishGame,
  });
  (useTimer as jest.Mock).mockReturnValue({ state: { config: DEFAULT_CONFIG, isPaused: false, currentStage: 0, stages: [{ type: 'level', duration: 1200, sb: 25, bb: 50, levelNum: 1 }] }, dispatch });
  return { finishGame, dispatch };
}

beforeEach(() => jest.clearAllMocks());

test.each(['standalone', 'timer'] as const)('%s keeps winner screen open and shows finish error before retrying', async mode => {
  const { finishGame, dispatch } = setup();
  const user = userEvent.setup();
  render(mode === 'standalone' ? <WinnerScreen /> : <PokerTimer />);
  await user.click(screen.getByRole('button', { name: 'Завершить игру' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось завершить игру');
  expect(dispatch).not.toHaveBeenCalledWith({ type: 'OPEN_SETTINGS' });
  finishGame.mockResolvedValue({ ok: true });
  await user.click(screen.getByRole('button', { name: 'Завершить игру' }));
  await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'OPEN_SETTINGS' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('timer exposes the finish error above the final slideshow and keeps it visible', async () => {
  jest.useFakeTimers();
  try {
    const { dispatch } = setup();
    render(<PokerTimer />);
    await act(async () => { jest.advanceTimersByTime(31000); });
    await act(async () => { screen.getByRole('button', { name: 'Завершить слайдшоу' }).click(); });
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось завершить игру');
    expect(screen.getByRole('button', { name: 'Завершить слайдшоу' })).toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'OPEN_SETTINGS' });
  } finally { jest.useRealTimers(); }
});
