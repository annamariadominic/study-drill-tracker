# Study Drill Tracker

A personal, single-user app for tracking what you've learned across subjects and generating spaced-repetition review sessions from it. See [CONTEXT.md](./CONTEXT.md) for the domain model and [docs/adr/](./docs/adr) for the architectural decisions behind it.

## Getting started

```bash
npm install
cp .env.example .env.local  # fill in APP_PASSWORD and SESSION_SECRET
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Every route except `/login` and the cron route requires the app password (see [ADR 0005](./docs/adr/0005-minimal-password-auth.md)).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run test` — run the test suite
- `npm run lint` — lint

## Deployment

Deployed to Vercel. `APP_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `ANTHROPIC_API_KEY` must be set as server-only environment variables in the Vercel project settings.

### Daily due reminder

A Vercel Cron Job (configured in [vercel.json](./vercel.json)) calls `GET /api/cron/due-reminder` once a day at 08:00 UTC. When at least one Concept is due, it sends one email through Resend with the due-count and a link to `/study/due`; when nothing is due it sends nothing (see [ADR 0004](./docs/adr/0004-supabase-resend-infra.md)). It needs:

- `CRON_SECRET`: Vercel sends it as `Authorization: Bearer <CRON_SECRET>`; the route rejects anything else.
- `RESEND_API_KEY`, `REMINDER_EMAIL_FROM` (on a domain verified in Resend) and `REMINDER_EMAIL_TO`.

To trigger it by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-deployment>/api/cron/due-reminder
```
