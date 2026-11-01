'use client';
import { useState } from 'react';
import { CiCdTab } from '@/components/SettingsScreen';

export function AdminCi() {
  const [refreshKey, setRefreshKey] = useState(0);
  return <div className="-mx-3 -mt-5 sm:-mx-6 sm:-mt-6"><div className="flex justify-end px-6 pt-3"><button onClick={() => setRefreshKey(key => key + 1)} className="min-h-9 rounded-lg border border-[#333] px-3 text-xs text-[#aaa]">Обновить</button></div><CiCdTab refreshKey={refreshKey} /></div>;
}
