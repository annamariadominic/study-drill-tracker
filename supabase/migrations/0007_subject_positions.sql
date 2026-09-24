-- Subjects get a manual order within their Domain: a contiguous 0-based
-- integer position. A reorder rewrites every sibling's position, which is fine
-- at this app's scale.

alter table subjects add column position integer;

-- Backfill from the order the app showed until now (created_at), with id as a
-- tiebreaker so the result is deterministic.
update subjects
set position = ranked.position
from (
  select id, (row_number() over (partition by domain_id order by created_at, id) - 1)::integer as position
  from subjects
) as ranked
where subjects.id = ranked.id;

alter table subjects alter column position set not null;

-- Deferred to commit so a reorder can rewrite positions in any row order
-- without tripping over a sibling's old position mid-transaction.
alter table subjects
  add constraint subjects_domain_id_position_key unique (domain_id, position)
  deferrable initially deferred;

-- Puts a Domain's Subjects in the given order. Validation and the rewrite
-- share this one transaction: subject_ids must be exactly the Domain's
-- current Subjects, each once, or nothing changes.
create function reorder_subjects(target_domain_id uuid, subject_ids uuid[]) returns void
language plpgsql
set search_path = public
as $$
declare
  requested integer := coalesce(cardinality(subject_ids), 0);
begin
  if not exists (select 1 from domains where id = target_domain_id) then
    raise exception 'reorder_subjects: Domain not found: %', target_domain_id
      using errcode = 'P0002';
  end if;

  -- Lock the siblings so a concurrent reorder can't interleave with this one.
  perform 1 from subjects where domain_id = target_domain_id for update;

  if requested <> (select count(distinct id) from unnest(subject_ids) as id)
    or requested <> (select count(*) from subjects where domain_id = target_domain_id)
    or requested <> (
      select count(*) from subjects where domain_id = target_domain_id and id = any (subject_ids)
    )
  then
    raise exception 'reorder_subjects: subject_ids must list each of the Domain''s Subjects exactly once'
      using errcode = '22023';
  end if;

  update subjects
  set position = (ordered.ordinality - 1)::integer
  from unnest(subject_ids) with ordinality as ordered (id, ordinality)
  where subjects.id = ordered.id;
end;
$$;

-- Only the server (secret key) reorders Subjects.
revoke execute on function reorder_subjects(uuid, uuid[]) from public, anon, authenticated;
grant execute on function reorder_subjects(uuid, uuid[]) to service_role;
