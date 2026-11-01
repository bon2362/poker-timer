import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getGameBySlug } from '@/lib/games/queries';
import { gameDate, number } from '@/components/games/format';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const alt = 'Результаты покерного вечера · BSP';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Local files include Cyrillic; next/og cannot reuse next/font's browser font files.
const fonts = Promise.all([
  readFile(join(process.cwd(), 'assets/fonts/PTSans-Bold.ttf')),
  readFile(join(process.cwd(), 'assets/fonts/PTSerif-BoldItalic.ttf')),
  readFile(join(process.cwd(), 'assets/images/game-og-background.png')),
  readFile(join(process.cwd(), 'public/poker-timer-favicon/favicon.svg')),
]);
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const game = await getGameBySlug((await params).slug);
  if (!game) return new Response('Игра не найдена', { status: 404 });
  const [sans, serif, backgroundPng, logoSvg] = await fonts;
  const logo = 'data:image/svg+xml;base64,' + logoSvg.toString('base64');
  const photo = game.images.find(image => image.kind === 'winner' && image.playerId === game.winner.playerId)?.url ?? game.photos[0]?.url;
  const background = 'data:image/png;base64,' + backgroundPng.toString('base64');
  return new ImageResponse(<div tw="relative flex h-full w-full bg-[#1a1a1a] text-white font-sans">
    {photo && <img src={photo} alt="" width={720} height={630} tw="absolute right-0 top-0 h-full w-[720px]" style={{ objectFit: 'cover', objectPosition: '50% 25%' }} />}
    {photo && <div tw="absolute top-0 left-[400px] flex h-full w-[340px]" style={{ backgroundImage: 'linear-gradient(to right, #1a1a1a, rgba(26,26,26,.85) 40%, transparent)' }} />}
    {!photo && <div tw="absolute inset-0 flex h-full w-full"><img src={background} alt="" width={1200} height={630} tw="absolute inset-0 h-full w-full" /><div tw="absolute right-[120px] top-[155px] flex h-[320px] w-[320px] items-center justify-center overflow-hidden rounded-full border-[10px] border-[#facc15] bg-[#5b21b6] text-[132px]">{game.winner.avatarUrl ? <img src={game.winner.avatarUrl} alt="" width={320} height={320} tw="h-full w-full" style={{ objectFit: 'cover' }} /> : game.winner.name[0].toUpperCase()}</div></div>}
    <div tw="absolute left-[64px] top-[56px] bottom-[56px] flex w-[620px] flex-col justify-between">
      <div tw="flex items-center text-[28px] tracking-[2px] text-[#ccc]"><img src={logo} alt="" width={48} height={48} tw="mr-[14px]" />BSP · ПОКЕР</div>
      <div tw="flex flex-col"><div tw="flex mb-[24px] font-serif italic text-[46px]">{gameDate(game.session.createdAt)}</div><div tw="flex text-[26px] tracking-[8px] text-[#a78bfa]">ПОБЕДИТЕЛЬ</div><div tw={`flex mt-[10px] ${game.winner.name.length > 12 ? 'text-[80px]' : 'text-[112px]'}`}>{game.winner.name.toUpperCase()}</div></div>
      <div tw="flex items-center"><span tw="text-[30px] text-[#aaa]">банк</span><span tw="ml-[18px] text-[56px] text-[#facc15]">{number(game.bank)} RSD</span></div>
    </div>
  </div>, { ...size, fonts: [
    { name: 'ui-sans-serif', data: sans, style: 'normal', weight: 700 },
    { name: 'ui-serif', data: serif, style: 'italic', weight: 700 },
  ] });
}
