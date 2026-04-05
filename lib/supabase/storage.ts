// lib/supabase/storage.ts
import { getClient } from '@/supabase/client';

export async function uploadAvatar(playerId: string, blob: Blob): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const path = `${playerId}.jpg`;
  const { error } = await client.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) { console.error('uploadAvatar:', error); return null; }
  const { data } = client.storage.from('avatars').getPublicUrl(path);
  // bust cache by appending timestamp
  return `${data.publicUrl}?t=${Date.now()}`;
}
