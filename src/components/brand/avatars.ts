// Preset avatars: Суу on a colored disc. No photo uploads (most students are minors). Shop frames later.
import type { CatMood } from './Cat';

export type AvatarPreset = { id: string; bg: string; mood: CatMood };

export const AVATARS: AvatarPreset[] = [
  { id: 'leaf', bg: 'linear-gradient(135deg, #22c55e, #15803d)', mood: 'happy' },
  { id: 'sky', bg: 'linear-gradient(135deg, #38bdf8, #0369a1)', mood: 'wink' },
  { id: 'sun', bg: 'linear-gradient(135deg, #facc15, #d97706)', mood: 'wow' },
  { id: 'rose', bg: 'linear-gradient(135deg, #fb7185, #be123c)', mood: 'happy' },
  { id: 'night', bg: 'linear-gradient(135deg, #6366f1, #312e81)', mood: 'focus' },
  { id: 'steppe', bg: 'linear-gradient(135deg, #a3e635, #4d7c0f)', mood: 'think' },
  { id: 'sand', bg: 'linear-gradient(135deg, #fdba74, #c2410c)', mood: 'idle' },
  { id: 'snow', bg: 'linear-gradient(135deg, #e2e8f0, #64748b)', mood: 'wink' },
];

export const avatarById = (id?: string | null) => AVATARS.find((a) => a.id === id);
