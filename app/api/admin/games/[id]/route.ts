import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { apiError } from '@/lib/admin/api';
import { getServiceClient } from '@/lib/supabase/service';
export const dynamic = 'force-dynamic';
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(); if (denied) return denied;
  try {
    const { id } = await context.params;
    const { error } = await getServiceClient().rpc('delete_game_history', { p_session_id: id });
    if (error) return apiError('Не удалось удалить игру. Фото сохранены. Попробуйте ещё раз.');
    return NextResponse.json({ ok: true });
  } catch { return apiError('Не удалось удалить игру. Попробуйте ещё раз.'); }
}
