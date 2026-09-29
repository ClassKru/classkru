begin;
create table if not exists public.developer_ai_settings (
  id text primary key check (id = 'media_ai'),
  provider text not null default 'openai' check (provider = 'openai'),
  encrypted_api_key text not null,
  planner_model text not null check (char_length(planner_model) between 1 and 120),
  builder_model text not null check (char_length(builder_model) between 1 and 120),
  updated_at timestamptz not null default now()
);
alter table public.developer_ai_settings enable row level security;
revoke all on public.developer_ai_settings from anon, authenticated;
grant all on public.developer_ai_settings to service_role;
commit;
