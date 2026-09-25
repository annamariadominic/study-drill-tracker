-- A free-text Attempt keeps the grader's model answer alongside its
-- explanation, so feedback can always show what a strong answer would have
-- said. Nullable: flashcard Attempts don't need one (the correct option is on
-- the Question), and Attempts graded before this column existed have none.

alter table attempts add column reference_answer text;
