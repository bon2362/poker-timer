import { getClient } from '@/supabase/client';

export async function uploadToSignedPath(bucket: string, path: string, token: string, blob: Blob, onProgress?: (percent: number) => void): Promise<boolean> {
  const client = getClient(); if (!client) return false;
  onProgress?.(0);
  const { error } = await client.storage.from(bucket).uploadToSignedUrl(path, token, blob, { contentType: 'image/jpeg' });
  onProgress?.(100);
  return !error;
}
