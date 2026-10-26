import { describe, expect, it } from 'bun:test';
import { DAILY_QUESTS } from './quests';

describe('Daily Quests Logic (F3)', () => {
  it('should define exactly 4 daily quests', () => {
    expect(DAILY_QUESTS.length).toBe(4);
    expect(DAILY_QUESTS.map((q) => q.id)).toContain('vocab_5');
    expect(DAILY_QUESTS.map((q) => q.id)).toContain('desmos_1');
  });
});
