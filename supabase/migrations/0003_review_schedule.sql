alter table concepts
  add column review_interval_days integer,
  add column review_ease_factor double precision,
  add column next_review_due_at timestamptz;

create index concepts_next_review_due_at_idx on concepts (next_review_due_at);
