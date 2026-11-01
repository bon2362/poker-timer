import { buildGameSlug, gameDateInBelgrade } from '@/lib/games/slug';

describe('game slugs', () => {
  test('uses the Belgrade calendar date and increments duplicate addresses', () => {
    expect(buildGameSlug('2026-11-01T19:00:00Z', [])).toBe('2026-november-01');
    expect(buildGameSlug('2026-11-01T19:00:00Z', ['2026-november-01'])).toBe('2026-november-01-2');
    expect(buildGameSlug('2026-11-01T19:00:00Z', ['2026-november-01', '2026-november-01-2'])).toBe('2026-november-01-3');
    expect(buildGameSlug('2026-10-31T23:30:00Z', [])).toBe('2026-november-01');
    expect(gameDateInBelgrade('2026-10-31T23:30:00Z')).toEqual({ year: 2026, month: 11, day: 1 });
  });
});
