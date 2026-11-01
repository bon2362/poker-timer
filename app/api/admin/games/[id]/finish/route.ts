import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getServiceClient } from '@/lib/supabase/service';
import { buildGameSlug } from '@/lib/games/slug';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const client = getServiceClient();
  const failed = () => NextResponse.json({ error: 'Could not finish game' }, { status: 500 });
  const { data: session, error: sessionError } = await client.from('sessions').select('*').eq('id', id).maybeSingle();
  if (sessionError) return failed();
  if (!session) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  if (session.status === 'finished' && session.slug) return NextResponse.json({ slug: session.slug });

  const { data: winner, error: winnerError } = await client.from('session_players').select('id').eq('session_id', id).eq('status', 'winner').maybeSingle();
  if (winnerError) return failed();
  if (!winner) return NextResponse.json({ error: 'Winner is required' }, { status: 409 });
  let slug = session.slug;
  if (!slug) {
    const { data: games, error: gamesError } = await client.from('sessions').select('slug').not('slug', 'is', null);
    if (gamesError || !games) return failed();
    slug = buildGameSlug(session.created_at, games.map((game: { slug: string }) => game.slug));
  }
  const { error } = await client.from('sessions').update({ status: 'finished', slug }).eq('id', id);
  if (error) return failed();
  return NextResponse.json({ slug });
}
