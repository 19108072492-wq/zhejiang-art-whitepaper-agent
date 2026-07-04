create table if not exists public.whitepaper_datasets (
  dataset_key text primary key,
  records jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint whitepaper_datasets_key_check check (dataset_key in ('programs', 'rank')),
  constraint whitepaper_datasets_records_array check (jsonb_typeof(records) = 'array'),
  constraint whitepaper_datasets_meta_object check (jsonb_typeof(meta) = 'object')
);

alter table public.whitepaper_datasets enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.whitepaper_datasets to service_role;
