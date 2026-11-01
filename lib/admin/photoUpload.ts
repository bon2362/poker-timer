import { resizeContain, resizeCover } from '@/lib/imageResize';
import { uploadToSignedPath } from '@/lib/supabase/signedUpload';
import { adminFetch } from './client';
export async function prepareImage(file: File, bucket: 'avatars' | 'slideshow', onProgress: (progress: number) => void) {
  if (/\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type)) throw new Error('Не удалось загрузить: формат HEIC не поддерживается');
  const [full, thumb] = await Promise.all([resizeContain(file, 1920, 1920, 0.82), resizeCover(file, 200, 0.76)]);
  const { uploads } = await adminFetch('/api/admin/uploads/sign', 'POST', { bucket, files: [{ name: 'full.jpg' }, { name: 'thumb.jpg' }] });
  if (!Array.isArray(uploads) || uploads.length !== 2) throw new Error('Не удалось подготовить загрузку. Попробуйте ещё раз.');
  const progress = [0, 0];
  const uploaded = await Promise.all([full, thumb].map((blob, i) => uploadToSignedPath(bucket, uploads[i].path, uploads[i].token, blob, percent => { progress[i] = percent; onProgress(Math.floor((progress[0] + progress[1]) / 2)); })));
  if (uploaded.some(value => !value)) throw new Error('Не удалось загрузить файл. Попробуйте ещё раз.');
  return { full, path: uploads[0].path as string, thumbPath: uploads[1].path as string };
}
export async function uploadPhoto(file: File, sessionId: string, onProgress: (progress: number) => void): Promise<void> {
  const prepared = await prepareImage(file, 'slideshow', onProgress);
  const image = await createImageBitmap(prepared.full);
  const width = image.width; const height = image.height; image.close();
  await adminFetch('/api/admin/photos', 'POST', { sessionId, path: prepared.path, thumbPath: prepared.thumbPath, width, height, takenAt: new Date(file.lastModified).toISOString() });
}
