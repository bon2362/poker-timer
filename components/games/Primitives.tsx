import Link from 'next/link';
export function Avatar({ name, url, large = false }: { name: string; url: string | null; large?: boolean }) {
  const colors = ['bg-violet-800', 'bg-blue-700', 'bg-emerald-800', 'bg-amber-800', 'bg-red-900'];
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white ${colors[name.charCodeAt(0) % colors.length]} ${large ? 'h-28 w-28 text-4xl ring-4 ring-yellow-400 lg:h-36 lg:w-36' : 'h-8 w-8 text-xs'}`}>
    {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
  </span>;
}
export function PlaceBadge({ place, small = false }: { place: number | null; small?: boolean }) {
  const colors = place === 1 ? 'bg-yellow-400 text-[#1a1a1a]' : place === 2 ? 'bg-zinc-300 text-[#1a1a1a]' : place === 3 ? 'bg-[#d08a4e] text-[#1a1a1a]' : 'border border-[#333] text-[#8a8a8a]';
  return <span className={`flex ${small ? 'h-8 w-8 text-sm' : 'h-9 w-9'} shrink-0 items-center justify-center rounded-full font-extrabold tabular-nums ${colors}`}>{place ?? '—'}</span>;
}
export function Brand() { return <Link href="/" aria-label="На главную" className="inline-flex min-h-11 items-center gap-2.5 text-sm font-semibold tracking-wider text-[#ccc] hover:text-white"><img src="/poker-timer-favicon/favicon.svg" width={26} height={26} alt="" />BSP · ПОКЕР</Link>; }
