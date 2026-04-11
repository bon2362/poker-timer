import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from '@/components/SettingsScreen';
import { DEFAULT_CONFIG } from '@/lib/storage';

// Mock heavy sub-components that use contexts/Supabase
jest.mock('@/components/PlayerManager/PlayerManager', () => ({
  PlayerManager: () => <div data-testid="player-manager">PlayerManager</div>,
}));

jest.mock('@/components/SessionSetup/SessionSetup', () => ({
  SessionSetup: () => <div data-testid="session-setup">SessionSetup</div>,
}));

jest.mock('@/lib/supabase/slideshow', () => ({
  listSlideshowPhotos: jest.fn().mockResolvedValue([]),
  uploadSlideshowPhoto: jest.fn().mockResolvedValue(undefined),
  deleteAllSlideshowPhotos: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/audio', () => ({
  playSound: jest.fn(),
}));

jest.mock('@/context/GameContext', () => ({
  useGame: jest.fn(() => ({
    players: [],
    sessionPlayers: [],
    activeSession: null,
    startSession: jest.fn(),
  })),
}));

jest.mock('@/context/TimerContext', () => ({
  useTimer: jest.fn(() => ({ dispatch: jest.fn(), state: {} })),
}));

function renderSettings(props: Partial<React.ComponentProps<typeof SettingsScreen>> = {}) {
  const defaults = {
    config: DEFAULT_CONFIG,
    onSave: jest.fn(),
    onDisplaySave: jest.fn(),
    onClose: jest.fn(),
    onSlideshowChanged: jest.fn(),
  };
  return render(<SettingsScreen {...defaults} {...props} />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SettingsScreen — Header and navigation', () => {
  test('renders "НАСТРОЙКИ" title', () => {
    renderSettings();
    expect(screen.getByText('НАСТРОЙКИ')).toBeInTheDocument();
  });

  test('renders version "v4.26"', () => {
    renderSettings();
    expect(screen.getByText('v4.26')).toBeInTheDocument();
  });

  test('clicking "← Назад" calls onClose', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    renderSettings({ onClose });
    await user.click(screen.getByRole('button', { name: '← Назад' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('clicking "Готово" calls onClose', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    renderSettings({ onClose });
    await user.click(screen.getByRole('button', { name: 'Готово' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('clicking "1:05" button calls onJumpToEnd', async () => {
    const onJumpToEnd = jest.fn();
    const user = userEvent.setup();
    renderSettings({ onJumpToEnd });
    await user.click(screen.getByRole('button', { name: '1:05' }));
    expect(onJumpToEnd).toHaveBeenCalledTimes(1);
  });

  test('"1:05" button not rendered when onJumpToEnd not provided', () => {
    renderSettings({ onJumpToEnd: undefined });
    expect(screen.queryByRole('button', { name: '1:05' })).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — Tabs', () => {
  test('"Турнир" tab is active by default and shows tournament content', () => {
    renderSettings();
    // Tournament tab should be active — session setup stub is rendered
    expect(screen.getByTestId('session-setup')).toBeInTheDocument();
  });

  test('clicking "Игроки" tab renders PlayerManager', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('button', { name: 'Игроки' }));
    expect(screen.getByTestId('player-manager')).toBeInTheDocument();
  });

  test('clicking "Оформление" tab renders display settings section', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('button', { name: 'Оформление' }));
    // Display tab shows Slideshow section label
    expect(screen.getByText('Слайдшоу на перерыве')).toBeInTheDocument();
  });
});

describe('SettingsScreen — Changelog', () => {
  test('clicking version "v4.26" opens changelog modal', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByText('v4.26'));
    expect(screen.getByText('История версий')).toBeInTheDocument();
  });

  test('changelog modal shows "История версий" title', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByText('v4.26'));
    expect(screen.getByRole('heading', { name: 'История версий' })).toBeInTheDocument();
  });

  test('clicking "✕" in changelog closes it', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByText('v4.26'));
    // Changelog is open
    const modal = screen.getByRole('heading', { name: 'История версий' }).closest('div')!;
    // Close button is sibling of the heading inside the modal header row
    const closeBtn = within(modal).getByRole('button', { name: '✕' });
    await user.click(closeBtn);
    expect(screen.queryByText('История версий')).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — Tournament tab content', () => {
  test('TournamentTab renders "Длительность уровня" label', () => {
    renderSettings();
    expect(screen.getByText('Длительность уровня')).toBeInTheDocument();
  });

  test('TournamentTab renders blind levels table with "SB" and "BB" headers', () => {
    renderSettings();
    expect(screen.getByText('SB')).toBeInTheDocument();
    expect(screen.getByText('BB')).toBeInTheDocument();
  });

  test('TournamentTab renders first blind values from DEFAULT_CONFIG', () => {
    renderSettings();
    // DEFAULT_CONFIG first level: sb=10, bb=20 — they appear as input values
    const inputs = screen.getAllByDisplayValue('10');
    expect(inputs.length).toBeGreaterThan(0);
    const inputs20 = screen.getAllByDisplayValue('20');
    expect(inputs20.length).toBeGreaterThan(0);
  });

  test('Save button "Применить время и блайнды" is initially disabled when no changes', () => {
    renderSettings();
    const saveBtn = screen.getByRole('button', { name: 'Применить время и блайнды' });
    expect(saveBtn).toBeDisabled();
  });

  test('After changing level duration, save button becomes enabled', async () => {
    const user = userEvent.setup();
    renderSettings();
    const saveBtn = screen.getByRole('button', { name: 'Применить время и блайнды' });
    expect(saveBtn).toBeDisabled();

    // Find level duration input via its label "Длительность уровня"
    const label = screen.getByText('Длительность уровня');
    const levelInput = label.closest('div')!.querySelector('input') as HTMLInputElement;
    expect(levelInput).toBeInTheDocument();
    await user.clear(levelInput);
    await user.type(levelInput, '15');

    await waitFor(() => expect(saveBtn).toBeEnabled());
  });
});
