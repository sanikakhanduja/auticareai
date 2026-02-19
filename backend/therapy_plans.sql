-- Cache therapy planning agent outputs by child + diagnostic report.
create table if not exists public.therapy_plans (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  source_report_id uuid not null references public.reports(id) on delete cascade,
  plan_json jsonb not null,
  generated_by text not null check (generated_by in ('deterministic', 'gemini')),
  model text null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_therapy_plans_child_source_unique
  on public.therapy_plans(child_id, source_report_id);

create index if not exists idx_therapy_plans_child_created
  on public.therapy_plans(child_id, created_at desc);
