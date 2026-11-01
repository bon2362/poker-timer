import type { Metadata } from 'next';
import { getLeaderboard, listFinishedGames } from '@/lib/games/queries';
import { Leaderboard } from '@/components/games/Leaderboard';
import { GameCard } from '@/components/games/GameCard';
import { Brand } from '@/components/games/Primitives';
import { headingClass, plural } from '@/components/games/format';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Общий рейтинг · BSP', robots: { index: false, follow: false } };
export default async function GamesPage() {
  const [games, rows] = await Promise.all([listFinishedGames(), getLeaderboard()]);
  return <><header className="border-b border-[#2a2a2a] px-4 py-3.5 lg:px-12"><Brand /></header><main className="mx-auto flex max-w-[1120px] flex-col gap-9 px-4 pt-6 pb-16 lg:gap-14 lg:px-12 lg:pt-12">
    <section><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-1.5 text-[11px] tracking-[2px] text-[#8a8a8a] uppercase">За всё время</p><h1 className={`${headingClass} text-[28px] leading-tight font-bold lg:text-[40px]`}>Общий рейтинг</h1></div><span className="text-[13px] text-[#8a8a8a]">{plural(games.length, ['игра', 'игры', 'игр'])} · {plural(rows.length, ['игрок', 'игрока', 'игроков'])}</span></div>{rows.length ? <Leaderboard rows={rows} /> : <p className="rounded-xl bg-[#242424] p-5 text-sm text-[#aaa]">Здесь появятся результаты после первой завершённой игры.</p>}</section>
    <section><div className="mb-5 flex items-end justify-between"><h2 className={`${headingClass} text-2xl font-bold lg:text-3xl`}>Игры</h2><span className="text-sm text-[#8a8a8a]">{games.length}</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-5">{games.map(game => <GameCard key={game.session.id} game={game} />)}</div></section>
  </main></>;
}
