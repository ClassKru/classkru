-- Admin-managed Media Studio model selection. Provider credentials stay in Vercel.
begin;

create table if not exists public.media_ai_model_settings (
  id text primary key check (id = 'default'),
  planner_model text not null default '',
  builder_model text not null default '',
  image_model text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'developer-console'
);

insert into public.media_ai_model_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.media_ai_model_settings enable row level security;
revoke all on table public.media_ai_model_settings from anon, authenticated;
grant select, insert, update on table public.media_ai_model_settings to service_role;

commit;
