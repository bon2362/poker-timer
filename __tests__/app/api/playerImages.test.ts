/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server';
import { POST, DELETE } from '@/app/api/admin/player-images/route';
import { POST as sign } from '@/app/api/admin/uploads/sign/route';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getServiceClient } from '@/lib/supabase/service';

jest.mock('@/lib/admin/requireAdmin', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ getServiceClient: jest.fn() }));

type ImageRow = { id: string; player_id: string; kind: string; path: string; thumb_path: string | null; is_current: boolean };
let images: ImageRow[];
let references: { winner_image_id: string | null; loser_image_id: string | null }[];
let insertFails: boolean;
let referencesFail: boolean;
const removed: string[] = [];
const signedPaths: string[] = [];

// A stateful database substitute verifies image records and history after each operation.
function from(table: string) {
  let operation = 'select';
  let values: Partial<ImageRow> = {};
  const filters: [string, unknown][] = [];
  let referenceFilter = '';
  const run = () => {
    if (table === 'session_players') {
      if (referencesFail) return { data: null, count: null, error: { message: 'unavailable' } };
      const ids = referenceFilter.split(',').map(part => part.split('.eq.')[1]);
      return { data: [], count: references.filter(row => ids.includes(row.winner_image_id ?? '') || ids.includes(row.loser_image_id ?? '')).length, error: null };
    }
    const matching = images.filter(row => filters.every(([key, value]) => row[key as keyof ImageRow] === value));
    if (operation === 'update') matching.forEach(row => Object.assign(row, values));
    if (operation === 'insert') {
      if (insertFails) return { data: null, error: { message: 'insert failed' } };
      const row = { id: 'new-image', ...values } as ImageRow;
      images.push(row);
      return { data: row, error: null };
    }
    return { data: matching, error: null };
  };
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
    or: jest.fn((filter: string) => { referenceFilter = filter; return query; }),
    update: jest.fn((value: Partial<ImageRow>) => { operation = 'update'; values = value; return query; }),
    insert: jest.fn((value: Partial<ImageRow>) => { operation = 'insert'; values = value; return query; }),
    maybeSingle: async () => { const result = run(); return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data }; },
    single: async () => { const result = run(); return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data }; },
    then: (resolve: (value: ReturnType<typeof run>) => unknown) => Promise.resolve(run()).then(resolve),
  };
  return query;
}

function request(method: string, body: object) {
  return new NextRequest('http://localhost/api/admin/player-images', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}
const imageBody = { playerId: 'p1', kind: 'winner', path: 'special/winner/p1/22222222-2222-4222-8222-222222222222.jpg', thumbPath: 'special/winner/p1/33333333-3333-4333-8333-333333333333.jpg' };

beforeEach(() => {
  jest.clearAllMocks();
  images = [{ id: 'old-image', player_id: 'p1', kind: 'winner', path: 'special/winner/p1/old.jpg', thumb_path: 'special/winner/p1/old-thumb.jpg', is_current: true }];
  references = [{ winner_image_id: 'old-image', loser_image_id: null }];
  insertFails = false; referencesFail = false; removed.length = 0; signedPaths.length = 0;
  (requireAdmin as jest.Mock).mockResolvedValue(null);
  (getServiceClient as jest.Mock).mockReturnValue({ from, storage: { from: () => ({
    remove: async (paths: string[]) => { removed.push(...paths); return { error: null }; },
    createSignedUploadUrl: async (path: string) => { signedPaths.push(path); return { data: { token: 'signed-token' }, error: null }; },
  }) } });
});

test('POST creates a new version without changing the image referenced by history', async () => {
  const historicalPath = images[0].path;
  expect((await POST(request('POST', imageBody))).status).toBe(200);
  expect(images.find(row => row.is_current)?.path).toBe(imageBody.path);
  expect(images.find(row => row.id === references[0].winner_image_id)?.path).toBe(historicalPath);
  expect(removed).toEqual([]);
});

test('failed POST restores the previous current image', async () => {
  insertFails = true;
  expect((await POST(request('POST', imageBody))).status).toBe(500);
  expect(images.find(row => row.is_current)?.id).toBe('old-image');
});

test('DELETE unsets current but keeps files referenced by a session', async () => {
  expect((await DELETE(request('DELETE', { playerId: 'p1', kind: 'winner' }))).status).toBe(200);
  expect(images[0].is_current).toBe(false);
  expect(removed).toEqual([]);
});

test('DELETE removes unreferenced full and thumbnail files', async () => {
  references = [];
  expect((await DELETE(request('DELETE', { playerId: 'p1', kind: 'winner' }))).status).toBe(200);
  expect(removed).toEqual(['special/winner/p1/old.jpg', 'special/winner/p1/old-thumb.jpg']);
});

test('DELETE retains files when references cannot be checked', async () => {
  referencesFail = true;
  expect((await DELETE(request('DELETE', { playerId: 'p1', kind: 'winner' }))).status).toBe(500);
  expect(removed).toEqual([]);
});

test('signer creates distinct server-generated special paths and ignores supplied paths', async () => {
  const body = { bucket: 'avatars', playerId: 'p1', kind: 'winner', files: [{ name: 'full.jpg', path: 'old.jpg' }, { name: 'thumb.jpg' }] };
  expect((await sign(request('POST', body))).status).toBe(200);
  expect(signedPaths).toHaveLength(2);
  expect(new Set(signedPaths).size).toBe(2);
  signedPaths.forEach(path => expect(path).toMatch(/^special\/winner\/p1\/[a-f0-9-]{36}\.jpg$/));
});

test('all image writes reject requests without an admin cookie', async () => {
  (requireAdmin as jest.Mock).mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
  expect((await POST(request('POST', imageBody))).status).toBe(401);
  expect((await DELETE(request('DELETE', imageBody))).status).toBe(401);
  expect((await sign(request('POST', { bucket: 'avatars', files: [] }))).status).toBe(401);
  expect(getServiceClient).not.toHaveBeenCalled();
});
