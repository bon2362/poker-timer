import { gameDate } from '@/components/games/format';
test('date precedes weekday and uses Belgrade time after UTC midnight boundary', () => {
  expect(gameDate('2026-05-10T22:30:00Z', true)).toBe('11 мая 2026, понедельник');
});
