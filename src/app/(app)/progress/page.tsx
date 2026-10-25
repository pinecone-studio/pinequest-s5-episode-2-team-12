import { getProfile } from '@/features/home/queries';
import { getProgressData } from '@/features/progress/actions';

export default async function ProgressPage() {
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

  const { levelInfo, streak } = progressData;

  const levelRoadmap = [
    { lvl: 1, name: 'Судлаач · Explorer', xp: 0 },
    { lvl: 2, name: 'Сэтгэгч · Thinker', xp: 200 },
    { lvl: 3, name: 'Бодлогч · Problem Solver', xp: 500 },
    { lvl: 4, name: 'Графикийн жолооч · Graph Navigator', xp: 900 },
    { lvl: 5, name: 'Desmos стратегич · Desmos Strategist', xp: 1400 },
    { lvl: 6, name: 'Математикийн мастер · Math Master', xp: 2000 },
  ];

  const currentLevelObj = levelRoadmap.find((r) => r.lvl === levelInfo.level) || levelRoadmap[0];
  const [mnName, enName] = currentLevelObj.name.split(' · ');

  return (
    <div className="min-h-screen bg-[#060b08] text-white p-8 font-sans space-y-8">
      <div>
        <span className="text-[10px] uppercase tracking-widest text-[#4ade80] font-semibold">МИНИЙ АХИЦ</span>
        <h1 className="text-4xl font-extrabold tracking-tight mt-1">Ахиц ба эзэмшил</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Түвшин нь хичээл зүтгэлийг, эзэмшил нь мэдлэгийг хэмждэг. Хоёуланг нь тусад нь харцгаая.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-[#0b140f] border border-[#182c1f] rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex items-center gap-6">
            {/* Дугуй Progress Gauge */}
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#15271c]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#4ade80]"
                  strokeDasharray={`${levelInfo.progressPercent}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black">{levelInfo.level}</span>
                <span className="text-[9px] text-zinc-400 uppercase tracking-widest">ТҮВШИН</span>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold">{mnName}</h3>
              <p className="text-xs text-zinc-400">{enName}</p>
              <p className="text-2xl font-extrabold text-[#4ade80] mt-1">
                {levelInfo.currentXp} <span className="text-sm font-normal text-zinc-400">XP</span>
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-2 border-t border-[#16271c] pt-4">
            {levelRoadmap.map((item) => {
              const isCurrent = item.lvl === levelInfo.level;
              return (
                <div
                  key={item.lvl}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors ${
                    isCurrent ? 'bg-[#14281c] text-[#4ade80]' : 'text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                        isCurrent ? 'bg-[#22472f] text-[#4ade80]' : 'bg-[#142219] text-zinc-500'
                      }`}
                    >
                      {item.lvl}
                    </span>
                    <span>{item.name}</span>
                  </div>
                  <span>{item.xp} XP</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#0b140f] border border-[#182c1f] rounded-3xl p-6 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest">СҮҮЛИЙН 7 ХОНОГ</span>
                <h3 className="text-2xl font-bold mt-0.5">XP · {levelInfo.currentXp}</h3>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 text-xs bg-[#193222] text-[#4ade80] rounded-full font-medium">
                  {streak} өдөр дараалсан
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="bg-[#121f17] p-4 rounded-2xl text-center">
              <p className="text-2xl font-black">0</p>
              <p className="text-[11px] text-zinc-400 mt-1">бодсон бодлого</p>
            </div>
            <div className="bg-[#121f17] p-4 rounded-2xl text-center">
              <p className="text-2xl font-black text-[#4ade80]">0%</p>
              <p className="text-[11px] text-zinc-400 mt-1">нарийвчлал</p>
            </div>
            <div className="bg-[#121f17] p-4 rounded-2xl text-center">
              <p className="text-2xl font-black">0</p>
              <p className="text-[11px] text-zinc-400 mt-1">сурсан үг</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
