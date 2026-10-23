import type { DesmosHack, DesmosLesson } from '@/types';
import { HACKS, LESSONS } from './content';

export async function listDesmosLessons(): Promise<DesmosLesson[]> {
  return structuredClone(LESSONS).sort((a, b) => a.no - b.no);
}
export async function getDesmosLesson(id: string): Promise<DesmosLesson | null> {
  return structuredClone(LESSONS.find((lesson) => lesson.id === id) ?? null);
}
export async function listHacks(): Promise<DesmosHack[]> {
  return structuredClone(HACKS);
}
