import { getProfile } from '@/features/home/queries';
import { getProgressData } from '@/features/progress/actions';

export default async function LeaguePage() {
  const userId = (await getProfile()).id;

  let progressData: Awaited<ReturnType<typeof getProgressData>> = {
    levelInfo: { level: 1, currentXp: 0, nextLevelXp: 100, progressPercent: 0 },
    streak: 0,
    quests: [],
    badges: [],
  };

  try {
    const data = await getProgressData(userId);
    if (data) {
      progressData = data;
    }
  } catch (error) {
    console.error('Өгөгдөл татахад алдаа гарлаа:', error);
  }

  const { levelInfo, streak, badges } = progressData;
  const unlockedBadgesCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="min-h-screen bg-[#060b08] text-white p-8 font-sans space-y-8">
      {/* Header */}
      <div>
        <span className="text-[10px] uppercase tracking-widest text-[#4ade80] font-semibold">
          ЧАНСАА БА ЛИГ
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight mt-1">Тэргүүлэгчдийн самбар</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Суралцах явцдаа цуглуулсан XP болон түвшнээрээ бусад суралцагчидтай өрсөлдөөрэй.
        </p>
      </div>

      {/* Top Grid: User Stats Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: User Rank Card */}
        <div className="lg:col-span-5 bg-[#0b140f] border border-[#182c1f] rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0 rounded-2xl bg-[#14281c] border border-[#22472f]">
              <span className="text-4xl">🥇</span>
            </div>

            <div>
              <span className="text-xs font-semibold text-[#4ade80] uppercase tracking-wider">
                МИНИЙ ЭРЭМБЭ #1
              </span>
              <h3 className="text-2xl font-bold mt-0.5">Level {levelInfo.level}</h3>
              <p className="text-xl font-extrabold text-[#4ade80] mt-1">
                {levelInfo.currentXp} <span className="text-xs font-normal text-zinc-400">XP</span>
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-[#16271c] pt-4 space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span>Дараагийн түвшин хүртэл</span>
              <span className="text-white font-medium">{levelInfo.progressPercent}%</span>
            </div>
            <div className="h-2 w-full bg-[#15271c] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4ade80] transition-all duration-500"
                style={{ width: `${levelInfo.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Streak & Badges Summary */}
        <div className="lg:col-span-7 bg-[#0b140f] border border-[#182c1f] rounded-3xl p-6 flex items-center justify-around">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#172b1d] flex items-center justify-center text-2xl border border-[#23452f]">
              🔥
            </div>
            <div>
              <p className="text-2xl font-black text-white">{streak} өдөр</p>
              <p className="text-xs text-zinc-400">Тасралтгүй хичээллэсэн</p>
            </div>
          </div>

          <div className="h-12 w-[1px] bg-[#182c1f]" />

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#172b1d] flex items-center justify-center text-2xl border border-[#23452f]">
              🏆
            </div>
            <div>
              <p className="text-2xl font-black text-white">
                {unlockedBadgesCount} / {badges.length}
              </p>
              <p className="text-xs text-zinc-400">Цуглуулсан тэмдэг</p>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table Section */}
      <div className="bg-[#0b140f] border border-[#182c1f] rounded-3xl p-6 space-y-4">
        <h2 className="text-xl font-bold">ТОП СУРАЛЦАГЧИД</h2>

        <div className="space-y-3">
          {/* Current User Row */}
          <div className="flex items-center justify-between bg-[#14281c] border border-[#22472f] p-4 rounded-2xl text-white font-medium">
            <div className="flex items-center gap-4">
              <span className="w-8 h-8 rounded-xl bg-[#22472f] text-[#4ade80] flex items-center justify-center font-bold text-sm">
                1
              </span>
              <div>
                <p className="font-bold text-sm">Та (Одоогийн хэрэглэгч)</p>
                <p className="text-xs text-zinc-400">Level {levelInfo.level}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-[#4ade80]">{levelInfo.currentXp} XP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
