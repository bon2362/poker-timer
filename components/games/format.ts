export const number = (value: number) => value.toLocaleString('ru-RU');
export function plural(count: number, [one, few, many]: [string, string, string]): string {
  const tens = count % 100; const units = count % 10;
  const word = tens >= 11 && tens <= 14 ? many : units === 1 ? one : units >= 2 && units <= 4 ? few : many;
  return `${count} ${word}`;
}
export function gameDate(iso: string, weekday = false): string {
  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Belgrade', day: 'numeric', month: 'long', year: 'numeric' }).format(date).replace(' г.', '');
  return weekday ? `${formatted}, ${new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Belgrade', weekday: 'long' }).format(date)}` : formatted;
}
export function gameTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Belgrade', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
export function gameDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} ч ${String(minutes % 60).padStart(2, '0')} мин` : `${minutes} мин`;
}
export const headingClass = 'font-[family-name:var(--font-game-serif)]';
