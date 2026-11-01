import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getGameBySlug } from '@/lib/games/queries';
import { GameDetail } from '@/components/games/GameDetail';
import { gameDate, number, plural } from '@/components/games/format';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = await getGameBySlug((await params).slug);
  if (!game) return { title: 'Игра не найдена', robots: { index: false, follow: false } };
  const title = `${gameDate(game.session.createdAt)} · ${game.winner.name} · BSP`;
  const description = `Победитель: ${game.winner.name}. Банк ${number(game.bank)} RSD · ${plural(game.players.length, ['игрок', 'игрока', 'игроков'])}.`;
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, type: 'article' }, twitter: { card: 'summary_large_image', title, description } };
}
export default async function GamePage({ params }: Props) {
  const game = await getGameBySlug((await params).slug);
  if (!game) notFound();
  return <GameDetail game={game} />;
}
