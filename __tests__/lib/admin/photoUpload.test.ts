import { uploadPhoto } from '@/lib/admin/photoUpload';
import { resizeContain } from '@/lib/imageResize';
jest.mock('@/lib/imageResize', () => ({ resizeContain: jest.fn(), resizeCover: jest.fn() }));
test('HEIC fails with a clear error before any resize or network call', async () => {
  await expect(uploadPhoto(new File(['x'], 'test.HEIC', { type: 'image/heic' }), 'game', jest.fn())).rejects.toThrow('Не удалось загрузить: формат HEIC не поддерживается');
  expect(resizeContain).not.toHaveBeenCalled();
});
