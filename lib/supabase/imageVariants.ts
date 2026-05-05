import { getClient } from '@/supabase/client';

const BUCKET = 'avatars';
const FULL_MAX_WIDTH = 1920;
const FULL_MAX_HEIGHT = 1920;
const THUMB_SIZE = 200;

type SpecialImageKind = 'winner' | 'loser';

const pendingBackfills = new Map<string, Promise<void>>();

function path(kind: SpecialImageKind, playerId: string) {
  return `${kind}-${playerId}.jpg`;
}

function thumbPath(kind: SpecialImageKind, playerId: string) {
  return `${kind}-${playerId}-thumb.jpg`;
}

function cacheBust(url: string) {
  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const { data } = await client.storage.from(BUCKET).list('', { search: filePath });
  return Boolean(data?.find(file => file.name === filePath));
}

function publicUrl(filePath: string, bustCache = false): string | null {
  const client = getClient();
  if (!client) return null;
  const url = client.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;
  return bustCache ? cacheBust(url) : url;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to export image variant'));
    }, 'image/jpeg', quality);
  });
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to load image for resizing'));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawPhotoBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
}

async function resizeContain(blob: Blob, maxWidth: number, maxHeight: number, quality: number): Promise<Blob> {
  const image = await loadImage(blob);
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  drawPhotoBackground(ctx, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvasToBlob(canvas, quality);
}

async function resizeCover(blob: Blob, size: number, quality: number): Promise<Blob> {
  const image = await loadImage(blob);
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (size - width) / 2;
  const y = (size - height) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  drawPhotoBackground(ctx, size, size);
  ctx.drawImage(image, x, y, width, height);
  return canvasToBlob(canvas, quality);
}

async function uploadBlob(filePath: string, blob: Blob): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const { error } = await client.storage.from(BUCKET).upload(filePath, blob, {
    cacheControl: '3600',
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) {
    console.error('uploadImageVariant:', error);
    return false;
  }
  return true;
}

async function createVariantsFromBlob(kind: SpecialImageKind, playerId: string, source: Blob): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  const [full, thumb] = await Promise.all([
    resizeContain(source, FULL_MAX_WIDTH, FULL_MAX_HEIGHT, 0.82),
    resizeCover(source, THUMB_SIZE, 0.76),
  ]);

  const [fullUploaded, thumbUploaded] = await Promise.all([
    uploadBlob(path(kind, playerId), full),
    uploadBlob(thumbPath(kind, playerId), thumb),
  ]);

  return fullUploaded && thumbUploaded;
}

async function backfillVariants(kind: SpecialImageKind, playerId: string): Promise<void> {
  const originalUrl = publicUrl(path(kind, playerId), true);
  if (!originalUrl) return;

  const response = await fetch(originalUrl);
  if (!response.ok) return;

  await createVariantsFromBlob(kind, playerId, await response.blob());
}

async function ensureVariants(kind: SpecialImageKind, playerId: string): Promise<void> {
  const fullPath = path(kind, playerId);
  const derivedThumbPath = thumbPath(kind, playerId);
  if (!(await fileExists(fullPath)) || await fileExists(derivedThumbPath)) return;
  if (typeof document === 'undefined') return;

  const key = `${kind}:${playerId}`;
  const pending = pendingBackfills.get(key);
  if (pending) return pending;

  const next = backfillVariants(kind, playerId)
    .catch(error => console.error('backfillImageVariants:', error))
    .finally(() => pendingBackfills.delete(key));
  pendingBackfills.set(key, next);
  return next;
}

export async function getSpecialImageUrl(kind: SpecialImageKind, playerId: string): Promise<string | null> {
  if (!(await fileExists(path(kind, playerId)))) return null;
  await ensureVariants(kind, playerId);
  return publicUrl(path(kind, playerId), true);
}

export async function getSpecialThumbUrl(kind: SpecialImageKind, playerId: string): Promise<string | null> {
  if (!(await fileExists(path(kind, playerId)))) return null;
  await ensureVariants(kind, playerId);
  const derivedThumbPath = thumbPath(kind, playerId);
  return publicUrl(await fileExists(derivedThumbPath) ? derivedThumbPath : path(kind, playerId), true);
}

export async function uploadSpecialImage(kind: SpecialImageKind, playerId: string, file: File): Promise<string | null> {
  const uploaded = await createVariantsFromBlob(kind, playerId, file);
  if (!uploaded) return null;
  return publicUrl(path(kind, playerId), true);
}

export async function deleteSpecialImage(kind: SpecialImageKind, playerId: string): Promise<void> {
  const client = getClient();
  if (!client) return;
  await client.storage.from(BUCKET).remove([path(kind, playerId), thumbPath(kind, playerId)]);
}
