import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
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

  test('renders a version string matching vX.Y format', () => {
    renderSettings();
    expect(screen.getByText(/^v\d+\.\d+$/)).toBeInTheDocument();
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
  test('clicking version string opens changelog modal', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByText(/^v\d+\.\d+$/));
    expect(screen.getByText('История версий')).toBeInTheDocument();
  });

  test('changelog modal shows "История версий" title', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByText(/^v\d+\.\d+$/));
    expect(screen.getByRole('heading', { name: 'История версий' })).toBeInTheDocument();
  });

  test('clicking "✕" in changelog closes it', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByText(/^v\d+\.\d+$/));
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

  test('clicking save after change calls onSave with updated config', async () => {
    const onSave = jest.fn();
    const user = userEvent.setup();
    renderSettings({ onSave });

    const label = screen.getByText('Длительность уровня');
    const levelInput = label.closest('div')!.querySelector('input') as HTMLInputElement;
    await user.clear(levelInput);
    await user.type(levelInput, '15');

    const saveBtn = screen.getByRole('button', { name: 'Применить время и блайнды' });
    await waitFor(() => expect(saveBtn).toBeEnabled());
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ levelDuration: 15 }));
  });

  test('"+ добавить уровень" adds a new blind row', async () => {
    const user = userEvent.setup();
    renderSettings();

    const deleteButtons = screen.getAllByRole('button', { name: '✕' });
    const initialCount = deleteButtons.length;

    await user.click(screen.getByRole('button', { name: '+ добавить уровень' }));

    expect(screen.getAllByRole('button', { name: '✕' })).toHaveLength(initialCount + 1);
  });

  test('"✕" removes a blind level row', async () => {
    const user = userEvent.setup();
    renderSettings();

    const initialCount = screen.getAllByRole('button', { name: '✕' }).length;
    await user.click(screen.getAllByRole('button', { name: '✕' })[0]);

    expect(screen.getAllByRole('button', { name: '✕' })).toHaveLength(initialCount - 1);
  });

  test('changing a blind SB value marks form as dirty and enables save', async () => {
    const user = userEvent.setup();
    renderSettings();

    const saveBtn = screen.getByRole('button', { name: 'Применить время и блайнды' });
    expect(saveBtn).toBeDisabled();

    // Find first SB input in the blind table
    const sbInputs = screen.getAllByDisplayValue('10');
    await user.clear(sbInputs[0]);
    await user.type(sbInputs[0], '15');

    await waitFor(() => expect(saveBtn).toBeEnabled());
  });
});

