import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getServiceClient } from '@/lib/supabase/service';
import { assignPayouts } from '@/lib/games/results';
import { toSession, toSessionPlayer } from '@/lib/supabase/sessions';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const { sessionPlayerId } = await request.json();
  const client = getServiceClient();
  const failed = () => NextResponse.json({ error: 'Could not declare winner' }, { status: 500 });

  const { data: sessionRow, error: sessionError } = await client.from('sessions').select('*').eq('id', id).maybeSingle();
  if (sessionError) return failed();
  if (!sessionRow) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  const { data: rows, error: playersError } = await client.from('session_players').select('*').eq('session_id', id);
  if (playersError || !rows) return failed();
  const session = toSession(sessionRow);
  const players = rows.map(toSessionPlayer);
  const winner = players.find(player => player.id === sessionPlayerId);
  if (!winner) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  if (players.some(player => player.status === 'winner' && player.id !== winner.id)) {
    return NextResponse.json({ error: 'A different winner has already been declared' }, { status: 409 });
  }
  if (winner.status === 'winner' && session.finishedAt) return NextResponse.json({ sessionPlayers: rows });

  // On a retry, retain the image captured when the winner was first saved.
  let imageId = winner.winnerImageId ?? null;
  if (winner.status !== 'winner') {
    const { data: image, error: imageError } = await client.from('player_images').select('id').eq('player_id', winner.playerId).eq('kind', 'winner').eq('is_current', true).maybeSingle();
    if (imageError) return failed();
    imageId = image?.id ?? null;
  }
  const payouts = assignPayouts(session, players.map(player => player.id === winner.id ? { ...player, finishPosition: 1 } : player));
  const payoutResults = await Promise.all(payouts.map(({ id: playerId, payout }) => client.from('session_players').update({ payout }).eq('id', playerId)));
  if (payoutResults.some(result => result.error)) return failed();

  const { data, error } = await client.from('session_players').update({ status: 'winner', finish_position: 1, winner_image_id: imageId }).eq('id', sessionPlayerId).select('*');
  if (error || !data?.length) return failed();
  if (!session.finishedAt) {
    const { error: finishError } = await client.from('sessions').update({ finished_at: new Date().toISOString() }).eq('id', id).is('finished_at', null);
    if (finishError) return failed();
  }
  return NextResponse.json({ sessionPlayers: data });
}
