import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WinnerScreen } from '@/components/WinnerScreen/WinnerScreen';
import { MobileView } from '@/components/MobileView';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { PokerTimer } from '@/components/PokerTimer';
import { useGame } from '@/context/GameContext';
import { useTimer } from '@/context/TimerContext';
import { DEFAULT_CONFIG } from '@/lib/storage';
import * as timerStateStorage from '@/lib/supabase/timerState';

jest.mock('@/context/AdminAuthContext', () => ({ useAdminAuth: jest.fn() }));
jest.mock('@/components/MobileAdminPanel', () => ({ MobileAdminPanel: () => null }));
jest.mock('@/context/GameContext', () => ({ useGame: jest.fn() }));
jest.mock('@/context/TimerContext', () => ({ useTimer: jest.fn() }));
jest.mock('@/components/PlayerManager/PlayerManager', () => ({ Avatar: () => null }));
jest.mock('@/lib/audio', () => ({ playWinnerFanfare: () => ({ stop: jest.fn() }), playOneShot: jest.fn() }));
jest.mock('@/lib/supabase/winnerImage', () => ({ getWinnerImageUrl: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/supabase/loserImage', () => ({ getLoserImageUrl: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/supabase/slideshow', () => ({
  listSlideshowPhotos: jest.fn().mockResolvedValue([]),
  listSlideshowItems: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/components/BreakSongPlayer', () => ({ useBreakSong: () => ({ songPaused: true, toggleSong: jest.fn(), songTime: 0 }) }));
jest.mock('@/components/BlindInfo', () => ({ BlindInfo: () => null }));
jest.mock('@/components/TimerDisplay', () => ({ TimerDisplay: () => null }));
jest.mock('@/components/Controls', () => ({ Controls: () => null }));
jest.mock('@/components/SettingsScreen', () => ({ SettingsScreen: () => null }));
jest.mock('@/components/GamePanel/GamePanel', () => ({ GamePanel: () => null }));
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

beforeEach(() => {
  jest.clearAllMocks();
  (useAdminAuth as jest.Mock).mockReturnValue({ isAdmin: true, checking: false, login: jest.fn() });
});

test.each(['standalone', 'timer'] as const)('%s keeps winner screen open and shows finish error before retrying', async mode => {
  const { finishGame } = setup();
  const user = userEvent.setup();
  render(mode === 'standalone' ? <WinnerScreen /> : <PokerTimer />);
  await user.click(screen.getByRole('button', { name: 'Завершить игру' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось завершить игру');
  finishGame.mockResolvedValue({ ok: true });
  await user.click(screen.getByRole('button', { name: 'Завершить игру' }));
  await waitFor(() => expect(finishGame).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each([false, true])('desktop viewer cannot use keyboard commands while checking=%s', async checking => {
  const { dispatch } = setup();
  (useAdminAuth as jest.Mock).mockReturnValue({ isAdmin: false, checking });
  render(<PokerTimer />);
  await act(async () => {});
  dispatch.mockClear();
  for (const code of ['Space', 'Tab', 'PageUp', 'PageDown']) document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  expect(dispatch).not.toHaveBeenCalled();
  expect(screen.queryByTitle('Settings')).not.toBeInTheDocument();
});

test('viewer continues seeing a running timer without pause control', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(1_800_000_000_000);
  const { TimerProvider, useTimer: realUseTimer } = jest.requireActual('@/context/TimerContext');
  const restore = jest.spyOn(timerStateStorage, 'fetchTimerState').mockResolvedValue({
    currentStage: 0, anchorTs: Date.now(), elapsedBeforePause: 0, isPaused: false,
    isOver: false, warnedOneMin: false, stageType: 'level', levelNum: 1, sb: 10, bb: 20, stageDurationSecs: 1200,
  });
  try {
    setup();
    (useTimer as jest.Mock).mockImplementation(realUseTimer);
    (useAdminAuth as jest.Mock).mockReturnValue({ isAdmin: false, checking: false });
    render(<TimerProvider><MobileView /></TimerProvider>);
    await act(async () => {});
    expect(screen.getByText('20:00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /[▶⏸]/ })).not.toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.getByText('19:57')).toBeInTheDocument();
    expect(screen.queryByText('PAUSE')).not.toBeInTheDocument();
  } finally {
    restore.mockRestore();
    jest.useRealTimers();
  }
});

test('viewer cannot change the shared combinations display setting', async () => {
  const { dispatch } = setup();
  (useAdminAuth as jest.Mock).mockReturnValue({ isAdmin: false, checking: false });
  render(<PokerTimer />);
  await act(async () => {});
  dispatch.mockClear();
  await act(async () => { screen.getAllByText('K')[0].click(); });
  expect(dispatch).not.toHaveBeenCalled();
});
