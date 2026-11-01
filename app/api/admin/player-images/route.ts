import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const { playerId, kind, path, thumbPath } = await request.json();
  if (!playerId || !['winner', 'loser'].includes(kind) || !path) return NextResponse.json({ error: 'Invalid image' }, { status: 400 });
  const client = getServiceClient();
  await client.from('player_images').update({ is_current: false }).eq('player_id', playerId).eq('kind', kind).eq('is_current', true);
  const { data, error } = await client.from('player_images').insert({ player_id: playerId, kind, path, thumb_path: thumbPath ?? null, is_current: true }).select().single();
  if (error) return NextResponse.json({ error: 'Could not save image' }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const { playerId, kind } = await request.json();
  const client = getServiceClient();
  await client.from('player_images').update({ is_current: false }).eq('player_id', playerId).eq('kind', kind).eq('is_current', true);
  return NextResponse.json({ ok: true });
}