describe('SettingsScreen — Display tab', () => {
  const { listSlideshowPhotos, uploadSlideshowPhoto, deleteAllSlideshowPhotos } =
    jest.requireMock('@/lib/supabase/slideshow');

  async function openDisplayTab() {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('button', { name: 'Оформление' }));
    return user;
  }

  test('opening display tab triggers listSlideshowPhotos', async () => {
    await openDisplayTab();
    await waitFor(() => expect(listSlideshowPhotos).toHaveBeenCalled());
  });

  test('toggling slideshow checkbox calls onDisplaySave', async () => {
    const onDisplaySave = jest.fn();
    const user = userEvent.setup();
    renderSettings({ onDisplaySave });
    await user.click(screen.getByRole('button', { name: 'Оформление' }));

    const checkbox = await screen.findByRole('checkbox', { name: /Показывать фото/i });
    await user.click(checkbox);

    expect(onDisplaySave).toHaveBeenCalledWith(expect.objectContaining({ slideshowEnabled: expect.any(Boolean) }));
  });

  test('blurring speed field calls onDisplaySave', async () => {
    const onDisplaySave = jest.fn();
    const user = userEvent.setup();
    renderSettings({ onDisplaySave });
    await user.click(screen.getByRole('button', { name: 'Оформление' }));

    const speedLabel = await screen.findByText('Смена фото (сек)');
    const speedInput = speedLabel.closest('div')!.querySelector('input') as HTMLInputElement;
    await user.clear(speedInput);
    await user.type(speedInput, '10');
    fireEvent.blur(speedInput);

    expect(onDisplaySave).toHaveBeenCalledWith(expect.objectContaining({ slideshowSpeed: 10 }));
  });

  test('"+ Добавить фото" button and hidden file input rendered in display tab', async () => {
    await openDisplayTab();
    await waitFor(() => expect(listSlideshowPhotos).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: '+ Добавить фото' })).toBeInTheDocument();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.accept).toBe('image/*');
  });

  test('"Удалить все" button appears when photos exist', async () => {
    (listSlideshowPhotos as jest.Mock).mockResolvedValue(['https://example.com/a.jpg']);

    await openDisplayTab();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Удалить все' })).toBeInTheDocument());
  });

  test('"Потная Раздача" button is always visible in display tab', async () => {
    await openDisplayTab();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Потная Раздача' })).toBeInTheDocument());
  });

  test('clicking "Удалить все" calls deleteAllSlideshowPhotos after confirm', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    (listSlideshowPhotos as jest.Mock).mockResolvedValue(['https://example.com/a.jpg']);

    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('button', { name: 'Оформление' }));

    const deleteBtn = await screen.findByRole('button', { name: 'Удалить все' });
    await user.click(deleteBtn);

    expect(deleteAllSlideshowPhotos).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsScreen — Tournament tab reset', () => {
  test('clicking "сбросить к умолчаниям" resets blinds to DEFAULT_CONFIG', async () => {
    const user = userEvent.setup();
    const modifiedConfig = {
      ...DEFAULT_CONFIG,
      levelDuration: 99,
      blindLevels: [{ sb: 999, bb: 1998 }],
    };
    render(
      <SettingsScreen
        config={modifiedConfig}
        onSave={jest.fn()}
        onDisplaySave={jest.fn()}
        onClose={jest.fn()}
        onSlideshowChanged={jest.fn()}
      />
    );

    // Modified config values are visible
    expect(screen.getAllByDisplayValue('999').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'сбросить к умолчаниям' }));

    // After reset, DEFAULT_CONFIG first blind sb=10 should appear
    await waitFor(() => expect(screen.getAllByDisplayValue('10').length).toBeGreaterThan(0));
  });
});

