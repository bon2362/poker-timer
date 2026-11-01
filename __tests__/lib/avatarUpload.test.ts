import { getClient } from '@/supabase/client';
import { uploadAvatar } from '@/lib/supabase/storage';
import { uploadToSignedPath } from '@/lib/supabase/signedUpload';

jest.mock('@/supabase/client', () => ({ getClient: jest.fn() }));
jest.mock('@/lib/supabase/signedUpload', () => ({ uploadToSignedPath: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (getClient as jest.Mock).mockReturnValue({ storage: { from: () => ({
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
    upload: async () => ({ error: null }),
  }) } });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ uploads: [{ path: 'uploads/new-avatar.jpg', token: 'signed' }] }) });
  (uploadToSignedPath as jest.Mock).mockResolvedValue(true);
});

test('avatar uses the signed server path and forwards real upload progress', async () => {
  const progress = jest.fn();
  const blob = new Blob(['photo']);
  const upload = uploadAvatar as (id: string, blob: Blob, progress?: (percent: number) => void) => Promise<string | null>;
  expect(await upload('p1', blob, progress)).toBe('https://storage.test/uploads/new-avatar.jpg');
  expect(uploadToSignedPath).toHaveBeenCalledWith('avatars', 'uploads/new-avatar.jpg', 'signed', blob, progress);
  expect(fetch).toHaveBeenCalledWith('/api/admin/uploads/sign', expect.objectContaining({ method: 'POST' }));
});

test('returns null if signing the avatar fails', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
  expect(await uploadAvatar('p1', new Blob(['photo']))).toBeNull();
  expect(uploadToSignedPath).not.toHaveBeenCalled();
});
