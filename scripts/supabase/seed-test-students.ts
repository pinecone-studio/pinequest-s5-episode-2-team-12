// Intentional synthetic QA fixtures. Never writes XP, attempts, exams, sign-ins or other activity metrics.
import { createClient } from '@supabase/supabase-js';
import { AVATARS } from '../../src/components/brand/avatars';
import { AIMAGS } from '../../src/lib/aimags';

const BATCH = 'test-students-2026-10-v1';
const COUNT = 160;
const names = [
  'Ану',
  'Номин',
  'Тэмүүлэн',
  'Мишээл',
  'Саруул',
  'Билгүүн',
  'Хүслэн',
  'Энхжин',
  'Төгөлдөр',
  'Сондор',
  'Тэнүүн',
  'Халиун',
  'Ананд',
  'Дөлгөөн',
  'Марал',
  'Тамир',
  'Хулан',
  'Эрдэм',
  'Уянга',
  'Ивээл',
  'Эрхэс',
  'Намуун',
  'Солонго',
  'Тэргэл',
  'Цэлмэг',
  'Болор',
  'Түшиг',
  'Итгэл',
  'Оюун',
  'Хангай',
  'Есүй',
  'Энэрэл',
];
const initials = ['Б', 'Э', 'Г', 'М', 'С'];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase configuration');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const existing = new Map<string, string>();
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const user of data.users)
    if (user.app_metadata.synthetic_batch === BATCH && user.email) existing.set(user.email, user.id);
  if (data.users.length < 1000) break;
}
console.log(`Batch ${BATCH}: ${COUNT} synthetic students; ${existing.size} already present.`);
if (!process.argv.includes('--apply')) {
  console.log('Dry run only. Use --apply to create the accounts.');
  process.exit(0);
}
for (let index = 0; index < COUNT; index++) {
  const email = `student-${String(index + 1).padStart(3, '0')}@synthetic.suuprep.invalid`;
  const name = `${initials[Math.floor(index / names.length)]}. ${names[index % names.length]}`;
  let id = existing.get(email);
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { name, full_name: name },
      app_metadata: {
        is_synthetic: true,
        synthetic_batch: BATCH,
        data_classification: 'test_fixture',
        simulated_progress: {
          completed_levels: index % 14,
          practice_tests_completed: index % 4,
          sample_math_score: 450 + ((index * 7) % 35) * 10,
          sample_xp: 200 + index * 31,
        },
      },
      ban_duration: '876000h',
    });
    if (error || !data.user) throw new Error(`Create ${index + 1}: ${error?.message}`);
    id = data.user.id;
  }
  const { error } = await db.from('profiles').upsert(
    {
      id,
      name,
      onboarded: true,
      avatar_id: AVATARS[index % AVATARS.length].id,
      aimag: AIMAGS[index % AIMAGS.length],
      target: 600 + (index % 21) * 10,
      exam_date: '2026-12-05',
      sat_exp: 'some',
      confidence: 2 + (index % 4),
      desmos: ['never', 'little', 'often'][index % 3],
      study_minutes: [15, 30, 45, 60][index % 4],
      start: 'foundations',
      hide_public: true,
      friends_only: true,
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`Profile ${index + 1}: ${error.message}`);
  if ((index + 1) % 20 === 0) console.log(`${index + 1}/${COUNT} synthetic profiles ready`);
}
console.log('Complete. No real activity events or sign-ins were fabricated.');
