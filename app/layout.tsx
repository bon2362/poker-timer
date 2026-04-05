import type { Metadata } from 'next';
import './globals.css';
import { GameProvider } from '@/context/GameContext';
import { TimerProvider } from '@/context/TimerContext';

export const metadata: Metadata = {
  title: 'Poker Timer',
  description: 'Poker tournament timer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-[#1a1a1a] text-white overflow-hidden">
        <GameProvider>
          <TimerProvider>
            {children}
          </TimerProvider>
        </GameProvider>
      </body>
    </html>
  );
}
