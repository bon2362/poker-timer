import type { Session, SessionPlayer } from '@/types/game';
export type AdminPhoto = { id: string; session_id: string | null; path: string; thumb_path: string | null; taken_at: string | null; width: number | null; height: number | null };
export type AdminGame = { session: Session; players: SessionPlayer[]; names: Record<string, string>; photoCount: number };
export type SavedImage = { id: string; path: string; thumb_path: string | null };
export function storageUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}` : '/poker-timer-favicon/favicon.svg';
}
export const money = (value: number) => new Intl.NumberFormat('ru-RU').format(value).replace(/\u00a0/g, ' ');
export function gameDate(iso: string) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Belgrade', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)).replace(' г.', '');
}
