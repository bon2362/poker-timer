import { getClient } from '@/supabase/client';
import { getSpecialImageUrl, getSpecialThumbUrl, uploadSpecialImage, deleteSpecialImage } from '@/lib/supabase/imageVariants';
import { uploadToSignedPath } from '@/lib/supabase/signedUpload';

jest.mock('@/supabase/client', () => ({ getClient: jest.fn() }));
jest.mock('@/lib/supabase/signedUpload', () => ({ uploadToSignedPath: jest.fn() }));
jest.mock('@/lib/imageResize', () => ({
  resizeContain: jest.fn(async (blob: Blob) => blob),
  resizeCover: jest.fn(async (blob: Blob) => blob),
}));

const oldImage = { id: 'old-image', path: 'special/winner/p1/old.jpg', thumb_path: 'special/winner/p1/old-thumb.jpg' };
let current: typeof oldImage | null;
const fetchMock = jest.fn();
const directUpload = jest.fn();
const directRemove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  current = { ...oldImage };
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn(async () => ({ data: current })) };
  (getClient as jest.Mock).mockReturnValue({
    from: jest.fn(() => query),
    storage: { from: jest.fn(() => ({
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
      list: jest.fn(async () => ({ data: [] })), upload: directUpload, remove: directRemove,
    })) },
  });
  global.fetch = fetchMock;
  (uploadToSignedPath as jest.Mock).mockResolvedValue(true);
});

test('reads current image and thumbnail without changing stored files', async () => {
  expect(await getSpecialImageUrl('winner', 'p1')).toBe(`https://storage.test/${oldImage.path}`);
  expect(await getSpecialThumbUrl('winner', 'p1')).toBe(`https://storage.test/${oldImage.thumb_path}`);
  expect(directUpload).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('new upload switches current image but leaves the historical image path unchanged', async () => {
  const historyReference = { image: { ...oldImage } };
  const uploads = [
    { path: 'special/winner/p1/new.jpg', token: 'full-token' },
    { path: 'special/winner/p1/new-thumb.jpg', token: 'thumb-token' },
  ];
  fetchMock.mockImplementation(async (url, options) => {
    if (url === '/api/admin/uploads/sign') return { ok: true, json: async () => ({ uploads }) };
    const body = JSON.parse(options.body);
    current = { id: 'new-image', path: body.path, thumb_path: body.thumbPath };
    return { ok: true, json: async () => current };
  });
  const file = new File(['photo'], 'winner.jpg', { type: 'image/jpeg' });
  expect(await uploadSpecialImage('winner', 'p1', file)).toBe('https://storage.test/special/winner/p1/new.jpg');
  expect(await getSpecialImageUrl('winner', 'p1')).toBe('https://storage.test/special/winner/p1/new.jpg');
  expect(historyReference.image).toEqual(oldImage);
  expect(uploadToSignedPath).toHaveBeenCalledWith('avatars', uploads[0].path, uploads[0].token, expect.any(Blob));
  expect(fetchMock).toHaveBeenCalledWith('/api/admin/player-images', expect.objectContaining({ method: 'POST' }));
  expect(directUpload).not.toHaveBeenCalled();
});

test('does not register a failed upload', async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ uploads: [{ path: 'new.jpg', token: 'a' }, { path: 'thumb.jpg', token: 'b' }] }) });
  (uploadToSignedPath as jest.Mock).mockResolvedValue(false);
  expect(await uploadSpecialImage('winner', 'p1', new File(['x'], 'x.jpg'))).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('requests deletion through the admin endpoint rather than deleting storage directly', async () => {
  fetchMock.mockResolvedValue({ ok: true });
  await deleteSpecialImage('winner', 'p1');
  expect(fetchMock).toHaveBeenCalledWith('/api/admin/player-images', expect.objectContaining({ method: 'DELETE' }));
  expect(directRemove).not.toHaveBeenCalled();
});

test('returns null when no current image exists', async () => {
  current = null;
  await expect(getSpecialImageUrl('winner', 'p1')).resolves.toBeNull();
});
