export async function resizeContain(blob: Blob, maxWidth: number, maxHeight: number, quality: number): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unable to load image')); image.src = url; });
    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Unable to export image')), 'image/jpeg', quality));
  } finally { URL.revokeObjectURL(url); }
}

export async function resizeCover(blob: Blob, size: number, quality: number): Promise<Blob> {
  return resizeContain(blob, size, size, quality);
}
