create table questions (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references concepts (id) on delete cascade,
  type text not null check (type in ('recall', 'flashcard')),
  prompt text not null,
  options jsonb,
  correct_option_index integer,
  created_at timestamptz not null default now()
);

create index questions_concept_id_idx on questions (concept_id);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete cascade,
  submitted_answer text not null,
  confidence text not null check (confidence in ('guessed', 'partial', 'confident')),
  correctness text not null check (correctness in ('correct', 'partial', 'incorrect')),
  graded_explanation text not null,
  created_at timestamptz not null default now()
);

create index attempts_question_id_idx on attempts (question_id);
