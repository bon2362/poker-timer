import Link from 'next/link';
import type { GameSummary } from '@/lib/games/queries';
import { Avatar } from './Primitives';
import { gameDate, headingClass, number, plural } from './format';
export function GameCard({ game }: { game: GameSummary }) {
  return <Link href={`/games/${game.session.slug}`} className="group overflow-hidden rounded-[14px] bg-[#242424] transition-colors hover:bg-[#2a2a2a] motion-reduce:transition-none">
    <div className="relative aspect-[16/10] overflow-hidden">
      {game.photos[0] ? <><img src={game.photos[0].url} alt="" loading="lazy" width={game.photos[0].width ?? undefined} height={game.photos[0].height ?? undefined} className="h-full w-full object-cover object-[50%_30%] transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none" /><span className="absolute right-3 bottom-3 rounded-md bg-black/60 px-2 py-1 text-xs">{game.photos.length} фото</span></> : <div className="flex h-full flex-col items-center justify-center gap-5 bg-radial-[at_50%_110%] from-[#3a2060] via-[#2a2040] to-[#211c2b]"><div className="scale-65"><Avatar name={game.winner.name} url={game.winner.avatarUrl} large /></div><span className="-mt-4 text-[11px] tracking-[4px] text-violet-300 uppercase">Победитель</span></div>}
    </div>
    <div className="flex flex-col gap-3 p-5"><h3 className={`${headingClass} text-[21px] font-bold`}>{gameDate(game.session.createdAt)}</h3><p className="flex min-w-0 gap-2 text-sm"><span className="shrink-0 text-xs font-bold tracking-wider text-yellow-400">1 МЕСТО</span><span className="truncate font-semibold">{game.winner.name}</span></p><p className="text-[13px] text-[#8a8a8a]">{plural(game.players.length, ['игрок', 'игрока', 'игроков'])} · банк {number(game.bank)} RSD</p></div>
  </Link>;
}
