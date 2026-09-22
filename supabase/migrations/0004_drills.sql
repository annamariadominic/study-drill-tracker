create table drills (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references domains (id) on delete cascade,
  scope text not null check (scope in ('due')),
  scope_detail jsonb,
  created_at timestamptz not null default now()
);

create index drills_domain_id_idx on drills (domain_id);

alter table questions
  add column drill_id uuid references drills (id) on delete cascade,
  add column position integer;

create index questions_drill_id_idx on questions (drill_id);
create unique index questions_drill_id_position_idx on questions (drill_id, position);
