'use client';
import { useEffect } from 'react';
import { syncOffline } from './storage';

export function OfflineSync() {
  useEffect(() => {
    // Ask an already installed worker to update after local code changes. Do not install one
    // until the student chooses to download offline content.
    if (process.env.NODE_ENV === 'development' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker
        .getRegistration('/')
        .then((registration) => registration?.update())
        .catch(() => {});
    }
    const sync = () => {
      if (navigator.onLine && 'indexedDB' in window) void syncOffline().catch(() => {});
    };
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, []);
  return null;
}
