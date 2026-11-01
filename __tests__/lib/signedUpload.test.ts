import { getClient } from '@/supabase/client';
import { uploadToSignedPath } from '@/lib/supabase/signedUpload';

jest.mock('@/supabase/client', () => ({ getClient: jest.fn() }));

test('uploads with XHR and reports transferred bytes rather than synthetic completion', async () => {
  const xhr = {
    open: jest.fn(), setRequestHeader: jest.fn(), send: jest.fn(),
    upload: { onprogress: null as null | ((event: ProgressEvent) => void) },
    onload: null as null | (() => void), onerror: null as null | (() => void), status: 200,
  };
  const xhrConstructor = jest.spyOn(global, 'XMLHttpRequest').mockImplementation(() => xhr as unknown as XMLHttpRequest);
  (getClient as jest.Mock).mockReturnValue({ storage: { from: () => ({
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/storage/v1/object/public/avatars/${path}` } }),
    uploadToSignedUrl: jest.fn(async () => ({ error: null })),
  }) } });
  const progress = jest.fn();
  try {
    const pending = uploadToSignedPath('avatars', 'special/winner/p1/new.jpg', 'a+b', new Blob(['photo']), progress);
    expect(xhr.open).toHaveBeenCalledWith('PUT', 'https://storage.test/storage/v1/object/upload/sign/avatars/special/winner/p1/new.jpg?token=a%2Bb');
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 } as ProgressEvent);
    expect(progress).toHaveBeenLastCalledWith(25);
    expect(progress).not.toHaveBeenCalledWith(100);
    xhr.onload?.();
    expect(await pending).toBe(true);
    expect(progress).toHaveBeenLastCalledWith(100);
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('x-upsert', 'false');
  } finally { xhrConstructor.mockRestore(); }
});
