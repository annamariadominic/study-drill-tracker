# Study Drill Tracker

A personal, single-user app for tracking what you've learned across subjects and generating spaced-repetition review sessions from it. See [CONTEXT.md](./CONTEXT.md) for the domain model and [docs/adr/](./docs/adr) for the architectural decisions behind it.

## Getting started

```bash
npm install
cp .env.example .env.local  # fill in APP_PASSWORD and SESSION_SECRET
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Every route except `/login` requires the app password (see [ADR 0005](./docs/adr/0005-minimal-password-auth.md)).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run test` — run the test suite
- `npm run lint` — lint

## Deployment

Deployed to Vercel. `APP_PASSWORD` and `SESSION_SECRET` must be set as server-only environment variables in the Vercel project settings.
