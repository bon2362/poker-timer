import { AdminShell } from '@/components/admin/AdminShell';
import { PhotoGallery } from '@/components/admin/PhotoGallery';
import { loadAdminGames, loadAdminPhotos, adminClient } from '@/lib/admin/data';
export const dynamic = 'force-dynamic';
export default async function NoGamePage() {
  await adminClient(); const [games, photos] = await Promise.all([loadAdminGames(), loadAdminPhotos(null)]);
  return <AdminShell title="Без игры" subtitle={`${photos.total} фото`} back="/admin"><p className="mb-5 rounded-lg bg-[#242424] p-4 text-sm leading-relaxed text-[#999]">Старые фото, не привязанные к игре. Показываются только в карусели на паузе. Новые фото сюда не попадают — загружайте их в карточку игры.</p><PhotoGallery initialPhotos={photos.photos} total={photos.total} sessionId={null} games={games} /></AdminShell>;
}
