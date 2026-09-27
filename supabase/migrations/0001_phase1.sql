-- Phase 1: roles, rubric, CV shortlist.
-- Run this once in the Supabase SQL editor (or `supabase db push`).
-- Every table is locked to the owning recruiter with row-level security.

create extension if not exists pgcrypto;

-- Roles (one per job description) ---------------------------------------------
create table public.roles (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null,
  jd            text not null,
  -- { experience_level, summary, criteria: [{ id, name, description, kind, weight }] }
  rubric        jsonb,
  rubric_locked boolean not null default false,
  status        text not null default 'open' check (status in ('open', 'closed')),
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);

-- Candidates (one per uploaded CV) --------------------------------------------
create table public.candidates (
  id              uuid primary key default gen_random_uuid(),
  role_id         uuid not null references public.roles (id) on delete cascade,
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cv_path         text not null,
  cv_filename     text not null,
  status          text not null default 'uploaded'
                  check (status in ('uploaded', 'scoring', 'scored', 'failed')),
  -- Contact details are kept apart from the profile the scorer sees.
  contact         jsonb,
  -- Anonymised profile: no name, gender, age, religion, caste, marital status, photo or address.
  profile         jsonb,
  -- [{ criterion_id, score (0-5), evidence, reasoning }]
  scores          jsonb,
  fit_score       numeric(5, 1),
  missing_must_haves text[] not null default '{}',
  recommendation  text check (recommendation in ('strong_fit', 'possible_fit', 'not_a_fit')),
  summary         text,
  shortlisted     boolean not null default false,
  error           text,
  created_at      timestamptz not null default now(),
  scored_at       timestamptz
);

create index candidates_role_idx on public.candidates (role_id, fit_score desc nulls last);

-- Audit trail of every recruiter and AI action --------------------------------
create table public.audit_log (
  id           bigint generated always as identity primary key,
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role_id      uuid references public.roles (id) on delete set null,
  candidate_id uuid references public.candidates (id) on delete set null,
  action       text not null,
  details      jsonb,
  created_at   timestamptz not null default now()
);

-- Row-level security: a recruiter only ever sees their own rows -----------------
alter table public.roles      enable row level security;
alter table public.candidates enable row level security;
alter table public.audit_log  enable row level security;

create policy "owner manages roles" on public.roles
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner manages candidates" on public.candidates
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "owner reads audit log" on public.audit_log
  for select using (owner_id = auth.uid());
create policy "owner writes audit log" on public.audit_log
  for insert with check (owner_id = auth.uid());

-- Private storage bucket for CVs; files live under "<owner id>/<role id>/..." ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs', 'cvs', false, 10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy "owner uploads cvs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner reads cvs" on storage.objects
  for select to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner deletes cvs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
