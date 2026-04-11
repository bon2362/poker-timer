import {
  isPersistedTimerStateStaleForSession,
  parsePersistedStages,
  fetchTimerState,
  saveTimerState,
  type PersistedTimerState,
} from '@/lib/supabase/timerState';

jest.mock('@/supabase/client', () => ({
  getClient: jest.fn(),
}));

import { getClient } from '@/supabase/client';
const mockGetClient = getClient as jest.Mock;

// ---------------------------------------------------------------------------
// parsePersistedStages
// ---------------------------------------------------------------------------

describe('parsePersistedStages', () => {
  test('parses valid persisted stage JSON', () => {
    const stages = parsePersistedStages([
      { type: 'level', levelNum: 1, sb: 10, bb: 20, duration: 1200 },
      { type: 'break', duration: 600 },
    ]);

    expect(stages).toEqual([
      { type: 'level', levelNum: 1, sb: 10, bb: 20, duration: 1200 },
      { type: 'break', duration: 600 },
    ]);
  });

  test('rejects invalid persisted stage JSON', () => {
    expect(parsePersistedStages([{ type: 'level', levelNum: 1, sb: 10, duration: 1200 }])).toBeUndefined();
    expect(parsePersistedStages([{ type: 'break', duration: 0 }])).toBeUndefined();
  });

  test('returns undefined for unknown stage type', () => {
    expect(parsePersistedStages([{ type: 'unknown', duration: 100 }])).toBeUndefined();
  });

  test('returns undefined for empty array', () => {
    expect(parsePersistedStages([])).toBeUndefined();
  });

  test('returns undefined for non-array values', () => {
    expect(parsePersistedStages(null)).toBeUndefined();
    expect(parsePersistedStages('string')).toBeUndefined();
    expect(parsePersistedStages({})).toBeUndefined();
    expect(parsePersistedStages(42)).toBeUndefined();
  });

  test('returns undefined for non-object items in array', () => {
    expect(parsePersistedStages([null])).toBeUndefined();
    expect(parsePersistedStages(['string'])).toBeUndefined();
    expect(parsePersistedStages([42])).toBeUndefined();
  });

  test('returns undefined for invalid duration (NaN)', () => {
    expect(parsePersistedStages([{ type: 'break', duration: 'bad' }])).toBeUndefined();
  });

  test('returns undefined for negative duration', () => {
    expect(parsePersistedStages([{ type: 'break', duration: -10 }])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isPersistedTimerStateStaleForSession
// ---------------------------------------------------------------------------

describe('isPersistedTimerStateStaleForSession', () => {
  test('detects timer state older than the active session', () => {
    expect(isPersistedTimerStateStaleForSession(
      '2026-04-10T22:05:51.179684+00:00',
      '2026-04-10T22:15:00.000000+00:00'
    )).toBe(true);
  });

  test('keeps timer state from the current active session', () => {
    expect(isPersistedTimerStateStaleForSession(
      '2026-04-10T22:20:00.000000+00:00',
      '2026-04-10T22:15:00.000000+00:00'
    )).toBe(false);
  });

  test('returns false when both arguments are undefined', () => {
    expect(isPersistedTimerStateStaleForSession(undefined, undefined)).toBe(false);
  });

  test('returns false when timerUpdatedAt is undefined', () => {
    expect(isPersistedTimerStateStaleForSession(undefined, '2026-04-10T22:15:00.000000+00:00')).toBe(false);
  });

  test('returns false when sessionCreatedAt is undefined', () => {
    expect(isPersistedTimerStateStaleForSession('2026-04-10T22:15:00.000000+00:00', undefined)).toBe(false);
  });

  test('returns false for invalid date strings', () => {
    expect(isPersistedTimerStateStaleForSession('not-a-date', 'also-not-a-date')).toBe(false);
    expect(isPersistedTimerStateStaleForSession('2026-04-10T22:00:00Z', 'not-a-date')).toBe(false);
    expect(isPersistedTimerStateStaleForSession('not-a-date', '2026-04-10T22:00:00Z')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fetchTimerState
// ---------------------------------------------------------------------------

describe('fetchTimerState', () => {
  beforeEach(() => {
    mockGetClient.mockReset();
  });

  test('returns null when getClient returns null (no Supabase config)', async () => {
    mockGetClient.mockReturnValue(null);
    const result = await fetchTimerState();
    expect(result).toBeNull();
  });

  test('returns null when client returns an error', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockSelect = jest.fn(() => ({ eq: mockEq }));
    const mockFrom = jest.fn(() => ({ select: mockSelect }));
    mockGetClient.mockReturnValue({ from: mockFrom, rpc: jest.fn() });

    const result = await fetchTimerState();
    expect(result).toBeNull();
  });

  test('returns null when client returns null data (no row)', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockSelect = jest.fn(() => ({ eq: mockEq }));
    const mockFrom = jest.fn(() => ({ select: mockSelect }));
    mockGetClient.mockReturnValue({ from: mockFrom, rpc: jest.fn() });

    const result = await fetchTimerState();
    expect(result).toBeNull();
  });

  test('maps DB row to PersistedTimerState on success', async () => {
    const dbRow = {
      current_stage: 2,
      anchor_ts: 1700000000000,
      elapsed_before_pause: 300,
      is_paused: false,
      is_over: false,
      warned_one_min: true,
      stage_type: 'level',
      level_num: 3,
      sb: 30,
      bb: 60,
      stage_duration_secs: 1200,
      stages_json: [{ type: 'level', levelNum: 3, sb: 30, bb: 60, duration: 1200 }],
      updated_at: '2026-04-11T10:00:00.000Z',
    };

    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: dbRow, error: null });
    const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockSelect = jest.fn(() => ({ eq: mockEq }));
    const mockFrom = jest.fn(() => ({ select: mockSelect }));
    mockGetClient.mockReturnValue({ from: mockFrom, rpc: jest.fn() });

    const result = await fetchTimerState();

    expect(result).not.toBeNull();
    expect(result!.currentStage).toBe(2);
    expect(result!.anchorTs).toBe(1700000000000);
    expect(result!.elapsedBeforePause).toBe(300);
    expect(result!.isPaused).toBe(false);
    expect(result!.isOver).toBe(false);
    expect(result!.warnedOneMin).toBe(true);
    expect(result!.stageType).toBe('level');
    expect(result!.levelNum).toBe(3);
    expect(result!.sb).toBe(30);
    expect(result!.bb).toBe(60);
    expect(result!.stageDurationSecs).toBe(1200);
    expect(result!.stages).toEqual([{ type: 'level', levelNum: 3, sb: 30, bb: 60, duration: 1200 }]);
    expect(result!.updatedAt).toBe('2026-04-11T10:00:00.000Z');
  });

  test('maps stage_type "break" correctly', async () => {
    const dbRow = {
      current_stage: 1,
      anchor_ts: 0,
      elapsed_before_pause: 0,
      is_paused: true,
      is_over: false,
      warned_one_min: false,
      stage_type: 'break',
      level_num: 0,
      sb: 0,
      bb: 0,
      stage_duration_secs: 600,
      stages_json: null,
      updated_at: null,
    };

    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: dbRow, error: null });
    const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockSelect = jest.fn(() => ({ eq: mockEq }));
    const mockFrom = jest.fn(() => ({ select: mockSelect }));
    mockGetClient.mockReturnValue({ from: mockFrom, rpc: jest.fn() });

    const result = await fetchTimerState();
    expect(result!.stageType).toBe('break');
    expect(result!.stages).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// saveTimerState
// ---------------------------------------------------------------------------

const baseState: PersistedTimerState = {
  currentStage: 1,
  anchorTs: 1700000000000,
  elapsedBeforePause: 0,
  isPaused: false,
  isOver: false,
  warnedOneMin: false,
  stageType: 'level',
  levelNum: 1,
  sb: 10,
  bb: 20,
  stageDurationSecs: 1200,
};

describe('saveTimerState', () => {
  beforeEach(() => {
    mockGetClient.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns early without error when getClient returns null', async () => {
    mockGetClient.mockReturnValue(null);
    await expect(saveTimerState(baseState)).resolves.toBeUndefined();
  });

  test('returns after successful RPC call without calling upsert', async () => {
    const mockRpc = jest.fn().mockResolvedValue({ error: null });
    const mockFrom = jest.fn();
    mockGetClient.mockReturnValue({ from: mockFrom, rpc: mockRpc });

    await saveTimerState(baseState);

    expect(mockRpc).toHaveBeenCalledWith('set_timer_state', expect.objectContaining({
      current_stage_arg: baseState.currentStage,
      is_paused_arg: baseState.isPaused,
    }));
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('falls back to upsert when RPC fails, and succeeds', async () => {
    const mockRpc = jest.fn().mockResolvedValue({ error: { message: 'rpc error' } });

    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { id: 'main' }, error: null });
    const mockSelectUpsert = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockUpsert = jest.fn(() => ({ select: mockSelectUpsert }));
    const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));

    mockGetClient.mockReturnValue({ from: mockFrom, rpc: mockRpc });

    await saveTimerState(baseState);

    expect(mockRpc).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('timer_state');
    expect(mockUpsert).toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('logs warning when RPC fails and upsert returns an error', async () => {
    const mockRpc = jest.fn().mockResolvedValue({ error: { message: 'rpc error' } });

    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'upsert error' } });
    const mockSelectUpsert = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockUpsert = jest.fn(() => ({ select: mockSelectUpsert }));
    const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));

    mockGetClient.mockReturnValue({ from: mockFrom, rpc: mockRpc });

    await saveTimerState(baseState);

    expect(console.warn).toHaveBeenCalledWith(
      'saveTimerState: failed to persist timer_state',
      'upsert error'
    );
  });

  test('logs warning when RPC fails and upsert returns no data row', async () => {
    const mockRpc = jest.fn().mockResolvedValue({ error: { message: 'rpc error' } });

    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockSelectUpsert = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockUpsert = jest.fn(() => ({ select: mockSelectUpsert }));
    const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));

    mockGetClient.mockReturnValue({ from: mockFrom, rpc: mockRpc });

    await saveTimerState(baseState);

    expect(console.warn).toHaveBeenCalledWith(
      'saveTimerState: timer_state write returned no row; check RLS or set_timer_state RPC'
    );
  });
});
