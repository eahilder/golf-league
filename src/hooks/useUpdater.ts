import { useEffect, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function useUpdater() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Check once on startup, silently ignore errors (offline, dev mode, etc.)
    check().then(u => { if (u?.available) setUpdate(u); }).catch(() => {});
  }, []);

  const checkNow = async () => {
    setChecking(true);
    setChecked(false);
    try {
      const u = await check();
      if (u?.available) setUpdate(u);
      else setUpdate(null);
    } catch {
      // ignore
    } finally {
      setChecking(false);
      setChecked(true);
    }
  };

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

  return { update, installing, checking, checked, checkNow, installUpdate, dismiss: () => setUpdate(null) };
}
