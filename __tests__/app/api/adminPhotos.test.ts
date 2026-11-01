/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/photos/route';
import { PATCH, DELETE } from '@/app/api/admin/photos/[id]/route';
const mockAuth = jest.fn(); const mockClient = jest.fn();
jest.mock('@/lib/admin/requireAdmin', () => ({ requireAdmin: () => mockAuth() }));
jest.mock('@/lib/supabase/service', () => ({ getServiceClient: () => mockClient() }));
const request = (body: unknown = {}) => new NextRequest('http://localhost/api/admin/photos', { method: 'POST', body: JSON.stringify(body) });
const context = { params: Promise.resolve({ id: 'photo' }) };
beforeEach(() => { jest.clearAllMocks(); mockAuth.mockResolvedValue(null); });
test.each([GET, POST, PATCH, DELETE])('requires an admin cookie', async route => {
  mockAuth.mockResolvedValue(new Response(null, { status: 401 }));
  expect((await route(request(), context)).status).toBe(401); expect(mockClient).not.toHaveBeenCalled();
});
function database(rows: unknown[]) {
  const writes: unknown[] = []; const reads: unknown[] = [];
  const from = jest.fn((table: string) => {
    const result = rows.shift(); const q: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'single', 'maybeSingle', 'order', 'limit', 'or']) q[m] = () => q;
    q.range = (start: number, end: number) => { reads.push([start, end]); return q; };
    for (const m of ['insert', 'update', 'delete']) q[m] = (values: unknown) => { writes.push({ table, method: m, values }); return q; };
    q.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve); return q;
  });
  const remove = jest.fn().mockResolvedValue({ error: null });
  const download = jest.fn().mockResolvedValue({ data: new Blob(['image']), error: null });
  const upload = jest.fn().mockResolvedValue({ error: null });
  const list = jest.fn().mockResolvedValue({ data: [{ name: 'a.jpg' }, { name: 'b.jpg' }], error: null });
  const bucket = { remove, download, upload, list };
  mockClient.mockReturnValue({ from, storage: { from: () => bucket } });
  return { writes, reads, remove, upload };
}
test('pages the unassigned pool instead of loading all photos', async () => {
  const db = database([{ data: [], count: 369, error: null }]);
  const response = await GET(new NextRequest('http://localhost/api/admin/photos?unassigned=1&offset=48'));
  expect(response.status).toBe(200); expect(db.reads).toEqual([[48, 95]]);
});
test('new photos require a finished game; unassigned uploads are rejected', async () => {
  expect((await POST(request({ sessionId: null, path: 'uploads/a.jpg' }))).status).toBe(400);
  expect(mockClient).not.toHaveBeenCalled();
});
test('failed metadata creation never adds a carousel record and cleans uploaded files', async () => {
  const db = database([{ data: { id: 's', status: 'finished' } }, { error: { message: 'db' } }, { data: [], error: null }]);
  const response = await POST(request({ sessionId: 's', path: 'uploads/a.jpg', thumbPath: 'uploads/b.jpg', width: 100, height: 100, takenAt: '2026-01-01T00:00:00Z' }));
  expect(response.status).toBe(500); expect(db.remove).toHaveBeenCalledWith(['uploads/a.jpg', 'uploads/b.jpg']);
});
test('deletes both files and the photo record', async () => {
  const db = database([{ data: { id: 'photo', path: 'full.jpg', thumb_path: 'thumb.jpg' }, error: null }, { error: null }]);
  expect((await DELETE(request(), context)).status).toBe(200);
  expect(db.remove).toHaveBeenCalledWith(['full.jpg', 'thumb.jpg']);
  expect(db.writes).toContainEqual({ table: 'game_photos', method: 'delete', values: undefined });
});
test('storage failure is visible and keeps the photo record', async () => {
  const db = database([{ data: { id: 'photo', path: 'full.jpg', thumb_path: null }, error: null }]);
  db.remove.mockResolvedValue({ error: { message: 'storage unavailable' } });
  const response = await DELETE(request(), context);
  expect(response.status).toBe(500); expect((await response.json()).error).toMatch(/файл/);
  expect(db.writes).toEqual([]);
});
test('database deletion failure restores the files', async () => {
  const db = database([{ data: { id: 'photo', path: 'full.jpg', thumb_path: 'thumb.jpg' }, error: null }, { error: { message: 'db' } }]);
  expect((await DELETE(request(), context)).status).toBe(500);
  expect(db.upload).toHaveBeenCalledTimes(2);
});

test('retry after a lost success response never deletes already registered files', async () => {
  const photo = { id: 'saved', session_id: 's', path: 'uploads/a.jpg', thumb_path: 'uploads/b.jpg' };
  const db = database([{ data: { id: 's', status: 'finished' } }, { error: { code: '23505' } }, { data: [photo], error: null }]);
  const response = await POST(request({ sessionId: 's', path: photo.path, thumbPath: photo.thumb_path, width: 100, height: 100, takenAt: '2026-01-01T00:00:00Z' }));
  expect(response.status).toBe(200); expect(await response.json()).toEqual(photo); expect(db.remove).not.toHaveBeenCalled();
});
