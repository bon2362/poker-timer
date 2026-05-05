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
    maxRebuys: (row.max_rebuys as number) ?? 0,
    addonCost: row.addon_cost as number,
    addonChips: row.addon_chips as number,
    prizeSpots: row.prize_spots as number,
    prizePcts: row.prize_pcts as number[],
    numberOfTables: (row.number_of_tables as number | null) ?? 1,
    mergeThreshold: (row.merge_threshold as number | null) ?? 0,
    tablesMergedAt: (row.tables_merged_at as string | null) ?? null,
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
    tableNumber: (row.table_number as number | null) ?? 1,
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
  const { data: spData, error: spErr } = await client
    .from('session_players')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true });
  if (spErr) { console.error('fetchActiveSession session_players:', spErr); return null; }
  return { session, sessionPlayers: (spData ?? []).map(toSessionPlayer) };
}

export async function createSession(
  data: NewSessionData,
  playerIds: string[],
  playerTables?: Record<string, number>
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
      max_rebuys: data.maxRebuys,
      addon_cost: data.addonCost,
      addon_chips: data.addonChips,
      prize_spots: data.prizeSpots,
      prize_pcts: data.prizePcts,
      number_of_tables: data.numberOfTables,
      merge_threshold: data.mergeThreshold,
      tables_merged_at: data.tablesMergedAt,
      status: 'active',
    })
    .select()
    .single();
  if (sessionErr || !sessionRow) { console.error('createSession:', sessionErr); return null; }
  const session = toSession(sessionRow);
  const { data: spRows, error: spErr } = await client
    .from('session_players')
    .insert(playerIds.map(pid => ({
      session_id: session.id,
      player_id: pid,
      table_number: data.numberOfTables === 2 ? (playerTables?.[pid] ?? 1) : 1,
    })))
    .select();
  if (spErr) { console.error('createSession session_players:', spErr); return null; }
  return { session, sessionPlayers: (spRows ?? []).map(toSessionPlayer) };
}

export async function updateSessionPlayer(
  id: string,
  updates: Partial<Pick<SessionPlayer, 'rebuys' | 'hasAddon' | 'status' | 'finishPosition' | 'eliminatedAt' | 'tableNumber'>>
): Promise<SessionPlayer | null> {
  const client = getClient();
  if (!client) return null;
  const dbUpdates: Record<string, unknown> = {};
  if (updates.rebuys !== undefined) dbUpdates.rebuys = updates.rebuys;
  if (updates.hasAddon !== undefined) dbUpdates.has_addon = updates.hasAddon;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.finishPosition !== undefined) dbUpdates.finish_position = updates.finishPosition;
  if (updates.eliminatedAt !== undefined) dbUpdates.eliminated_at = updates.eliminatedAt;
  if (updates.tableNumber !== undefined) dbUpdates.table_number = updates.tableNumber;
  const { data, error } = await client
    .from('session_players')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('updateSessionPlayer:', error); return null; }
  return toSessionPlayer(data);
}

export async function mergeTables(sessionId: string): Promise<Session | null> {
  const client = getClient();
  if (!client) return null;
  const { data, error } = await client.rpc('merge_tables', { p_session_id: sessionId });
  if (error) { console.error('mergeTables:', error); return null; }
  return data ? toSession(data as Record<string, unknown>) : null;
}

export async function finishSession(id: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const { error } = await client.from('sessions').update({ status: 'finished' }).eq('id', id);
  if (error) { console.error('finishSession:', error); return false; }
  return true;
}
