-- A Question can ask about several Concepts: exactly one for recall and
-- flashcard, two or more for a scenario. That cardinality rule is enforced in
-- application code (assertQuestionConcepts); the schema only holds the links.
create table question_concepts (
  question_id uuid not null references questions (id) on delete cascade,
  -- No cascade: deleting a Concept that Questions still ask about would leave
  -- those Questions with too few Concepts, so the delete is refused instead.
  -- A delete that also removes the Questions (e.g. of a whole Domain, which
  -- takes its Drills with it) still succeeds, as the check runs at the end of
  -- the statement.
  concept_id uuid not null references concepts (id) on delete no action,
  -- The order the Question presents its Concepts in.
  position integer not null,
  primary key (question_id, concept_id),
  unique (question_id, position)
);

create index question_concepts_concept_id_idx on question_concepts (concept_id);

-- Every existing Question asks about exactly one Concept.
insert into question_concepts (question_id, concept_id, position)
  select id, concept_id, 0 from questions;

drop index questions_concept_id_idx;
alter table questions drop column concept_id;

alter table questions drop constraint questions_type_check;
alter table questions
  add constraint questions_type_check check (type in ('recall', 'flashcard', 'scenario'));

-- Inserts a batch of Questions together with their Concept links in one
-- transaction, so a Drill's Questions are all written or none are. Persistence
-- only: which Concepts a Question may combine is decided by the caller.
--
-- Takes a JSON array of objects with keys drill_id, position, type, prompt,
-- options, correct_option_index and concept_ids (an array, in presentation
-- order). Returns the inserted question rows as a JSON array in input order.
create function create_questions(questions jsonb) returns jsonb
language plpgsql
as $$
declare
  input jsonb;
  inserted questions;
  created jsonb := '[]'::jsonb;
begin
  for input in select value from jsonb_array_elements(questions) with ordinality order by ordinality
  loop
    insert into questions (drill_id, position, type, prompt, options, correct_option_index)
    values (
      (input ->> 'drill_id')::uuid,
      (input ->> 'position')::integer,
      input ->> 'type',
      input ->> 'prompt',
      nullif(input -> 'options', 'null'::jsonb),
      (input ->> 'correct_option_index')::integer
    )
    returning * into inserted;

    insert into question_concepts (question_id, concept_id, position)
      select inserted.id, concept.value::uuid, (concept.ordinality - 1)::integer
      from jsonb_array_elements_text(input -> 'concept_ids') with ordinality as concept;

    created := created || jsonb_build_array(to_jsonb(inserted));
  end loop;

  return created;
end;
$$;

-- Only the server (secret key) writes Questions.
revoke execute on function create_questions(jsonb) from public, anon, authenticated;
grant execute on function create_questions(jsonb) to service_role;
