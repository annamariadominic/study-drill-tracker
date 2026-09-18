## Agent skills

### Issue tracker

Issues are tracked as GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git commit conventions

- For implementation tickets, prefer a few small, logical commits at stable milestones rather than one large commit at the end.
- Each commit should represent a coherent change and leave the repository in a working state with relevant tests and typechecking passing.
- Do not commit after every individual file change.
- Small tickets may reasonably use a single commit.
- Use GitHub issue-closing keywords (`Closes #N`, `Fixes #N`, etc.) only in the final commit for that ticket.
