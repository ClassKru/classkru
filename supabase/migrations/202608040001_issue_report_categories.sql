begin;

alter table public.issue_reports
add column if not exists category text not null default 'issue';

alter table public.issue_reports
drop constraint if exists issue_reports_category_check;

alter table public.issue_reports
add constraint issue_reports_category_check
check (category in ('issue', 'feature'));

create index if not exists issue_reports_category_idx
on public.issue_reports (category);

commit;
