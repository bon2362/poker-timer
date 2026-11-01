import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { playerId, kind, path, thumbPath } = await request.json();
  if (!playerId || !['winner', 'loser'].includes(kind) || !path) return NextResponse.json({ error: 'Invalid image' }, { status: 400 });
  const client = getServiceClient();
  const { data: previous, error: readError } = await client.from('player_images').select('id').eq('player_id', playerId).eq('kind', kind).eq('is_current', true).maybeSingle();
  if (readError) return NextResponse.json({ error: 'Could not read current image' }, { status: 500 });
  if (previous) {
    const { error } = await client.from('player_images').update({ is_current: false }).eq('id', previous.id);
    if (error) return NextResponse.json({ error: 'Could not replace image' }, { status: 500 });
  }
  const { data, error } = await client.from('player_images').insert({ player_id: playerId, kind, path, thumb_path: thumbPath ?? null, is_current: true }).select().single();
  if (error) {
    if (previous) await client.from('player_images').update({ is_current: true }).eq('id', previous.id);
    return NextResponse.json({ error: 'Could not save image' }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { playerId, kind } = await request.json();
  if (!playerId || !['winner', 'loser'].includes(kind)) return NextResponse.json({ error: 'Invalid image' }, { status: 400 });
  const client = getServiceClient();
  const { data: current, error: readError } = await client.from('player_images').select('id,path,thumb_path').eq('player_id', playerId).eq('kind', kind).eq('is_current', true).maybeSingle();
  if (readError) return NextResponse.json({ error: 'Could not read current image' }, { status: 500 });
  if (!current) return NextResponse.json({ ok: true });
  const { error: updateError } = await client.from('player_images').update({ is_current: false }).eq('id', current.id);
  if (updateError) return NextResponse.json({ error: 'Could not remove current image' }, { status: 500 });
  const { count, error: referenceError } = await client.from('session_players').select('id', { count: 'exact', head: true }).or(`winner_image_id.eq.${current.id},loser_image_id.eq.${current.id}`);
  if (referenceError || count === null) return NextResponse.json({ error: 'Could not check image references' }, { status: 500 });
  if (count === 0) {
    const paths = [...new Set([current.path, current.thumb_path].filter((path): path is string => Boolean(path)))];
    const { error } = await client.storage.from('avatars').remove(paths);
    if (error) return NextResponse.json({ error: 'Could not delete image files' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
