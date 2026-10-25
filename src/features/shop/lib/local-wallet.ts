'use client';
// Demo wallet: spending and equipped items in localStorage; earnings recomputed from local progress
// (demoEarnings) so they always match what the student did on this device.
import { loadLocalMocks } from '@/features/exam/lib/local-mocks';
import { loadLocalRoadmap } from '@/features/roadmap/lib/local-store';
import { demoEarnings, emptyWallet, type GemEvent, type Wallet } from './wallet';

const KEY = 'suprep:wallet:v1';
const DAILY_DAYS = 'suprep:daily:days';

type Stored = { spent: GemEvent[]; owned: Wallet['owned']; equipped: Wallet['equipped'] };

function readStored(): Stored {
  try {
    return {
      spent: [],
      owned: {},
      equipped: {},
      ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Stored>),
    };
  } catch {
    return { spent: [], owned: {}, equipped: {} };
  }
}

export function loadLocalWallet(): Wallet {
  if (typeof window === 'undefined') return emptyWallet();
  const road = loadLocalRoadmap();
  let dailyDays: string[] = [];
  try {
    dailyDays = JSON.parse(localStorage.getItem(DAILY_DAYS) ?? '[]') as string[];
  } catch {
    // ignore
  }
  const earned = demoEarnings({
    stops: road.state.stops,
    regionsDone: road.state.regionsDone,
    mockIds: loadLocalMocks()
      .filter((m) => !m.flagged)
      .map((m) => m.id),
    dailyDays,
    bestStreak: 0,
  });
  const s = readStored();
  return { events: [...earned, ...s.spent], owned: s.owned, equipped: s.equipped };
}

export function saveLocalWallet(w: Wallet) {
  try {
    const spent = w.events.filter((e) => e.amount < 0);
    localStorage.setItem(KEY, JSON.stringify({ spent, owned: w.owned, equipped: w.equipped }));
    window.dispatchEvent(new Event('suprep-wallet'));
  } catch {
    // storage blocked
  }
}
