import { describe, expect, it } from 'bun:test';
import { calculateNewStreak } from './streak';

describe('Streak Logic & Timezone Asia/Ulaanbaatar (F1)', () => {
  it('should increment streak if last active was yesterday', () => {
    const result = calculateNewStreak('2026-10-22', 5, '2026-10-23');
    expect(result.streak).toBe(6);
    expect(result.updated).toBe(true);
  });

  it('should keep streak same if active multiple times today', () => {
    const result = calculateNewStreak('2026-10-23', 5, '2026-10-23');
    expect(result.streak).toBe(5);
    expect(result.updated).toBe(false);
  });

  it('should reset streak to 1 if days are missed', () => {
    const result = calculateNewStreak('2026-10-20', 5, '2026-10-23');
    expect(result.streak).toBe(1);
    expect(result.updated).toBe(true);
  });
});
