# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm i            # install dependencies
npm run dev      # start Vite dev server on http://localhost:3000 (auto-opens browser)
npm run build    # production build → ./build (Vite, target esnext)
```

There is **no test runner and no linter configured** — `package.json` only defines `dev` and `build`. Don't invent `npm test`/`npm run lint`; verify changes by running the dev server and exercising the UI.

Deploy (Firebase Hosting; serves the `build/` output as configured in `firebase.json`):

```bash
npm run build
firebase deploy --only hosting        # or: firebase deploy  (also pushes firestore/storage rules)
```

## Architecture

Single-page React 18 + TypeScript app built with **Vite (SWC plugin)**, styled with **Tailwind + Radix UI**. Originally scaffolded from Figma Make. Persistence is **Firebase only** (Auth + Firestore client SDK); there is intentionally **no localStorage fallback** for trades/accounts.

### App shell
`src/App.tsx` is the root and the single source of app state (`trades`, `accounts`, `selectedAccountId`, auth/user). It is a **tab-based SPA** — Dashboard, TradeEntry, TradesList, AccountManager, Gameplan, JournalAnalysis — gated behind auth, with a `LandingPage`/`SignIn` flow for logged-out users. State changes are persisted back to Firestore via the storage services. Services are pulled in with **lazy `import()` calls** (e.g. `import('./services/auth')`), so the services layer is code-split away from initial render.

### Services layer (`src/services/`)
All cross-cutting logic lives here, not in components:
- **`firebase.ts`** — initializes the Firebase app as a singleton via `initializeFirebase()` (guards on `getApps()`); returns `{ db, auth }`. Config comes from `VITE_FIREBASE_*` env vars, with a hardcoded fallback `projectId: 'trading-journal-9209f'`. If config is absent, `db`/`auth` stay `null` and callers throw.
- **`auth.ts`** — Google + email/password sign-in, `subscribeToAuthChanges()` drives the auth state in `App.tsx`.
- **`tradeStorage.ts` / `journalStorage.ts`** — load/save trades, accounts, selected account, journal entries. **All data is per-user under `users/{uid}/{trades|accounts|journal|preferences}`** in Firestore. Reads require `auth.currentUser`; queries try `orderBy('date')` and fall back to a manual sort if the composite index is missing.
- **`journalParser.ts`** — parses pasted Discord-style trading journals into structured entries (`parseDiscordJournal`, `extractQuantMetrics`).
- **`behavioralAnalysis.ts`** — tag detection, process score, daily-plan generation from journal entries.
- **`geminiService.ts` / `miaService.ts`** — optional Google Gemini AI integration (journal analysis + the "MIA" market-intelligence assistant). Gated on `VITE_GEMINI_API_KEY`; `isMIAAvailable()` / the Gemini fallback path mean the app works without a key (keyword matching instead of semantic analysis). See `GEMINI_SETUP.md`.

### Types (`src/types/`)
`trade.ts` (`Trade`, `Account`, `TradeFormData`) and `journal.ts` are the canonical data shapes. `Trade.date` / `Account.startDate` etc. are **plain strings**, not `Date` objects.

### UI components
`src/components/ui/` is a large shadcn/Radix component library (buttons, dialogs, charts, etc.) — feature components in `src/components/` compose these. Charts use Recharts. `ErrorBoundary` wraps the app.

## Security & access model
Firestore access is enforced by `firestore.rules`: every `users/{userId}/...` path requires `request.auth.uid == userId` (owner-only), with a default-deny catch-all. Keep new collections under `users/{uid}/` and add a matching rule. `storage.rules` governs Firebase Storage. `.env*` is gitignored — never commit Firebase config or the Gemini key (see `SECURITY.md`).

## Gotchas
- **Dates are untrusted free-form strings.** `Trade.date` is populated from manual entry *and* from CSV / Discord-journal imports, whose fallback parsing can emit unparseable values (e.g. `"Mar"`, `""`, malformed `MM/DD/YYYY`). Calling `new Date(badValue).toISOString()` throws `RangeError: Invalid time value` and, inside a `useMemo`, crashes the whole render. **Always guard `new Date(...)` with `isNaN(parsed.getTime())` before `.toISOString()`.** (See `Dashboard.tsx` `monthlyPerformance`.)
- **`vite.config.ts` aliases** `@` → `./src` *and* contains a long list of versioned package aliases (e.g. `vaul@1.1.2` → `vaul`) left over from Figma Make — import bare package names, not the versioned aliases.
- Build output is **`build/`**, not `dist/` — `firebase.json` hosting `public` is set to match.
