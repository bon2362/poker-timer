// lib/supabase/sessions.ts
import { getClient } from '@/supabase/client';
import type { Session, SessionPlayer, NewSessionData } from '@/types/game';

function toSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    buyIn: row.buy_in as number,
    initialStack: row.initial_stack as number,
    rebuyCost: row.rebuy_cost as number,
    rebuyChips: row.rebuy_chips as number,
    addonCost: row.addon_cost as number,
    addonChips: row.addon_chips as number,
    prizeSpots: row.prize_spots as number,
    prizePcts: row.prize_pcts as number[],
    status: row.status as Session['status'],
    createdAt: row.created_at as string,
  };
}

function toSessionPlayer(row: Record<string, unknown>): SessionPlayer {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    playerId: row.player_id as string,
    rebuys: row.rebuys as number,
    hasAddon: row.has_addon as boolean,
    status: row.status as SessionPlayer['status'],
    finishPosition: row.finish_position as number | null,
    eliminatedAt: row.eliminated_at as string | null,
  };
}

export async function fetchActiveSession(): Promise<{ session: Session; sessionPlayers: SessionPlayer[] } | null> {
  const client = getClient();
  if (!client) return null;
  const { data: sessionData } = await client
    .from('sessions')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sessionData) return null;
  const session = toSession(sessionData);
  const { data: spData } = await client
    .from('session_players')
    .select('*')
    .eq('session_id', session.id);
  return { session, sessionPlayers: (spData ?? []).map(toSessionPlayer) };
}

export async function createSession(
  data: NewSessionData,
  playerIds: string[]
): Promise<{ session: Session; sessionPlayers: SessionPlayer[] } | null> {
  const client = getClient();
  if (!client) return null;
  const { data: sessionRow, error: sessionErr } = await client
    .from('sessions')
    .insert({
      buy_in: data.buyIn,
      initial_stack: data.initialStack,
      rebuy_cost: data.rebuyCost,
      rebuy_chips: data.rebuyChips,
      addon_cost: data.addonCost,
      addon_chips: data.addonChips,
      prize_spots: data.prizeSpots,
      prize_pcts: data.prizePcts,
      status: 'active',
    })
    .select()
    .single();
  if (sessionErr || !sessionRow) { console.error('createSession:', sessionErr); return null; }
  const session = toSession(sessionRow);
  const { data: spRows, error: spErr } = await client
    .from('session_players')
    .insert(playerIds.map(pid => ({ session_id: session.id, player_id: pid })))
    .select();
  if (spErr) { console.error('createSession session_players:', spErr); return null; }
  return { session, sessionPlayers: (spRows ?? []).map(toSessionPlayer) };
}

export async function updateSessionPlayer(
  id: string,
  updates: Partial<Pick<SessionPlayer, 'rebuys' | 'hasAddon' | 'status' | 'finishPosition' | 'eliminatedAt'>>
): Promise<SessionPlayer | null> {
  const client = getClient();
  if (!client) return null;
  const dbUpdates: Record<string, unknown> = {};
  if (updates.rebuys !== undefined) dbUpdates.rebuys = updates.rebuys;
  if (updates.hasAddon !== undefined) dbUpdates.has_addon = updates.hasAddon;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.finishPosition !== undefined) dbUpdates.finish_position = updates.finishPosition;
  if (updates.eliminatedAt !== undefined) dbUpdates.eliminated_at = updates.eliminatedAt;
  const { data, error } = await client
    .from('session_players')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('updateSessionPlayer:', error); return null; }
  return toSessionPlayer(data);
}

export async function finishSession(id: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.from('sessions').update({ status: 'finished' }).eq('id', id);
}
