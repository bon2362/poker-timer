import { getClient } from '@/supabase/client';
import { uploadToSignedPath } from './signedUpload';

export async function uploadAvatar(playerId: string, blob: Blob, onProgress?: (percent: number) => void): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  const response = await fetch('/api/admin/uploads/sign', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bucket: 'avatars', files: [{ name: `${playerId}.jpg` }] }),
  });
  if (!response.ok) return null;
  const { uploads } = await response.json();
  const upload = uploads?.[0];
  if (!upload) return null;
  const success = await uploadToSignedPath('avatars', upload.path, upload.token, blob, onProgress);
  return success ? client.storage.from('avatars').getPublicUrl(upload.path).data.publicUrl : null;
}
