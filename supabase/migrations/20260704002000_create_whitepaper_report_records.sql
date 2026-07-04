create table if not exists public.whitepaper_report_records (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  mode text not null default 'simple',
  art_category text,
  input jsonb not null default '{}'::jsonb,
  score_profile jsonb not null default '{}'::jsonb,
  rank_estimate jsonb not null default '{}'::jsonb,
  narratives jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint whitepaper_report_records_input_object check (jsonb_typeof(input) = 'object'),
  constraint whitepaper_report_records_score_profile_object check (jsonb_typeof(score_profile) = 'object'),
  constraint whitepaper_report_records_rank_estimate_object check (jsonb_typeof(rank_estimate) = 'object'),
  constraint whitepaper_report_records_narratives_object check (jsonb_typeof(narratives) = 'object'),
  constraint whitepaper_report_records_report_object check (jsonb_typeof(report) = 'object'),
  constraint whitepaper_report_records_meta_object check (jsonb_typeof(meta) = 'object')
);

alter table public.whitepaper_report_records enable row level security;

create index if not exists whitepaper_report_records_created_at_idx
  on public.whitepaper_report_records (created_at desc);

create index if not exists whitepaper_report_records_student_name_idx
  on public.whitepaper_report_records (student_name);

grant usage on schema public to service_role;
grant select, insert, update, delete on public.whitepaper_report_records to service_role;
