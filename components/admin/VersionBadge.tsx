'use client';
import { useState } from 'react';
import { ChangelogModal, currentVersion } from '@/components/SettingsScreen';

export function VersionBadge() {
  const [open, setOpen] = useState(false);
  return <>{open && <ChangelogModal onClose={() => setOpen(false)} />}<button onClick={() => setOpen(true)} className="mt-0.5 block w-full text-center text-[11px] text-[#555] hover:text-[#888]">v{currentVersion()}</button></>;
}
