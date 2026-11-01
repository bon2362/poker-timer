/** @jest-environment node */
import { NextRequest } from 'next/server';
import { PATCH as results } from '@/app/api/admin/games/[id]/results/route';
import { PATCH as images } from '@/app/api/admin/games/[id]/images/route';
import { DELETE as remove } from '@/app/api/admin/games/[id]/route';
const mockAuth = jest.fn();
const mockClient = jest.fn();
jest.mock('@/lib/admin/requireAdmin', () => ({ requireAdmin: () => mockAuth() }));
jest.mock('@/lib/supabase/service', () => ({ getServiceClient: () => mockClient() }));
const context = { params: Promise.resolve({ id: 'game' }) };
const request = (body: unknown) => new NextRequest('http://localhost/api/admin/games/game', { method: 'PATCH', body: JSON.stringify(body) });
beforeEach(() => { jest.clearAllMocks(); mockAuth.mockResolvedValue(null); });
test.each([results, images, remove])('rejects unauthenticated writes without touching the database', async route => {
  mockAuth.mockResolvedValue(new Response(null, { status: 401 }));
  expect((await route(request({}), context)).status).toBe(401);
  expect(mockClient).not.toHaveBeenCalled();
});
test.each([[[1, 1, 3]], [[1, 3]], [[]]])('rejects invalid positions %j before any writes', async positions => {
  expect((await results(request({ players: positions.map((finishPosition, i) => ({ id: `p${i}`, finishPosition, rebuys: 0, hasAddon: false })) }), context)).status).toBe(400);
  expect(mockClient).not.toHaveBeenCalled();
});
test('saves all edited results through one transactional function and keeps the slug untouched', async () => {
  const rpc = jest.fn().mockResolvedValue({ data: [{ payout: 1500 }, { payout: 1500 }], error: null });
  mockClient.mockReturnValue({ rpc });
  const players = [1, 2].map((finishPosition, i) => ({ id: `p${i}`, finishPosition, rebuys: i, hasAddon: false }));
  const response = await results(request({ players }), context);
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('update_game_history_results', { p_session_id: 'game', p_players: players });
  expect(await response.json()).toEqual({ players: [{ payout: 1500 }, { payout: 1500 }] });
});
test('returns a Russian validation error from the transactional function', async () => {
  mockClient.mockReturnValue({ rpc: jest.fn().mockResolvedValue({ error: { code: '22023' } }) });
  const response = await results(request({ players: [{ id: 'p', finishPosition: 1, rebuys: 8, hasAddon: false }] }), context);
  expect(response.status).toBe(400);
  expect((await response.json()).error).toMatch(/Не удалось|Проверьте/);
});
test('deletes the game atomically while the database preserves photos in the unassigned pool', async () => {
  const rpc = jest.fn().mockResolvedValue({ error: null }); mockClient.mockReturnValue({ rpc });
  expect((await remove(request({}), context)).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('delete_game_history', { p_session_id: 'game' });
});
test('replaces only a historical snapshot through its dedicated transaction', async () => {
  const rpc = jest.fn().mockResolvedValue({ data: { id: 'new' }, error: null }); mockClient.mockReturnValue({ rpc });
  expect((await images(request({ sessionPlayerId: 'sp', kind: 'winner', path: 'uploads/a.jpg', thumbPath: 'uploads/b.jpg' }), context)).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('replace_game_history_image', expect.objectContaining({ p_session_id: 'game', p_kind: 'winner' }));
});
