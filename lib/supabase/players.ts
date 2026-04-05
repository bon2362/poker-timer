// lib/supabase/players.ts
import { getClient } from '@/supabase/client';
import type { Player } from '@/types/game';

function toPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    name: row.name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function fetchPlayers(): Promise<Player[]> {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client
    .from('players')
    .select('*')
    .order('created_at');
  if (error) { console.error('fetchPlayers:', error); return []; }
  return (data ?? []).map(toPlayer);
}

export async function createPlayer(name: string): Promise<Player | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client
    .from('players')
    .insert({ name })
    .select()
    .single();
  if (error) { console.error('createPlayer:', error); return null; }
  return toPlayer(data);
}

export async function updatePlayer(id: string, updates: Partial<Pick<Player, 'name' | 'avatarUrl'>>): Promise<Player | null> {
  const client = getClient();
  if (!client) return null;
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
  const { data, error } = await client
    .from('players')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('updatePlayer:', error); return null; }
  return toPlayer(data);
}

export async function deletePlayer(id: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  const { error } = await client.from('players').delete().eq('id', id);
  if (error) console.error('deletePlayer:', error);
}
