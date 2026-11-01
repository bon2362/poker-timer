export const number = (value: number) => value.toLocaleString('ru-RU');
export function gameDate(iso: string, weekday = false): string {
  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Belgrade', day: 'numeric', month: 'long', year: 'numeric' }).format(date).replace(' г.', '');
  return weekday ? `${formatted}, ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Belgrade', weekday: 'long' }).format(date)}` : formatted;
}
export function gameTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Belgrade', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
export const headingClass = 'font-[family-name:var(--font-game-serif)]';
