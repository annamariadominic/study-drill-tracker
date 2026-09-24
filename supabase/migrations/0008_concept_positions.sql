-- Concepts get a manual order within their Subject: a contiguous 0-based
-- integer position, the same scheme as Subjects (0007). Ordering is purely
-- presentational: nothing here touches status, studied_at or the review
-- schedule.

alter table concepts add column position integer;

-- Backfill from the order the app showed until now (created_at), with id as a
-- tiebreaker so the result is deterministic.
update concepts
set position = ranked.position
from (
  select id, (row_number() over (partition by subject_id order by created_at, id) - 1)::integer as position
  from concepts
) as ranked
where concepts.id = ranked.id;

alter table concepts alter column position set not null;

-- Deferred to commit so a reorder can rewrite positions in any row order
-- without tripping over a sibling's old position mid-transaction.
alter table concepts
  add constraint concepts_subject_id_position_key unique (subject_id, position)
  deferrable initially deferred;

-- Puts a Subject's Concepts in the given order. Validation and the rewrite
-- share this one transaction: concept_ids must be exactly the Subject's
-- current Concepts, each once, or nothing changes. Only position is written.
create function reorder_concepts(target_subject_id uuid, concept_ids uuid[]) returns void
language plpgsql
set search_path = public
as $$
declare
  requested integer := coalesce(cardinality(concept_ids), 0);
begin
  if not exists (select 1 from subjects where id = target_subject_id) then
    raise exception 'reorder_concepts: Subject not found: %', target_subject_id
      using errcode = 'P0002';
  end if;

  -- Lock the siblings so a concurrent reorder can't interleave with this one.
  perform 1 from concepts where subject_id = target_subject_id for update;

  if requested <> (select count(distinct id) from unnest(concept_ids) as id)
    or requested <> (select count(*) from concepts where subject_id = target_subject_id)
    or requested <> (
      select count(*) from concepts where subject_id = target_subject_id and id = any (concept_ids)
    )
  then
    raise exception 'reorder_concepts: concept_ids must list each of the Subject''s Concepts exactly once'
      using errcode = '22023';
  end if;

  update concepts
  set position = (ordered.ordinality - 1)::integer
  from unnest(concept_ids) with ordinality as ordered (id, ordinality)
  where concepts.id = ordered.id;
end;
$$;

-- Only the server (secret key) reorders Concepts.
revoke execute on function reorder_concepts(uuid, uuid[]) from public, anon, authenticated;
grant execute on function reorder_concepts(uuid, uuid[]) to service_role;
