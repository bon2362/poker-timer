import { getClient } from '@/supabase/client';

export async function uploadToSignedPath(bucket: string, path: string, token: string, blob: Blob, onProgress?: (percent: number) => void): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const publicUrl = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const url = new URL(publicUrl.replace('/object/public/', '/object/upload/sign/'));
  url.searchParams.set('token', token);

  return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url.toString());
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) onProgress?.(Math.round(event.loaded / event.total * 100));
    };
    xhr.onload = () => {
      const success = xhr.status >= 200 && xhr.status < 300;
      if (success) onProgress?.(100);
      resolve(success);
    };
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    xhr.ontimeout = () => resolve(false);
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', blob, 'image.jpg');
    onProgress?.(0);
    xhr.send(body);
  });
}
