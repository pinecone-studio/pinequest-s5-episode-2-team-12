// Demo-mode settings in localStorage. Signed-in students keep them in profiles (actions.ts).
import type { SettingsPatch } from './actions';

const KEY = 'suprep-settings';
/** The old dashboard countdown saved only the date under this key. */
const LEGACY_EXAM_KEY = 'suprep-exam-date';

export function readLocalSettings(): SettingsPatch {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as SettingsPatch) : {};
    const legacy = localStorage.getItem(LEGACY_EXAM_KEY);
    return legacy && !saved.examDate ? { ...saved, examDate: legacy } : saved;
  } catch {
    return {};
  }
}

export function writeLocalSettings(patch: SettingsPatch) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readLocalSettings(), ...patch }));
  } catch {
    // storage blocked: the change lasts for this page only
  }
}
