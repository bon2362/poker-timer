import type { Metadata } from 'next';
import { PT_Serif } from 'next/font/google';
const serif = PT_Serif({ weight: ['400', '700'], style: ['normal', 'italic'], subsets: ['latin', 'cyrillic'], variable: '--font-game-serif', display: 'swap' });
export const metadata: Metadata = { title: 'Игры · BSP', robots: { index: false, follow: false } };
export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${serif.variable} h-dvh overflow-y-auto bg-[#1a1a1a] font-sans text-white dark:bg-[#1a1a1a]`}>{children}</div>;
}
