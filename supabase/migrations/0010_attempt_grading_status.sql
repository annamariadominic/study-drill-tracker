-- A recall or scenario Attempt is recorded before the LLM grades it and is
-- graded in the background (ADR 0011), so an Attempt now carries where its
-- grade has got to. Existing rows were graded when recorded: the default marks
-- them graded, and keeps the previous code's inserts valid while this
-- migration is applied ahead of the code that writes the status.
alter table attempts
  add column grading_status text not null default 'graded'
    check (grading_status in ('pending', 'graded', 'failed'));

-- The Concepts this Attempt advances once graded, decided at submission
-- (ADR 0006) and kept so a grade arriving later, or a retry, applies the same
-- decision. Existing rows already applied theirs.
alter table attempts
  add column advances_concept_ids uuid[] not null default '{}';

-- No grade exists while grading is pending or has failed.
alter table attempts
  alter column correctness drop not null,
  alter column graded_explanation drop not null;

alter table attempts
  add constraint attempts_graded_has_grade
    check (grading_status <> 'graded' or (correctness is not null and graded_explanation is not null));
