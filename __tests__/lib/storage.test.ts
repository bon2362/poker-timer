import { loadConfig, saveConfig, DEFAULT_CONFIG } from '@/lib/storage';
import type { Config } from '@/types/timer';

const mockConfig: Config = {
  ...DEFAULT_CONFIG,
  levelDuration: 15,
  breakDuration: 5,
};

beforeEach(() => {
  localStorage.clear();
});

describe('loadConfig', () => {
  test('returns DEFAULT_CONFIG when localStorage is empty', () => {
    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  test('returns parsed config when present in localStorage', () => {
    localStorage.setItem('pokerTimerConfig', JSON.stringify(mockConfig));
    const config = loadConfig();
    expect(config.levelDuration).toBe(15);
    expect(config.breakDuration).toBe(5);
  });

  test('returns DEFAULT_CONFIG on invalid JSON', () => {
    localStorage.setItem('pokerTimerConfig', 'not-json{{{');
    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

describe('saveConfig', () => {
  test('writes config to localStorage', () => {
    saveConfig(mockConfig);
    const raw = localStorage.getItem('pokerTimerConfig');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.levelDuration).toBe(15);
  });

  test('overwrites previous config', () => {
    saveConfig(mockConfig);
    saveConfig({ ...mockConfig, levelDuration: 30 });
    const parsed = JSON.parse(localStorage.getItem('pokerTimerConfig')!);
    expect(parsed.levelDuration).toBe(30);
  });
});
