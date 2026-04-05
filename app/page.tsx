'use client';
import dynamic from 'next/dynamic';

const PokerTimer = dynamic(
  () => import('@/components/PokerTimer').then(m => ({ default: m.PokerTimer })),
  { ssr: false }
);

export default function Home() {
  return <PokerTimer />;
}
