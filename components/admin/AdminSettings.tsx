'use client';
import dynamic from 'next/dynamic';
import type { AdminTimerTabName } from './AdminTimerTab';

const AdminTimerTab = dynamic(() => import('./AdminTimerTab'), { ssr: false });

export function AdminSettings({ tab }: { tab: AdminTimerTabName }) {
  return <AdminTimerTab tab={tab} />;
}
