// Read-only by default. --auth also creates and removes one temporary test account; no emails are sent.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { OnboardingSchema, onboardingRow } from '../../src/features/onboarding/lib/schema';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
if (!url || !secret || !publicKey) throw new Error('Missing Supabase configuration');
const config = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, config);
const table =
  process.env.SUPABASE_QUESTIONS_TABLE === 'learning_questions' ? 'learning_questions' : 'questions';
for (const name of ['profiles', 'questions', table, 'stages', 'lessons', 'shop_items']) {
  const { count, error } = await admin.from(name).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`${name}: ${error.message}`);
  console.log(`${name}: ${count} rows accessible`);
}
if (process.argv.includes('--auth')) {
  let testId: string | undefined;
  try {
    const email = `suprep-connection-check-${Date.now()}@example.invalid`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createError) throw createError;
    testId = created.user.id;
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: 'http://localhost:3000/auth/callback?next=%2Fbank' },
    });
    if (linkError) throw linkError;
    const actionUrl = new URL(link.properties.action_link);
    const destination = actionUrl.searchParams.get('redirect_to');
    console.log(
      `Auth callback: ${destination?.startsWith('http://localhost:3000/auth/callback') ? 'accepted' : 'not yet allow-listed'}`,
    );
    const client = createClient(url, publicKey, config);
    const { data: session, error: loginError } = await client.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: 'magiclink',
    });
    if (loginError) throw loginError;
    if (session.user?.id !== testId) throw Error('Auth session belongs to the wrong account');
    console.log('Email auth verification: passed (no email sent)');
    const answers = OnboardingSchema.parse({
      name: 'Connection check',
      satExp: 'none',
      lastMathScore: null,
      target: 700,
      examDate: '',
      confidence: 3,
      desmos: 'never',
      studyMinutes: 30,
      start: 'foundations',
    });
    const { error: saveError } = await client
      .from('profiles')
      .upsert(onboardingRow(testId, answers), { onConflict: 'id' });
    if (saveError) throw Error(`Onboarding save: ${saveError.message}`);
    const { data: rows, error: readError } = await client.from('profiles').select('id,onboarded,target');
    if (readError || rows?.length !== 1 || rows[0].id !== testId || !rows[0].onboarded)
      throw Error('Profile isolation or onboarding persistence failed');
    console.log('Onboarding persistence and own-profile isolation: passed');
    const { error: roleError } = await client.from('profiles').update({ role: 'admin' }).eq('id', testId);
    if (!roleError) throw Error('Role elevation was not blocked');
    console.log('Student role escalation: blocked');
    const { data: bank, error: bankError } = await client.from(table).select('id');
    if (!bankError && bank?.length) throw Error('Student can read the private answer table');
    console.log('Direct student access to private answer bank: blocked');
  } finally {
    if (testId) {
      const { error } = await admin.auth.admin.deleteUser(testId);
      if (error) {
        console.error('Temporary account cleanup failed');
        process.exitCode = 1;
      } else console.log('Temporary test account removed');
    }
  }
}
if (process.env.SUPABASE_BACKUP_DIR) {
  for (const name of ['profiles', 'questions']) {
    const original = JSON.parse(
      readFileSync(`${process.env.SUPABASE_BACKUP_DIR}/supabase-backup-${name}.json`, 'utf8'),
    );
    const { data: current, error } = await admin.from(name).select('*');
    if (error) throw error;
    if (
      original.length !== current?.length ||
      original.some((row: Record<string, unknown>) => {
        const found = current.find((item) => item.id === row.id);
        return (
          !found || Object.keys(row).some((key) => JSON.stringify(row[key]) !== JSON.stringify(found[key]))
        );
      })
    )
      throw Error(`Original ${name} data changed`);
    console.log(`Original ${name} data: preserved`);
  }
}
