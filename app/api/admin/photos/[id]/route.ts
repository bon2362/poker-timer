import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { apiError } from '@/lib/admin/api';
import { getServiceClient } from '@/lib/supabase/service';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  try {
    const { sessionId } = await request.json();
    if (sessionId !== null && (typeof sessionId !== 'string' || !sessionId)) return apiError('Выберите игру.', 400);
    const client = getServiceClient();
    if (sessionId !== null) {
      const { data, error } = await client.from('sessions').select('id').eq('id', sessionId).eq('status', 'finished').maybeSingle();
      if (error || !data) return apiError('Завершённая игра не найдена.', 400);
    }
    const { id } = await context.params;
    const { data, error } = await client.from('game_photos').update({ session_id: sessionId }).eq('id', id).select().maybeSingle();
    if (error) return apiError('Не удалось перенести фото. Попробуйте ещё раз.');
    if (!data) return apiError('Фото не найдено.', 404);
    return NextResponse.json(data);
  } catch { return apiError('Не удалось перенести фото. Попробуйте ещё раз.'); }
}
export async function DELETE(_request: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  try {
    const { id } = await context.params; const client = getServiceClient();
    const { data: photo, error: readError } = await client.from('game_photos').select('*').eq('id', id).maybeSingle();
    if (readError) return apiError('Не удалось прочитать фото. Попробуйте ещё раз.');
    if (!photo) return apiError('Фото не найдено.', 404);
    const paths = [...new Set([photo.path, photo.thumb_path].filter((path): path is string => Boolean(path)))];
    const bucket = client.storage.from('slideshow');
    // Storage and Postgres cannot share a transaction. Keep temporary copies so a failed
    // database deletion can restore the files while retaining the original record.
    const backups = await Promise.all(paths.map(async path => ({ path, ...await bucket.download(path) })));
    if (backups.some(file => file.error || !file.data)) return apiError('Не удалось прочитать файлы фото. Удаление отменено.');
    async function restore() {
      const restored = await Promise.all(backups.map(file => bucket.upload(file.path, file.data!, { upsert: true, contentType: file.data!.type || 'image/jpeg' })));
      return restored.every(result => !result.error);
    }
    const removed = await bucket.remove(paths);
    if (removed.error) { const restored = await restore(); return apiError(restored ? 'Не удалось удалить файлы фото. Попробуйте ещё раз.' : 'Не удалось восстановить файлы фото после ошибки. Обратитесь к администратору.'); }
    const { error } = await client.from('game_photos').delete().eq('id', id);
    if (error) { const restored = await restore(); return apiError(restored ? 'Не удалось удалить фото. Файлы восстановлены; попробуйте ещё раз.' : 'Не удалось восстановить файлы фото после ошибки. Обратитесь к администратору.'); }
    return NextResponse.json({ ok: true });
  } catch { return apiError('Не удалось удалить фото. Попробуйте ещё раз.'); }
}
