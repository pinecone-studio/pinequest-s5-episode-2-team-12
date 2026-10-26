import { describe, expect, it } from 'bun:test';
import { calculateLevel } from './level';

describe('Level Calculation Engine (F5)', () => {
  it('should return Level 1 for 0 XP', () => {
    const res = calculateLevel(0);
    expect(res.level).toBe(1);
    expect(res.progressPercent).toBe(0);
  });

  it('should calculate correct level for higher XP', () => {
    const res = calculateLevel(150);
    expect(res.level).toBe(2);
    expect(res.progressPercent).toBeGreaterThan(0);
  });
});
