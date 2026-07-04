create table if not exists public.whitepaper_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now()
);

alter table public.whitepaper_settings enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.whitepaper_settings to service_role;

insert into public.whitepaper_settings (setting_key, setting_value)
values ('admin_secret_sha256', '503ab334e01923957a4320af3c77082140d934c7db46678b32588aec9b3f1cba')
on conflict (setting_key) do nothing;
