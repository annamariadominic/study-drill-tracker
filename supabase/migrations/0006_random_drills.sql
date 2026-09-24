-- A Drill can be started on demand, whether or not anything is due. Its
-- scope_detail records what it drew from: {"kind": "library"},
-- {"kind": "subject", "subjectId": ...} or {"kind": "concepts", "conceptIds": [...]}.
-- The Drill still sits in one Domain (ADR 0001), recorded in domain_id.
alter table drills drop constraint drills_scope_check;
alter table drills add constraint drills_scope_check check (scope in ('due', 'random'));
