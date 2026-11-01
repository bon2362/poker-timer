import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { apiError, rpcError } from '@/lib/admin/api';
import { getServiceClient } from '@/lib/supabase/service';
import { validateResultPositions } from '@/lib/games/results';
export const dynamic = 'force-dynamic';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(); if (denied) return denied;
  try {
    const { players } = await request.json();
    if (!Array.isArray(players) || !validateResultPositions(players.map(p => p?.finishPosition)) || players.some(p => typeof p.id !== 'string' || !Number.isInteger(p.rebuys) || p.rebuys < 0 || typeof p.hasAddon !== 'boolean') || new Set(players.map(p => p.id)).size !== players.length) return apiError('Проверьте места, ребаи и состав игры.', 400);
    const { id } = await context.params;
    const { data, error } = await getServiceClient().rpc('update_game_history_results', { p_session_id: id, p_players: players });
    if (error) return rpcError(error);
    return NextResponse.json({ players: data });
  } catch { return apiError('Не удалось сохранить результаты. Попробуйте ещё раз.', 400); }
}
