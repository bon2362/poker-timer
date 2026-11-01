import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getServiceClient } from '@/lib/supabase/service';
import { assignPayouts } from '@/lib/games/results';
import { toSession, toSessionPlayer } from '@/lib/supabase/sessions';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(); if (denied) return denied;
  const { id } = await params; const { sessionPlayerId } = await request.json(); const client = getServiceClient();
  const { data: sessionRow } = await client.from('sessions').select('*').eq('id', id).single();
  const { data: rows } = await client.from('session_players').select('*').eq('session_id', id);
  if (!sessionRow || !rows) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  const session = toSession(sessionRow); const players = rows.map(toSessionPlayer);
  const winner = players.find(player => player.id === sessionPlayerId); if (!winner) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  const { data: image } = await client.from('player_images').select('id').eq('player_id', winner.playerId).eq('kind', 'winner').eq('is_current', true).maybeSingle();
  const payouts = assignPayouts(session, players.map(player => player.id === winner.id ? { ...player, finishPosition: 1 } : player));
  await Promise.all(payouts.map(({ id: playerId, payout }) => client.from('session_players').update({ payout }).eq('id', playerId)));
  const { data, error } = await client.from('session_players').update({ status: 'winner', finish_position: 1, winner_image_id: image?.id ?? null }).eq('id', sessionPlayerId).select('*');
  await client.from('sessions').update({ finished_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not declare winner' }, { status: 500 });
  return NextResponse.json({ sessionPlayers: data });
}
