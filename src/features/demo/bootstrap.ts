import type { DemoSeed } from './seed';

const VERSION = 'tuya-v1';
const MARKER = 'suprep:demo-scenario';
/** Seed once per browser. Subsequent demo visits preserve the student's changes and new progress. */
export function initializeTuyaDemo(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  seed: DemoSeed,
) {
  if (storage.getItem(MARKER) === VERSION) return;
  storage.setItem('suprep-settings', JSON.stringify(seed.profile));
  storage.setItem('suprep:onboarding:v1', JSON.stringify(seed.profile));
  storage.setItem('suprep:roadmap:v1', JSON.stringify(seed.roadmap));
  storage.setItem('suprep:mocks:v1', JSON.stringify(seed.mocks));
  storage.removeItem('suprep:mock:current:v1');
  storage.setItem(MARKER, VERSION);
}
