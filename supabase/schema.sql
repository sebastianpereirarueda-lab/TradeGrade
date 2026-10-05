-- TradeGrade: run this once in the Supabase SQL editor (Database -> SQL).
-- One row of JSON per user for trades, journals, rules, notes and settings,
-- one row per journal attachment, and a private storage bucket for the files.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_data enable row level security;
drop policy if exists "own data" on public.user_data;
create policy "own data" on public.user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.attachments (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       text not null,
  name       text not null,
  type       text not null,
  size       bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists attachments_user_date on public.attachments (user_id, date);
alter table public.attachments enable row level security;
drop policy if exists "own attachments" on public.attachments;
create policy "own attachments" on public.attachments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
  values ('media', 'media', false)
  on conflict (id) do nothing;
drop policy if exists "own media" on storage.objects;
create policy "own media" on storage.objects
  for all using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
