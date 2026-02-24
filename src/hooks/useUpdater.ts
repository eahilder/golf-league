import { useEffect, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function useUpdater() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check once on startup, silently ignore errors (offline, dev mode, etc.)
    check().then(u => { if (u?.available) setUpdate(u); }).catch(() => {});
  }, []);

  const installUpdate = async () => {
    if (!update) return;
    setInstalling(true);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (err) {
      console.error('Update failed:', err);
      setInstalling(false);
    }
  };

  return { update, installing, installUpdate, dismiss: () => setUpdate(null) };
}
