const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

export function gameDateInBelgrade(iso: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso));
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

export function buildGameSlug(startedAtIso: string, takenSlugs: string[]): string {
  const { year, month, day } = gameDateInBelgrade(startedAtIso);
  const base = `${year}-${MONTHS[month - 1]}-${String(day).padStart(2, '0')}`;
  let sequence = 1;
  while (takenSlugs.includes(sequence === 1 ? base : `${base}-${sequence}`)) sequence += 1;
  return sequence === 1 ? base : `${base}-${sequence}`;
}
