import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CiCdTab, DisplayTab, TournamentTab } from '@/components/SettingsScreen';
import type { Config } from '@/types/timer';
import { DEFAULT_CONFIG } from '@/lib/storage';

// Mock heavy sub-components that use contexts/Supabase
jest.mock('@/components/SessionSetup/SessionSetup', () => ({
  SessionSetup: () => <div data-testid="session-setup">SessionSetup</div>,
}));

jest.mock('@/lib/supabase/slideshow', () => ({
  listSlideshowPhotos: jest.fn().mockResolvedValue([]),
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

type HarnessProps = { config: Config; onSave: (c: Config) => void; onDisplaySave: (c: Config) => void };
// Same tab order as /admin: each tab is rendered by the real component.
function Harness({ config, onSave, onDisplaySave }: HarnessProps) {
  const [tab, setTab] = useState('tournament');
  const [refreshKey, setRefreshKey] = useState(0);
  const open = (next: string) => { if (next === 'cicd' && tab === 'cicd') setRefreshKey(key => key + 1); else setTab(next); };
  return <>
    <button onClick={() => open('tournament')}>Турнир</button>
    <button onClick={() => open('display')}>Оформление</button>
    <button onClick={() => open('cicd')}>CI/CD</button>
    {tab === 'tournament' && <TournamentTab config={config} onSave={onSave} />}
    {tab === 'display' && <DisplayTab config={config} onDisplaySave={onDisplaySave} />}
    {tab === 'cicd' && <CiCdTab refreshKey={refreshKey} />}
  </>;
}
function renderSettings(props: Partial<HarnessProps> = {}) {
  return render(<Harness config={DEFAULT_CONFIG} onSave={jest.fn()} onDisplaySave={jest.fn()} {...props} />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SettingsScreen — Tournament tab content', () => {

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
});

describe('SettingsScreen — Tournament tab reset', () => {
  test('clicking "сбросить к умолчаниям" resets blinds to DEFAULT_CONFIG', async () => {
    const user = userEvent.setup();
    const modifiedConfig = {
      ...DEFAULT_CONFIG,
      levelDuration: 99,
      blindLevels: [{ sb: 999, bb: 1998 }],
    };
    renderSettings({ config: modifiedConfig });

    // Modified config values are visible
    expect(screen.getAllByDisplayValue('999').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'сбросить к умолчаниям' }));

    // After reset, DEFAULT_CONFIG first blind sb=10 should appear
    await waitFor(() => expect(screen.getAllByDisplayValue('10').length).toBeGreaterThan(0));
  });
});
