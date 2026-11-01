import { fetchPlayers, deletePlayer } from '@/lib/supabase/players';
import { updateSessionPlayer } from '@/lib/supabase/sessions';
import { getClient } from '@/supabase/client';

jest.mock('@/supabase/client', () => ({ getClient: jest.fn() }));

const query = {
  select: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getClient as jest.Mock).mockReturnValue({ from: jest.fn(() => query) });
  query.eq.mockReturnValue(query);
});

test('fetchPlayers excludes archived records', async () => {
  query.order.mockResolvedValue({ data: [{ id: 'p-1', name: 'Alice', created_at: '', archived_at: null }], error: null });
  expect(await fetchPlayers()).toEqual([expect.objectContaining({ id: 'p-1', archivedAt: null })]);
  expect(query.is).toHaveBeenCalledWith('archived_at', null);
});

test('deletePlayer archives the record without deleting it', async () => {
  query.eq.mockResolvedValue({ error: null });
  await deletePlayer('p-1');
  expect(query.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
  expect(Number.isNaN(Date.parse(query.update.mock.calls[0][0].archived_at))).toBe(false);
  expect(query.eq).toHaveBeenCalledWith('id', 'p-1');
  expect(query.delete).not.toHaveBeenCalled();
});

test.each(['loser-image', null])('updateSessionPlayer persists loserImageId %s', async imageId => {
  query.single.mockResolvedValue({ data: { id: 'sp-1', loser_image_id: imageId }, error: null });
  await updateSessionPlayer('sp-1', { loserImageId: imageId });
  expect(query.update).toHaveBeenCalledWith({ loser_image_id: imageId });
});
