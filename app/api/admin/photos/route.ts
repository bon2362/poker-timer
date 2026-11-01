import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { apiError, validUploadPath } from '@/lib/admin/api';
import { getServiceClient } from '@/lib/supabase/service';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  try {
    const offset = Number(request.nextUrl.searchParams.get('offset') ?? 0);
    if (!Number.isInteger(offset) || offset < 0) return apiError('Некорректная страница фото.', 400);
    let query = getServiceClient().from('game_photos').select('*', { count: 'exact' }).order('taken_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false });
    if (request.nextUrl.searchParams.get('unassigned') === '1') query = query.is('session_id', null);
    else { const sessionId = request.nextUrl.searchParams.get('sessionId'); if (!sessionId) return apiError('Выберите игру.', 400); query = query.eq('session_id', sessionId); }
    const { data, count, error } = await query.range(offset, offset + 47);
    return error ? apiError('Не удалось загрузить фото. Попробуйте ещё раз.') : NextResponse.json({ photos: data ?? [], total: count ?? 0 });
  } catch { return apiError('Не удалось загрузить фото. Попробуйте ещё раз.'); }
}
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  try {
    const { sessionId, path, thumbPath, width, height, takenAt } = await request.json();
    if (typeof sessionId !== 'string' || !sessionId || !validUploadPath(path) || !validUploadPath(thumbPath) || !Number.isInteger(width) || width < 1 || width > 1920 || !Number.isInteger(height) || height < 1 || height > 1920 || typeof takenAt !== 'string' || !Number.isFinite(Date.parse(takenAt))) return apiError('Не удалось добавить фото: проверьте игру и файл.', 400);
    const client = getServiceClient(); const bucket = client.storage.from('slideshow');
    const { data: game, error: readError } = await client.from('sessions').select('id,status').eq('id', sessionId).eq('status', 'finished').maybeSingle();
    if (readError || !game) return apiError('Игра не найдена или ещё не завершена.', 400);
    for (const file of [path, thumbPath]) {
      const index = file.lastIndexOf('/');
      const { data, error } = await bucket.list(file.slice(0, index), { search: file.slice(index + 1), limit: 2 });
      if (error || !data?.some(item => item.name === file.slice(index + 1))) return apiError('Не удалось загрузить оба файла фото. Повторите загрузку.', 400);
    }
    const { data, error } = await client.from('game_photos').insert({ session_id: sessionId, path, thumb_path: thumbPath, width, height, taken_at: takenAt }).select().single();
    if (error) {
      // A previous request may have committed even if its response was lost.
      // Never remove files referenced by any already saved photo.
      const references = await client.from('game_photos').select('*').or(`path.in.(${path},${thumbPath}),thumb_path.in.(${path},${thumbPath})`);
      if (references.error || !references.data) return apiError('Не удалось проверить сохранение фото. Обновите страницу перед повтором.');
      const existing = references.data.find(photo => photo.path === path && photo.thumb_path === thumbPath && photo.session_id === sessionId);
      if (existing) return NextResponse.json(existing);
      const used = new Set(references.data.flatMap(photo => [photo.path, photo.thumb_path]));
      const unused = [path, thumbPath].filter(file => !used.has(file));
      const cleanup = unused.length ? await bucket.remove(unused) : { error: null };
      return apiError(cleanup.error ? 'Не удалось сохранить фото и убрать загруженные файлы. Повторите попытку.' : 'Не удалось сохранить фото. Повторите загрузку.');
    }
    return NextResponse.json(data);
  } catch { return apiError('Не удалось сохранить фото. Попробуйте ещё раз.'); }
}
