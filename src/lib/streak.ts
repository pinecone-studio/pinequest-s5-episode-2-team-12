export function getUlaanbaatarDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function calculateNewStreak(
  lastActiveDate: string | null,
  currentStreak: number,
  today: string = getUlaanbaatarDate(),
): { streak: number; updated: boolean } {
  if (!lastActiveDate) {
    return { streak: 1, updated: true };
  }

  const lastDate = new Date(lastActiveDate);
  const currentDate = new Date(today);
  const diffTime = currentDate.getTime() - lastDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Өнөөдөр аль хэдийн идэвхтэй байсан
    return { streak: currentStreak, updated: false };
  } else if (diffDays === 1) {
    // Өчигдөр сурсан байвал +1 нэмнэ
    return { streak: currentStreak + 1, updated: true };
  } else {
    // Тасалсан бол 1 рүү унана (Гэмшүүрсэн текст байхгүй)
    return { streak: 1, updated: true };
  }
}
