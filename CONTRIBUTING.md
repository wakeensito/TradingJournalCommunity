# Contributing

Thanks for working on Trading Journal (Community). This guide covers how the codebase is laid out and the conventions to follow. For user-facing setup, see [`README.md`](./README.md).

## Local development

```bash
npm i          # install
npm run dev    # Vite dev server → http://localhost:3000 (auto-opens, HMR)
npm run build  # production build → ./build
```

You'll need a `.env` with your Firebase config to sign in and persist data — copy `env.example` → `.env` and fill it in. AI features are optional and gated on `VITE_GEMINI_API_KEY` (see [`GEMINI_SETUP.md`](./GEMINI_SETUP.md)); the app works without it.

> **No linter or test runner is configured by default.** `package.json` only ships `dev` and `build`. If you add tests, `vitest` is the natural fit for this Vite project (see the safe-date-handling plan under `docs/superpowers/plans/`).

## How the code is organized

| Area | What lives there |
| --- | --- |
| `src/App.tsx` | Root component and **single source of app state** (`trades`, `accounts`, `selectedAccountId`, auth). Tab-based SPA, auth-gated. |
| `src/components/` | Feature components — one per tab (Dashboard, TradeEntry, TradesList, AccountManager, Gameplan, JournalAnalysis) plus the landing/auth flow. |
| `src/components/ui/` | shadcn/Radix component library (buttons, dialogs, charts…). Compose these; don't hand-roll primitives. |
| `src/services/` | All cross-cutting logic: Firebase init, auth, trade/journal storage, journal parsing, behavioral analysis, Gemini/MIA. **Components call services — services never import components.** |
| `src/types/` | Canonical data shapes (`Trade`, `Account`, `JournalEntry`). |

### Data & persistence

Persistence is **Firebase only** — there is intentionally no localStorage fallback for trades/accounts. All user data is stored per-user under `users/{uid}/{trades|accounts|journal|preferences}` in Firestore, enforced owner-only by `firestore.rules`. When adding a new collection:

1. Keep it under `users/{uid}/...`.
2. Add a matching `allow read, write: if isOwner(userId);` rule in `firestore.rules`.
3. Reads require `auth.currentUser` — handle the unauthenticated case.

Services are loaded with lazy `import()` from `App.tsx`, so they're code-split from the initial render — keep new service modules side-effect-free at import time.

## Conventions

- **Path alias:** import from `@/...` (mapped to `src/`). Ignore the versioned aliases in `vite.config.ts` (e.g. `vaul@1.1.2`) — those are Figma Make leftovers; import bare package names.
- **Dates are untrusted strings.** `Trade.date` / `JournalEntry.date` are free-form strings populated from manual entry **and** from CSV / Discord-journal imports, which can produce unparseable values. **Never call `new Date(stored).toISOString()` directly** — `new Date("Mar").toISOString()` throws `RangeError: Invalid time value` and, inside a `useMemo`, crashes the whole render. Guard with `isNaN(parsed.getTime())` first, or use the shared safe-date helpers once they land (see `docs/superpowers/plans/2026-06-03-safe-date-handling.md`).
- **Secrets:** `.env*` is gitignored. Never commit Firebase config or the Gemini key. See [`SECURITY.md`](./SECURITY.md).
- **Build output** is `build/` (not `dist/`) — `firebase.json` hosting `public` is set to match.

## Before opening a PR

- `npm run build` succeeds with no type errors.
- Manually exercise the affected tab(s) in `npm run dev` — there's no automated suite to catch regressions.
- No secrets or `.env` files staged (`git status` before committing).
- Firestore rule added if you introduced a new user collection.

## Architecture reference

`CLAUDE.md` at the repo root has a condensed architecture overview written for AI coding assistants — it's a useful quick reference for humans too.
