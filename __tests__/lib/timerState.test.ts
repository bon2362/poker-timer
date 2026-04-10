import { isPersistedTimerStateStaleForSession, parsePersistedStages } from '@/lib/supabase/timerState';

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
});

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
});
