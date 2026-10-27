'use client';
// One wallet API for the shop, the shell avatar and the map skin. Signed in: the server's wallet (purchases
// go through purchase_item). Demo: localStorage (local-wallet.ts), updated across components by an event.
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { buyItem, equipItem, resetMapSkin as resetServerMapSkin } from '../actions';
import type { Slot } from '../catalog';
import type { ServerWallet } from '../queries';
import { loadLocalWallet, saveLocalWallet } from './local-wallet';
import { balance, equip as equipLocal, purchase, resetMapSkin } from './wallet';

export type WalletView = {
  balance: number;
  owned: Record<string, number>;
  equipped: Partial<Record<Slot, string>>;
};

const EMPTY: WalletView = { balance: 0, owned: {}, equipped: {} };

function localView(): WalletView {
  const w = loadLocalWallet();
  return { balance: balance(w), owned: w.owned, equipped: w.equipped };
}

export function useWallet(demo: boolean, server: ServerWallet | null) {
  const router = useRouter();
  const [view, setView] = useState<WalletView>(server ?? EMPTY);
  useEffect(() => {
    if (!demo) {
      if (server) setView(server);
      return;
    }
    const sync = () => setView(localView());
    sync();
    window.addEventListener('suprep-wallet', sync);
    return () => window.removeEventListener('suprep-wallet', sync);
  }, [demo, server]);

  const buy = useCallback(
    async (itemId: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
      const key = `${itemId}:${crypto.randomUUID()}`;
      if (demo) {
        const r = purchase(loadLocalWallet(), itemId, key);
        if (!r.ok) return r;
        saveLocalWallet(r.wallet);
        return { ok: true };
      }
      const r = await buyItem({ itemId, key });
      if (r.ok) router.refresh();
      return r.ok ? { ok: true } : r;
    },
    [demo, router],
  );

  const equip = useCallback(
    async (itemId: string) => {
      if (demo) {
        saveLocalWallet(equipLocal(loadLocalWallet(), itemId));
        return;
      }
      const r = await equipItem(itemId);
      if (r.ok) router.refresh();
    },
    [demo, router],
  );

  const selectDefaultMap = useCallback(async () => {
    if (demo) {
      saveLocalWallet(resetMapSkin(loadLocalWallet()));
      return { ok: true } as const;
    }
    const result = await resetServerMapSkin();
    if (result.ok) router.refresh();
    return result;
  }, [demo, router]);

  return { ...view, buy, equip, selectDefaultMap };
}
