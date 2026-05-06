import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://bsptimer.online'),
  title: 'Poker Timer',
  description: 'Poker tournament timer',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/poker-timer-favicon/favicon.svg', type: 'image/svg+xml' },
      { url: '/poker-timer-favicon/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/poker-timer-favicon/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/poker-timer-favicon/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/poker-timer-favicon/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-[#1a1a1a] text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
