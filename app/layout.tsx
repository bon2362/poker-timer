import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Poker Timer',
  description: 'Poker tournament blind timer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-[#1a1a1a] text-white overflow-hidden">{children}</body>
    </html>
  );
}
