import { describe, expect, it } from 'bun:test';
import { getLevelByXp } from './levels';

describe('Levels Logic (F1)', () => {
  it('should return Explorer (Level 1) for 0 XP', () => {
    expect(getLevelByXp(0).level).toBe(1);
  });

  it('should handle edge case: 199 XP is still Explorer (Level 1)', () => {
    expect(getLevelByXp(199).level).toBe(1);
    expect(getLevelByXp(199).title).toBe('Explorer');
  });

  it('should handle edge case: 200 XP reaches Thinker (Level 2)', () => {
    expect(getLevelByXp(200).level).toBe(2);
    expect(getLevelByXp(200).title).toBe('Thinker');
  });

  it('should return Math Master for high XP (2500)', () => {
    expect(getLevelByXp(2500).level).toBe(6);
  });
});
