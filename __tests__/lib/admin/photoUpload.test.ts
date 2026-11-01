import { uploadPhoto } from '@/lib/admin/photoUpload';
import { resizeContain } from '@/lib/imageResize';
import { photoMonth, remainingLabel } from '@/lib/admin/types';
jest.mock('@/lib/imageResize', () => ({ resizeContain: jest.fn(), resizeCover: jest.fn() }));
test('HEIC fails with a clear error before any resize or network call', async () => {
  await expect(uploadPhoto(new File(['x'], 'test.HEIC', { type: 'image/heic' }), 'game', jest.fn())).rejects.toThrow('Не удалось загрузить: формат HEIC не поддерживается');
  expect(resizeContain).not.toHaveBeenCalled();
});
test('month label has no year suffix and remaining time is rounded', () => {
  expect(photoMonth('2026-04-04T12:00:00Z')).toBe('апрель 2026');
  expect(photoMonth(null)).toBe('Без даты');
  expect(remainingLabel(10000, 0.5)).toBe('осталось ~10 сек');
  expect(remainingLabel(60000, 0.25)).toBe('осталось ~3 мин');
  expect(remainingLabel(1000, 0.01)).toBe('');
});
