begin;

create extension if not exists pgcrypto;

create table if not exists public.developer_ideas (
  id uuid primary key default gen_random_uuid(),
  owner text not null check (owner in ('biggy', 'petchpetch')),
  idea_text text not null check (char_length(idea_text) between 3 and 4000),
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.developer_idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.developer_ideas(id) on delete cascade,
  author text not null check (author in ('biggy', 'petchpetch')),
  comment_text text not null check (char_length(comment_text) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists developer_ideas_owner_created_idx on public.developer_ideas (owner, created_at desc);
create index if not exists developer_idea_comments_idea_created_idx on public.developer_idea_comments (idea_id, created_at asc);

alter table public.developer_ideas enable row level security;
alter table public.developer_idea_comments enable row level security;
revoke all on table public.developer_ideas from anon, authenticated;
revoke all on table public.developer_idea_comments from anon, authenticated;

commit;
