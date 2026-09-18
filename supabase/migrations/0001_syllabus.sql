create table domains (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references domains (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index subjects_domain_id_idx on subjects (domain_id);

create table concepts (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects (id) on delete cascade,
  name text not null,
  notes text,
  status text not null default 'planned' check (status in ('planned', 'studied')),
  studied_at timestamptz,
  created_at timestamptz not null default now()
);

create index concepts_subject_id_idx on concepts (subject_id);
