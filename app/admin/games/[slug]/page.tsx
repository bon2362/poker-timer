import { notFound } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { ResultsEditor } from '@/components/admin/ResultsEditor';
import { PhotoSection } from '@/components/admin/PhotoSection';
import { SavedImages } from '@/components/admin/SavedImages';
import { DeleteGame } from '@/components/admin/DeleteGame';
import { PublicGameLink } from '@/components/admin/PublicGameLink';
import { loadAdminGames, loadAdminPhotos, loadSavedImages } from '@/lib/admin/data';
import { gameDate } from '@/lib/admin/types';
export const dynamic = 'force-dynamic';
export default async function AdminGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const games = await loadAdminGames(); const { slug } = await params; const game = games.find(game => game.session.slug === slug); if (!game) notFound();
  const [photos, images] = await Promise.all([loadAdminPhotos(game.session.id), loadSavedImages(game.players.flatMap(p => [p.winnerImageId, p.loserImageId].filter((id): id is string => Boolean(id))))]);
  const date = gameDate(game.session.createdAt);
  return <AdminShell title={date} subtitle={`${game.players.length} игроков · ${photos.total} фото`} back="/admin" publicSlug={slug}><PublicGameLink slug={slug} /><div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2"><ResultsEditor session={game.session} players={game.players} names={game.names} /><PhotoSection sessionId={game.session.id} photos={photos.photos} total={photos.total} games={games} /></div><SavedImages sessionId={game.session.id} date={new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Belgrade', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(game.session.createdAt))} players={game.players} names={game.names} images={images} /><DeleteGame id={game.session.id} date={date} /></AdminShell>;
}
