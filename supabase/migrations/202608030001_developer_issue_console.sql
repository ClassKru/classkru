begin;

create extension if not exists pgcrypto;

create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references auth.users(id) on delete set null,
  message text not null check (char_length(message) between 5 and 4000),
  page_url text not null default '' check (char_length(page_url) <= 800),
  browser_info text not null default '' check (char_length(browser_info) <= 800),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists issue_reports_created_at_idx on public.issue_reports (created_at desc);
create index if not exists issue_reports_status_idx on public.issue_reports (status);
create index if not exists issue_reports_reporter_idx on public.issue_reports (reporter_id);

create or replace function public.set_issue_report_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists issue_reports_set_updated_at on public.issue_reports;
create trigger issue_reports_set_updated_at
before update on public.issue_reports
for each row execute function public.set_issue_report_updated_at();

alter table public.issue_reports enable row level security;

drop policy if exists "Authenticated users can create their own issue reports" on public.issue_reports;
create policy "Authenticated users can create their own issue reports"
on public.issue_reports for insert
to authenticated
with check (reporter_id = auth.uid() and status = 'new');

drop policy if exists "Authenticated users can read their own issue reports" on public.issue_reports;
create policy "Authenticated users can read their own issue reports"
on public.issue_reports for select
to authenticated
using (reporter_id = auth.uid());

revoke all on table public.issue_reports from anon;
grant select, insert on table public.issue_reports to authenticated;

commit;
