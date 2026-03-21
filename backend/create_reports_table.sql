-- Create reports table expected by frontend/src/services/data.ts (reportsService.createReport)
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('observation', 'diagnostic')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_child_created
  on public.reports(child_id, created_at desc);

create index if not exists idx_reports_author_created
  on public.reports(author_id, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "Parents can view own child reports" on public.reports;
create policy "Parents can view own child reports"
  on public.reports
  for select
  using (
    exists (
      select 1
      from public.children c
      where c.id = reports.child_id
        and c.parent_id = auth.uid()
    )
  );

drop policy if exists "Doctors can view assigned child reports" on public.reports;
create policy "Doctors can view assigned child reports"
  on public.reports
  for select
  using (
    exists (
      select 1
      from public.children c
      where c.id = reports.child_id
        and c.assigned_doctor_id = auth.uid()
    )
  );

drop policy if exists "Therapists can view assigned child reports" on public.reports;
create policy "Therapists can view assigned child reports"
  on public.reports
  for select
  using (
    exists (
      select 1
      from public.children c
      where c.id = reports.child_id
        and c.assigned_therapist_id = auth.uid()
    )
  );

drop policy if exists "Doctors can insert reports for assigned children" on public.reports;
create policy "Doctors can insert reports for assigned children"
  on public.reports
  for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1
      from public.children c
      where c.id = reports.child_id
        and c.assigned_doctor_id = auth.uid()
    )
  );

drop policy if exists "Report authors can update own reports" on public.reports;
create policy "Report authors can update own reports"
  on public.reports
  for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
