import { gameDate, plural } from '@/components/games/format';
test('date precedes weekday and uses Belgrade time after UTC midnight boundary', () => {
  expect(gameDate('2026-05-10T22:30:00Z', true)).toBe('11 мая 2026, понедельник');
});
test('count labels use the correct Russian form', () => {
  const games: [string, string, string] = ['игра', 'игры', 'игр'];
  expect([1, 2, 5, 11, 21, 22, 112].map(count => plural(count, games))).toEqual(['1 игра', '2 игры', '5 игр', '11 игр', '21 игра', '22 игры', '112 игр']);
});
