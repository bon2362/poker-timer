import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { apiError, rpcError, validUploadPath } from '@/lib/admin/api';
import { getServiceClient } from '@/lib/supabase/service';
export const dynamic = 'force-dynamic';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(); if (denied) return denied;
  try {
    const { sessionPlayerId, kind, path, thumbPath } = await request.json();
    if (typeof sessionPlayerId !== 'string' || !['winner', 'loser'].includes(kind) || !validUploadPath(path) || !validUploadPath(thumbPath)) return apiError('Не удалось сохранить картинку: неверные данные.', 400);
    const { id } = await context.params;
    const { data, error } = await getServiceClient().rpc('replace_game_history_image', { p_session_id: id, p_session_player_id: sessionPlayerId, p_kind: kind, p_path: path, p_thumb_path: thumbPath });
    if (error) return rpcError(error);
    return NextResponse.json(data);
  } catch { return apiError('Не удалось заменить картинку. Попробуйте ещё раз.'); }
}
