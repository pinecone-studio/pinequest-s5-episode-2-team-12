import { describe, expect, it } from 'bun:test';
import { BADGES, checkBadgeUnlocks } from './badge-rules';

describe('Badge Rules Engine (F4)', () => {
  it('should have exactly 10 badge definitions', () => {
    expect(BADGES.length).toBe(10);
  });

  it('should unlock 7-day streak badge when streak >= 7', () => {
    const unlocked = checkBadgeUnlocks(
      { totalXp: 100, streak: 7, questsCompletedToday: 0, masteryLevels: {} },
      [],
    );
    expect(unlocked).toContain('streak_7');
  });

  it('should not unlock already earned badges', () => {
    const unlocked = checkBadgeUnlocks(
      { totalXp: 100, streak: 7, questsCompletedToday: 0, masteryLevels: {} },
      ['streak_7'],
    );
    expect(unlocked).not.toContain('streak_7');
  });
});
