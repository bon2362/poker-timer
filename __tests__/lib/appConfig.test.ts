import { DEFAULT_CONFIG } from '@/lib/storage';
import {
  fetchAppConfig,
  normalizeConfig,
  saveAppConfig,
} from '@/lib/supabase/appConfig';

jest.mock('@/supabase/client', () => ({
  getClient: jest.fn(),
}));

import { getClient } from '@/supabase/client';

const mockGetClient = getClient as jest.Mock;

describe('normalizeConfig', () => {
  test('merges persisted partial config with defaults', () => {
    const config = normalizeConfig({ breakSongEnabled: true, slideshowSpeed: 9 });
    expect(config).toEqual(expect.objectContaining({
      ...DEFAULT_CONFIG,
      breakSongEnabled: true,
      slideshowSpeed: 9,
    }));
  });

  test('returns null for invalid values', () => {
    expect(normalizeConfig(null)).toBeNull();
    expect(normalizeConfig('bad')).toBeNull();
  });
});

describe('fetchAppConfig', () => {
  beforeEach(() => {
    mockGetClient.mockReset();
  });

  test('returns null without Supabase client', async () => {
    mockGetClient.mockReturnValue(null);
    await expect(fetchAppConfig()).resolves.toBeNull();
  });

  test('fetches and normalizes app_config', async () => {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { config_json: { breakSongEnabled: true } },
      error: null,
    });
    const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockSelect = jest.fn(() => ({ eq: mockEq }));
    const mockFrom = jest.fn(() => ({ select: mockSelect }));
    mockGetClient.mockReturnValue({ from: mockFrom });

    const config = await fetchAppConfig();

    expect(mockFrom).toHaveBeenCalledWith('app_config');
    expect(config).toEqual(expect.objectContaining({
      breakSongEnabled: true,
      levelDuration: DEFAULT_CONFIG.levelDuration,
    }));
  });
});

describe('saveAppConfig', () => {
  beforeEach(() => {
    mockGetClient.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns early without Supabase client', async () => {
    mockGetClient.mockReturnValue(null);
    await expect(saveAppConfig(DEFAULT_CONFIG)).resolves.toBeUndefined();
  });

  test('uses set_app_config RPC when available', async () => {
    const mockRpc = jest.fn().mockResolvedValue({ error: null });
    const mockFrom = jest.fn();
    mockGetClient.mockReturnValue({ rpc: mockRpc, from: mockFrom });

    await saveAppConfig(DEFAULT_CONFIG);

    expect(mockRpc).toHaveBeenCalledWith('set_app_config', {
      config_json_arg: DEFAULT_CONFIG,
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

    await saveAppConfig(DEFAULT_CONFIG);

    expect(mockFrom).toHaveBeenCalledWith('app_config');
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'main',
      config_json: DEFAULT_CONFIG,
    }));
    expect(console.warn).not.toHaveBeenCalled();
  });
});
