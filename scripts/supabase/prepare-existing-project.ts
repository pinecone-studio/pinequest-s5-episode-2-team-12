// Builds an idempotent SQL bootstrap for the existing legacy Supabase project.
// It preserves legacy questions and extends profiles; the app bank uses learning_questions.
// Run with Bun and an output SQL path, then execute the file in the project's SQL Editor.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = resolve(import.meta.dir, '../../supabase/migrations');
const files = readdirSync(directory)
  .filter((file) => /^\d+.*\.sql$/.test(file))
  .sort();
const preamble = `begin;
create table if not exists public.suuprep_schema_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now());
alter table public.suuprep_schema_migrations enable row level security;
revoke all on public.suuprep_schema_migrations from anon, authenticated;
alter table public.profiles
 add column if not exists name text not null default '',
 add column if not exists onboarded boolean not null default false,
 add column if not exists confidence integer,
 add column if not exists sat_exp text,
 add column if not exists desmos text,
 add column if not exists target integer not null default 650,
 add column if not exists exam_date date,
 add column if not exists start text;
do $bridge$ begin
 if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='full_name') then
  execute 'update public.profiles set name = coalesce(full_name, '''') where name = ''''';
 end if;
 if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='target_score') then
  execute 'update public.profiles set target = target_score where not onboarded and target_score between 200 and 800';
 end if;
 if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='test_date') then
  execute 'update public.profiles set exam_date = test_date where exam_date is null and test_date is not null';
 end if;
end $bridge$;
`;
const migrations = files
  .map((file, index) => {
    const original = readFileSync(resolve(directory, file), 'utf8');
    const checksum = createHash('sha256').update(original).digest('hex');
    // Keep the legacy questions table and all of its records/RPCs intact.
    let sql = original.replace(/\bquestions\b/g, 'learning_questions');
    if (file === '0001_init.sql') {
      // The project already has own-select/insert/update policies; don't add a broader ALL policy.
      sql = sql.replace(/^create policy "own profile"[^\n]+\n/m, '');
    }
    const delimiter = `$suuprep_migration_${index}$`;
    return `do $runner$ begin
 if not exists (select 1 from public.suuprep_schema_migrations where name = '${file}') then
  execute ${delimiter}${sql}${delimiter};
  insert into public.suuprep_schema_migrations(name, checksum) values ('${file}', '${checksum}');
 end if;
end $runner$;\n`;
  })
  .join('\n');
const end = `\nnotify pgrst, 'reload schema';
commit;
select count(*) as applied_migrations from public.suuprep_schema_migrations;\n`;
const output = resolve(process.argv[2] ?? 'work/supabase-existing-project.sql');
writeFileSync(output, preamble + migrations + end);
console.log(`Prepared ${files.length} migrations in ${output}`);
