import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getServiceClient } from '@/lib/supabase/service';
import { buildGameSlug } from '@/lib/games/slug';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(); if (denied) return denied;
  const { id } = await params; const client = getServiceClient();
  const { data: session } = await client.from('sessions').select('*').eq('id', id).single();
  const { data: winner } = await client.from('session_players').select('id').eq('session_id', id).eq('status', 'winner').maybeSingle();
  if (!session || !winner) return NextResponse.json({ error: 'Winner is required' }, { status: 409 });
  const { data: games } = await client.from('sessions').select('slug').not('slug', 'is', null);
  const slug = buildGameSlug(session.created_at, (games ?? []).map((game: { slug: string }) => game.slug));
  const { error } = await client.from('sessions').update({ status: 'finished', slug }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not finish game' }, { status: 500 });
  return NextResponse.json({ slug });
}
