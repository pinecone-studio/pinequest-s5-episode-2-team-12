'use client';
import { useEffect } from 'react';
import { syncOffline } from './storage';

export function OfflineSync() {
  useEffect(() => {
    const sync = () => {
      if (navigator.onLine && 'indexedDB' in window) void syncOffline().catch(() => {});
    };
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, []);
  return null;
}
