import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Админка — Poker Timer', robots: { index: false, follow: false } };
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-[100dvh] overflow-y-auto bg-[#1a1a1a] font-sans text-white dark:bg-[#1a1a1a]">{children}</div>;
}
