import {
  fetchMinuteTimerState,
  saveMinuteTimerState,
} from '@/lib/supabase/minuteTimerState';

jest.mock('@/supabase/client', () => ({
  getClient: jest.fn(),
}));

import { getClient } from '@/supabase/client';

const mockGetClient = getClient as jest.Mock;

describe('fetchMinuteTimerState', () => {
  beforeEach(() => {
    mockGetClient.mockReset();
  });

  test('returns null without Supabase client', async () => {
    mockGetClient.mockReturnValue(null);
    await expect(fetchMinuteTimerState()).resolves.toBeNull();
  });

  test('fetches minute_timer_state row', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        active: true,
        player_name: 'Alice',
        player_id: 'p-1',
        end_ts: 12345,
      },
      error: null,
    });
    const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockSelect = jest.fn(() => ({ eq: mockEq }));
    const mockFrom = jest.fn(() => ({ select: mockSelect }));
    mockGetClient.mockReturnValue({ from: mockFrom });

    await expect(fetchMinuteTimerState()).resolves.toEqual({
      active: true,
      playerName: 'Alice',
      playerId: 'p-1',
      endTs: 12345,
    });
  });
});

describe('saveMinuteTimerState', () => {
  beforeEach(() => {
    mockGetClient.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses set_minute_timer_state RPC when available', async () => {
    const mockRpc = jest.fn().mockResolvedValue({ error: null });
    const mockFrom = jest.fn();
    mockGetClient.mockReturnValue({ rpc: mockRpc, from: mockFrom });

    await saveMinuteTimerState({
      active: true,
      playerName: 'Alice',
      playerId: 'p-1',
      endTs: 12345,
    });

    expect(mockRpc).toHaveBeenCalledWith('set_minute_timer_state', {
      active_arg: true,
      player_name_arg: 'Alice',
      player_id_arg: 'p-1',
      end_ts_arg: 12345,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('falls back to upsert when RPC fails', async () => {
    const mockRpc = jest.fn().mockResolvedValue({ error: { message: 'missing rpc' } });
    const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { id: 'main' }, error: null });
    const mockSelect = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockUpsert = jest.fn(() => ({ select: mockSelect }));
    const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));
    mockGetClient.mockReturnValue({ rpc: mockRpc, from: mockFrom });

    await saveMinuteTimerState({
      active: false,
      playerName: '',
      playerId: '',
      endTs: 0,
    });

    expect(mockFrom).toHaveBeenCalledWith('minute_timer_state');
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'main',
      active: false,
      end_ts: 0,
    }));
  });
});
