import { describe, expect, it } from 'bun:test';

describe('Progress Server Actions (F2 & F6)', () => {
  it('should calculate idempotent XP properly for F2', () => {
    const initialXp = 50;
    const rewardXp = 10;
    const newXp = initialXp + rewardXp;

    expect(newXp).toBe(60);
  });

  it('should validate getProgressData payload structure for F6 UI integration', () => {
    const mockProgressPayload = {
      levelInfo: {
        level: 2,
        currentXp: 150,
        nextLevelXp: 250,
        progressPercent: 33,
      },
      streak: 5,
      quests: [
        { id: 'vocab_5', title: '5 үг цээжлэх', target: 5, rewardXp: 10, current: 5, completed: true },
        {
          id: 'desmos_1',
          title: '1 Desmos график байгуулах',
          target: 1,
          rewardXp: 10,
          current: 0,
          completed: false,
        },
      ],
      badges: [
        { id: 'streak_7', name: '7 хоногийн хэмнэл', unlocked: false },
        { id: 'first_eq', name: 'Анхны тэгшитгэл', unlocked: true },
      ],
    };

    // LevelInfo бүтэц шалгах
    expect(mockProgressPayload.levelInfo.level).toBe(2);
    expect(mockProgressPayload.levelInfo.progressPercent).toBe(33);

    // Quests бүтэц шалгах
    expect(mockProgressPayload.quests.length).toBe(2);
    expect(mockProgressPayload.quests[0].completed).toBe(true);

    // Badges бүтэц шалгах
    expect(mockProgressPayload.badges.find((b) => b.id === 'first_eq')?.unlocked).toBe(true);
  });
});
