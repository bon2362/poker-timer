'use client';
import { useRouter } from 'next/navigation';
import { PhotoUploader } from './PhotoUploader';
import { PhotoGallery } from './PhotoGallery';
import type { AdminPhoto, AdminGame } from '@/lib/admin/types';
export function PhotoSection({ sessionId, photos, total, games }: { sessionId: string; photos: AdminPhoto[]; total: number; games: AdminGame[] }) {
  const router = useRouter();
  return <section className="min-w-0"><PhotoUploader empty={total === 0} photoCount={total} sessionId={sessionId} onUploaded={() => router.refresh()} /><PhotoGallery showLabel={false} initialPhotos={photos} total={total} sessionId={sessionId} games={games} /></section>;
}
