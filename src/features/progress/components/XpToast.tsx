'use client';

import { useEffect } from 'react';

interface XpToastProps {
  amount: number;
  reason: string;
  onClose: () => void;
}

export function XpToast({ amount, reason, onClose }: XpToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-lg animate-bounce">
      <span className="text-xl">⚡</span>
      <div>
        <p className="font-bold">+{amount} XP</p>
        <p className="text-xs text-emerald-100">{reason}</p>
      </div>
    </div>
  );
}
