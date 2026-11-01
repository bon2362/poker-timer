import type { Metadata } from 'next';
import { PT_Serif } from 'next/font/google';
import { AdminAuthProvider } from '@/context/AdminAuthContext';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

const ptSerif = PT_Serif({ subsets: ['latin', 'cyrillic'], weight: ['400', '700'], variable: '--font-pt-serif' });
export const metadata: Metadata = { title: 'Вход в админку', robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return (
    <AdminAuthProvider>
      <main className={`${ptSerif.variable} min-h-[100dvh] h-[100dvh] overflow-y-auto bg-[#1a1a1a] flex items-center justify-center p-4 lg:px-12`}>
        <AdminLoginForm redirectTo="/" />
      </main>
    </AdminAuthProvider>
  );
}
