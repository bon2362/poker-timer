/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST as declareWinner } from '@/app/api/admin/games/[id]/declare-winner/route';
import { POST as finishGame } from '@/app/api/admin/games/[id]/finish/route';

const mockRequireAdmin = jest.fn();
const mockGetServiceClient = jest.fn();
jest.mock('@/lib/admin/requireAdmin', () => ({ requireAdmin: () => mockRequireAdmin() }));
jest.mock('@/lib/supabase/service', () => ({ getServiceClient: () => mockGetServiceClient() }));

const session = {
  id: 's1', created_at: '2026-11-01T19:00:00Z', status: 'active', slug: null, finished_at: null,
  buy_in: 1000, rebuy_cost: 1000, addon_cost: 1000, prize_spots: 1, prize_pcts: [100],
};
const player = {
  id: 'sp1', session_id: 's1', player_id: 'p1', rebuys: 0, has_addon: false,
  status: 'playing', finish_position: null, winner_image_id: null, payout: null,
};
const winner = { ...player, status: 'winner', finish_position: 1, winner_image_id: 'original-image', payout: 1000 };
const params = { params: Promise.resolve({ id: 's1' }) };
function request(body: unknown = { sessionPlayerId: 'sp1' }) {
  return new NextRequest('http://localhost/api/admin/games/s1', { method: 'POST', body: JSON.stringify(body) });
}
type Result = { data?: unknown; error?: { message: string } | null };
const ok = (data: unknown = null): Result => ({ data, error: null });
const failure: Result = { data: null, error: { message: 'Database unavailable' } };

// Only the external database transport is replaced; route decisions and payouts are real.
function database(results: Result[]) {
  const writes: { table: string; values: Record<string, unknown> }[] = [];
  const from = jest.fn((table: string) => {
    const result = results.shift();
    if (!result) throw new Error(`Unexpected database query: ${table}`);
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'not', 'is', 'single', 'maybeSingle']) query[method] = () => query;
    query.update = (values: Record<string, unknown>) => { writes.push({ table, values }); return query; };
    query.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
    return query;
  });
  mockGetServiceClient.mockReturnValue({ from });
  return { writes };
}
beforeEach(() => { jest.clearAllMocks(); mockRequireAdmin.mockResolvedValue(null); });

test.each([declareWinner, finishGame])('rejects requests without an admin cookie', async route => {
  mockRequireAdmin.mockResolvedValue(new Response(null, { status: 401 }));
  expect((await route(request(), params)).status).toBe(401);
  expect(mockGetServiceClient).not.toHaveBeenCalled();
});

test.each([
  ['game read', [failure]],
  ['players read', [ok(session), failure]],
  ['image read', [ok(session), ok([player]), failure]],
  ['payout write', [ok(session), ok([player]), ok({ id: 'image' }), failure]],
  ['winner write', [ok(session), ok([player]), ok({ id: 'image' }), ok(), failure]],
  ['finish time write', [ok(session), ok([player]), ok({ id: 'image' }), ok(), ok([winner]), failure]],
] as [string, Result[]][])('declare-winner returns 500 when %s fails', async (_, results) => {
  database([...results]);
  expect((await declareWinner(request(), params)).status).toBe(500);
});

test('declare-winner persists payouts, image and finish time before reporting success', async () => {
  const db = database([ok(session), ok([player]), ok({ id: 'image' }), ok(), ok([winner]), ok()]);
  const response = await declareWinner(request(), params);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sessionPlayers: [winner] });
  expect(db.writes).toEqual([
    { table: 'session_players', values: { payout: 1000 } },
    { table: 'session_players', values: { status: 'winner', finish_position: 1, winner_image_id: 'image' } },
    { table: 'sessions', values: { finished_at: expect.any(String) } },
  ]);
});

test('repeated declaration returns the saved winner without changing finish time or image', async () => {
  const db = database([ok({ ...session, finished_at: '2026-11-01T23:00:00Z' }), ok([winner])]);
  const response = await declareWinner(request(), params);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sessionPlayers: [winner] });
  expect(db.writes).toEqual([]);
});

test('retry after finish-time failure keeps the saved winner image', async () => {
  const db = database([ok(session), ok([winner]), ok(), ok([winner]), ok()]);
  expect((await declareWinner(request(), params)).status).toBe(200);
  expect(db.writes.find(write => write.values.status === 'winner')?.values.winner_image_id).toBe('original-image');
});

test('cannot replace an already declared winner', async () => {
  const db = database([ok(session), ok([winner, { ...player, id: 'sp2' }])]);
  expect((await declareWinner(request({ sessionPlayerId: 'sp2' }), params)).status).toBe(409);
  expect(db.writes).toEqual([]);
});

test('finish keeps the existing slug when called again', async () => {
  const db = database([ok({ ...session, status: 'finished', slug: '2026-november-01' })]);
  const response = await finishGame(request(), params);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ slug: '2026-november-01' });
  expect(db.writes).toEqual([]);
});

test('finish preserves an assigned slug while completing an active game', async () => {
  const db = database([ok({ ...session, slug: 'custom-existing-slug' }), ok({ id: 'sp1' }), ok()]);
  const response = await finishGame(request(), params);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ slug: 'custom-existing-slug' });
  expect(db.writes).toEqual([{ table: 'sessions', values: { status: 'finished', slug: 'custom-existing-slug' } }]);
});

test.each([
  ['game read', [failure]],
  ['winner read', [ok(session), failure]],
  ['slug read', [ok(session), ok({ id: 'sp1' }), failure]],
  ['finish write', [ok(session), ok({ id: 'sp1' }), ok([]), failure]],
] as [string, Result[]][])('finish returns 500 when %s fails', async (_, results) => {
  database([...results]);
  expect((await finishGame(request(), params)).status).toBe(500);
});

test('finish chooses a new slug only when no slug was assigned', async () => {
  const db = database([ok(session), ok({ id: 'sp1' }), ok([{ slug: '2026-november-01' }]), ok()]);
  const response = await finishGame(request(), params);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ slug: '2026-november-01-2' });
  expect(db.writes).toEqual([{ table: 'sessions', values: { status: 'finished', slug: '2026-november-01-2' } }]);
});