describe('SettingsScreen — CI/CD tab', () => {
  const mockCiData = {
    testRun: {
      status: 'completed',
      conclusion: 'success',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url: 'https://github.com/test/run/1',
      commit: {
        sha: 'abc1234',
        message: 'test commit message',
        author: 'Test User',
        timestamp: new Date().toISOString(),
      },
    },
    prodDeploy: {
      state: 'success',
      description: 'Deployment succeeded',
      createdAt: new Date().toISOString(),
      deployUrl: 'https://poker-timer-black.vercel.app',
      sha: 'abc1234',
      commitMessage: 'test commit message',
    },
    testReport: {
      state: 'success',
      createdAt: new Date().toISOString(),
      reportUrl: 'https://test.report.url/allure',
      sha: 'abc1234',
    },
    allure: {
      passed: 10,
      failed: 1,
      broken: 0,
      skipped: 2,
      total: 13,
      startMs: Date.now() - 60000,
      durationMs: 5000,
    },
    codecov: {
      coverage: 75.5,
      lines: 100,
      hits: 75,
      misses: 20,
      partials: 5,
      files: [
        { name: 'components/SettingsScreen.tsx', coverage: 31.4, lines: 226, hits: 71, misses: 132 },
      ],
    },
  };

  const mockSbUsage = {
    storage_size_bytes: 100 * 1024 * 1024,
    db_size_bytes: 50 * 1024 * 1024,
    today_cached_requests: 150,
    today_uncached_requests: 20,
  };

  async function openCiCdTab() {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('button', { name: 'CI/CD' }));
    return user;
  }

  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(ciData: unknown, sbData: unknown = {}) {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      const data = String(url).includes('ci-status') ? ciData : sbData;
      return Promise.resolve({ json: () => Promise.resolve(data) });
    }) as typeof global.fetch;
  }

  test('loading state shows "Загружаем…"', async () => {
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {})) as typeof global.fetch;
    await openCiCdTab();
    expect(screen.getByText('Загружаем…')).toBeInTheDocument();
  });

  test('error state from fetch shows error message', async () => {
    mockFetch({ error: 'Не удалось загрузить данные', testRun: null, prodDeploy: null, testReport: null, allure: null, codecov: null });

    await openCiCdTab();

    await waitFor(() => expect(screen.getByText('Не удалось загрузить данные')).toBeInTheDocument());
  });

  test('renders CI/CD cards when fetch resolves with full data', async () => {
    mockFetch(mockCiData, mockSbUsage);

    await openCiCdTab();

    await waitFor(() => expect(screen.getByText('GitHub CI')).toBeInTheDocument());
    expect(screen.getByText('Vercel deploy')).toBeInTheDocument();
    expect(screen.getByText('Allure Report')).toBeInTheDocument();
    expect(screen.getByText('Supabase Usage')).toBeInTheDocument();
    expect(screen.getByText('Codecov')).toBeInTheDocument();
  });

  test('renders "Нет данных" when prodDeploy and testRun are null', async () => {
    mockFetch({ testRun: null, prodDeploy: null, testReport: null, allure: null, codecov: null });

    await openCiCdTab();

    await waitFor(() => expect(screen.getAllByText('Нет данных').length).toBeGreaterThan(0));
  });

  test('clicking CI/CD tab twice triggers data refresh', async () => {
    const fetchMock = jest.fn().mockImplementation(() => new Promise(() => {}));
    global.fetch = fetchMock as typeof global.fetch;

    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('button', { name: 'CI/CD' }));
    await user.click(screen.getByRole('button', { name: 'CI/CD' }));

    // Each tab activation fires 2 fetches (ci-status + supabase-usage) = 4 total
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  test('Supabase Usage renders storage and DB progress bars', async () => {
    mockFetch(mockCiData, mockSbUsage);

    await openCiCdTab();

    await waitFor(() => expect(screen.getByText('Storage')).toBeInTheDocument());
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  test('Allure stats with failed/skipped entries are shown', async () => {
    mockFetch(mockCiData, mockSbUsage);

    await openCiCdTab();

    await waitFor(() => expect(screen.getByText(/passed/)).toBeInTheDocument());
    expect(screen.getByText(/failed/)).toBeInTheDocument();
    expect(screen.getByText(/skipped/)).toBeInTheDocument();
  });

  test('Codecov widget shows coverage percentage and file table', async () => {
    mockFetch(mockCiData, mockSbUsage);

    await openCiCdTab();

    await waitFor(() => expect(screen.getByText('75.5%')).toBeInTheDocument());
    expect(screen.getByText('SettingsScreen')).toBeInTheDocument();
  });

  test('StatusBadge in_progress and DeployBadge failure are rendered', async () => {
    const inProgressData = {
      ...mockCiData,
      testRun: { ...mockCiData.testRun, status: 'in_progress', conclusion: null },
      prodDeploy: { ...mockCiData.prodDeploy, state: 'failure' },
      allure: { ...mockCiData.allure, failed: 0 }, // avoid duplicate "✕ failed" text
    };
    mockFetch(inProgressData, mockSbUsage);

    await openCiCdTab();

    await waitFor(() => expect(screen.getByText('⟳ running')).toBeInTheDocument());
    expect(screen.getByText('✕ failed')).toBeInTheDocument();
  });

  test('StatusBadge queued and DeployBadge pending are rendered', async () => {
    const queuedData = {
      ...mockCiData,
      testRun: { ...mockCiData.testRun, status: 'queued', conclusion: null },
      prodDeploy: { ...mockCiData.prodDeploy, state: 'pending' },
    };
    mockFetch(queuedData, mockSbUsage);

    await openCiCdTab();

    await waitFor(() => expect(screen.getByText('· queued')).toBeInTheDocument());
    expect(screen.getByText('⟳ deploying')).toBeInTheDocument();
  });

  test('StatusBadge failure conclusion and no deployUrl fallback link', async () => {
    const failureData = {
      ...mockCiData,
      testRun: { ...mockCiData.testRun, status: 'completed', conclusion: 'failure' },
      prodDeploy: { ...mockCiData.prodDeploy, deployUrl: '', state: 'success' },
    };
    mockFetch(failureData, mockSbUsage);

    await openCiCdTab();

    await waitFor(() => expect(screen.getByText('✕ failure')).toBeInTheDocument());
    expect(screen.getByText('poker-timer-black.vercel.app →')).toBeInTheDocument();
  });
});
