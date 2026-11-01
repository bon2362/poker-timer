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
import { listSlideshowItems } from '@/lib/supabase/slideshow';

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

test('timer cycles photo records with their supplied dates during a break', async () => {
  jest.useFakeTimers();
  const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
  try {
    setup();
    (useGame as jest.Mock).mockReturnValue({ activeSession: { id: 's1' }, sessionPlayers: [], players: [], showWinner: false, loading: false });
    (useTimer as jest.Mock).mockReturnValue({ state: {
      config: { ...DEFAULT_CONFIG, slideshowEnabled: true, slideshowSpeed: 5, breakSongEnabled: false },
      currentStage: 0, timeLeft: 60, isPaused: false,
      stages: [{ type: 'break', duration: 300 }],
    }, dispatch: jest.fn() });
    (listSlideshowItems as jest.Mock).mockResolvedValue([
      { url: 'https://example.com/a.jpg', date: '01.11.2026' },
      { url: 'https://example.com/b.jpg', date: '10.05.2026' },
    ]);
    render(<PokerTimer />);
    await act(async () => {});
    expect(screen.getByText('01.11.2026')).toBeInTheDocument();
    expect(document.querySelector('img[src="https://example.com/a.jpg"]')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.getByText('10.05.2026')).toBeInTheDocument();
    expect(screen.queryByText('01.11.2026')).not.toBeInTheDocument();
    expect(document.querySelector('img[src="https://example.com/b.jpg"]')).toBeInTheDocument();
  } finally {
    (listSlideshowItems as jest.Mock).mockResolvedValue([]);
    random.mockRestore();
    jest.useRealTimers();
  }
});


test('viewer sees winner information without finish action', async () => {
  setup();
  (useAdminAuth as jest.Mock).mockReturnValue({ isAdmin: false, checking: false });
  render(<WinnerScreen />);
  await act(async () => {});
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Завершить игру' })).not.toBeInTheDocument();
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

test.each([
  { isAdmin: false, checking: false, shouldPause: false },
  { isAdmin: false, checking: true, shouldPause: false },
  { isAdmin: true, checking: true, shouldPause: false },
  { isAdmin: true, checking: false, shouldPause: true },
])('merge prompt pauses only for a verified admin: %j', async ({ isAdmin, checking, shouldPause }) => {
  const { dispatch } = setup();
  const game = (useGame as jest.Mock).getMockImplementation()!();
  (useGame as jest.Mock).mockReturnValue({
    ...game,
    activeSession: { ...game.activeSession, numberOfTables: 2, mergeThreshold: 1, tablesMergedAt: null },
    sessionPlayers: [{ ...game.sessionPlayers[0], status: 'playing', finishPosition: null }],
    showWinner: false,
  });
  (useAdminAuth as jest.Mock).mockReturnValue({ isAdmin, checking });

  const { rerender } = render(<PokerTimer />);
  await act(async () => {});

  if (shouldPause) {
    expect(dispatch).toHaveBeenCalledWith({ type: 'PAUSE_TIMER' });
  } else {
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'PAUSE_TIMER' });
  }

  if (isAdmin && checking) {
    (useAdminAuth as jest.Mock).mockReturnValue({ isAdmin: true, checking: false });
    rerender(<PokerTimer />);
    expect(dispatch).toHaveBeenCalledWith({ type: 'PAUSE_TIMER' });
  }
});

test('mobile viewer double tap opens password form, with no pause action', async () => {
  setup();
  (useAdminAuth as jest.Mock).mockReturnValue({ isAdmin: false, checking: false, login: jest.fn() });
  render(<MobileView />);
  expect(screen.queryByRole('button', { name: /[▶⏸]/ })).not.toBeInTheDocument();
  const blindArea = screen.getByText('Round 1').parentElement!.parentElement!;
  await act(async () => { blindArea.click(); blindArea.click(); });
  expect(screen.getByLabelText('Пароль')).toBeInTheDocument();
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
