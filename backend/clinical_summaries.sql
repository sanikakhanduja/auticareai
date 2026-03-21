-- Cache clinical summary agent outputs by child + screening snapshot + role.
create table if not exists public.clinical_summaries (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  source_screening_id uuid not null references public.screening_results(id) on delete cascade,
  role text not null check (role in ('parent', 'therapist', 'doctor')),
  summary_json jsonb not null,
  generated_by text not null check (generated_by in ('deterministic', 'gemini')),
  model text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_clinical_summaries_child_role_created
  on public.clinical_summaries(child_id, role, created_at desc);

create index if not exists idx_clinical_summaries_source
  on public.clinical_summaries(source_screening_id);
