'use client';
import { useCallback, useEffect, useState } from 'react';
import { type SaveResult, type SettingsPatch, saveSettings } from './actions';
import { readLocalSettings, writeLocalSettings } from './local';

export type StudentSettings = Pick<Required<SettingsPatch>, 'examDate' | 'tz' | 'hidePublic' | 'friendsOnly'>;

const EVENT = 'suprep-settings';

/**
 * Settings shared by the exam chip and /settings. Starts from the server profile; in demo mode the
 * localStorage copy wins. A save in one place updates every mounted copy.
 */
export function useStudentSettings(initial: StudentSettings, demo: boolean) {
  const [settings, setSettings] = useState(initial);

  useEffect(() => {
    if (demo) setSettings((s) => ({ ...s, ...readLocalSettings() }));
    const onChange = (e: Event) =>
      setSettings((s) => ({ ...s, ...(e as CustomEvent<SettingsPatch>).detail }));
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [demo]);

  const save = useCallback(async (patch: SettingsPatch): Promise<SaveResult> => {
    const r = await saveSettings(patch);
    if (!r.ok && r.reason !== 'demo_mode') return r;
    if (!r.ok) writeLocalSettings(patch);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: patch }));
    return { ok: true };
  }, []);

  return [settings, save] as const;
}
