import { AdminShell } from '@/components/admin/AdminShell';
import { PhotoGallery } from '@/components/admin/PhotoGallery';
import { loadAdminGames, loadAdminPhotos, loadUnassignedSummary, adminClient } from '@/lib/admin/data';
export const dynamic = 'force-dynamic';
export default async function NoGamePage() {
  await adminClient(); const [games, photos, summary] = await Promise.all([loadAdminGames(), loadAdminPhotos(null), loadUnassignedSummary()]);
  const period = summary.years.length ? ` · ${[...new Set([summary.years.at(-1), summary.years[0]])].join('–')}` : '';
  return <AdminShell title="Без игры" subtitle={`${photos.total} фото${period}`} back="/admin"><p className="mb-5 rounded-lg bg-[#242424] p-4 text-sm leading-relaxed text-[#999]">Старые фото, не привязанные к игре. Показываются только в карусели на паузе. Новые фото сюда не попадают — загружайте их в карточку игры.</p><PhotoGallery initialPhotos={photos.photos} total={photos.total} sessionId={null} games={games} monthCounts={summary.monthCounts} years={summary.years} /></AdminShell>;
}
