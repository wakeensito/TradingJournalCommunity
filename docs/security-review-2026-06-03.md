# Security & Bug Review — 2026-06-03

Whole-codebase review of Trading Journal (Community) — React 18 + TypeScript + Vite + Firebase (client SDK). Conducted with four parallel review agents across the Firebase boundary, AI integration, input parsing, and frontend rendering. Severities are the reviewer's assessment; verify in your context before acting.

## Verified: secrets are NOT leaked via git

A reviewer flagged the on-disk `.env` as CRITICAL. **Verified false alarm for git:** `.env` was never committed, is `.gitignore`d (line 1), and no `AIzaSy…` strings exist anywhere in history (`git log --all -- .env` empty; history grep clean). No git-history cleanup needed. The *bundle* exposure (C1) is the real issue.

---

## CRITICAL

### C1 — Gemini API key is shipped to every browser
`src/services/geminiService.ts:8`, `src/services/miaService.ts:6`
Any `VITE_*` var is inlined into the production JS bundle **and** appended to the Gemini request URL (`?key=…`). Anyone who opens DevTools on the deployed site can extract the key and run up Google billing. The local `.env` is safe; the build output is not.
**Fix:** Move Gemini calls behind a server-side proxy (Firebase Cloud Function) holding a non-`VITE_` key; add API-key restrictions (HTTP referrer / API allowlist) in Google Cloud Console. The Firebase web key is designed to be public — it's fine, but it relies entirely on Firestore rules (C3).

### C2 — Photo uploads: no MIME validation + no count cap
`src/components/TradesList.tsx` (edit path, `handlePhotoUpload`), `src/components/TradeEntry.tsx:97-126`
The edit-path handler checks size but **not type** — `image/svg+xml` or other non-raster files become stored `data:` URIs rendered in `<img>`. No per-trade count cap means multi-MB base64 arrays blow past Firestore's 1 MB document limit → silent save failures.
**Fix (this PR):** raster-only MIME allowlist on both handlers + per-trade photo count cap. **Follow-up:** migrate photos to Firebase Storage instead of base64-in-Firestore.

### C3 — Firestore rules have no field/shape/array validation
`firestore.rules`
`isOwner` grants blanket write — a client can inject arbitrary fields, set `pnl`/`accountSize` to any type, or push unbounded `photos` arrays. The client SDK *is* the backend, so rules are the only server-side guard. (Note: Firestore rules cannot check total document bytes; they can cap field counts, array lengths, and field types.)
**Fix (this PR):** conditional type checks (field-present ⇒ correct type, so valid writes never break), `photos`/`tags` array-length caps, and a field-count ceiling. Keep `read`/`delete` owner-only.

---

## HIGH

| # | Issue | Location |
|---|---|---|
| H1 | Date-crash class — `new Date(badString).toISOString()` throws `RangeError`; importer fallback + numeric branch persist unparseable dates | `TradeEntry.tsx:541,547`, `behavioralAnalysis.ts:367-368,468`, `journalParser.ts:112-117` — *covered by `plans/2026-06-03-safe-date-handling.md`* |
| H2 | Prompt injection — user journal text concatenated into the same plain-text block as MIA system rules; no `system_instruction` used | `miaService.ts:49-53`, `geminiService.ts:87` |
| H3 | `deleteAccount` / `resetAccountPnL` never call Firestore `deleteDoc`; `saveAccounts` only upserts → deleted accounts reappear on reload | `App.tsx:581-594` |
| H4 | CSV parser ignores RFC-4180 quoting — `split(delimiter)` shifts every column after a quoted field containing a comma | `TradeEntry.tsx:652` |
| H5 | `JSON.parse(localStorage…)` with no try/catch in `useState` initializers → white-screen crash before any error boundary mounts | `App.tsx:22-25`, `Gameplan.tsx:132-133,174-175` |
| H6 | Gameplan data is localStorage-only — trading plans never sync to Firebase; lost across devices; contradicts "Firebase only" architecture | `Gameplan.tsx:132-203` |
| H7 | `auth.currentUser` read before async session restore completes → cold refresh can throw "not authenticated" for logged-in users | `tradeStorage.ts:36`, `journalStorage.ts:36` |
| H8 | `saveJournalEntries` deletes any doc not in the passed array → empty array wipes all journal entries (unlike safer `saveTrades`) | `journalStorage.ts:103-115` |

---

## MEDIUM (highlights)

- Sensitive financial payloads (`pnl`, `accountSize`) `console.log`'d in production — `tradeStorage.ts:181-190`.
- Error stack traces rendered in the UI (fingerprinting/PII) — `ErrorBoundary.tsx:45-50`.
- `user` state typed as `any` instead of `User | null` — `App.tsx:28`.
- `geminiService.ts` sets no `maxOutputTokens`; no input-length cap before sending user text to Gemini (billing/DoS).
- CSV `getValue` treats `"0"` as missing — breakeven `pnl:0`/`qty:0` silently dropped — `TradeEntry.tsx:497`.
- `detectSession` off-by-one: 09:00–09:29 mislabeled `regular` — `TradeEntry.tsx:620`.
- Colliding journal IDs `journal-${Date.now()}-${i}` on same-ms imports — `journalParser.ts:303`.
- Account enumeration via distinct auth error messages — `auth.ts:28`.
- `extractDate` MM/DD/YYYY accepts out-of-range day/month (`13/45/2024` → `2024-13-45`) — `journalParser.ts:112-117`.

## LOW (selected)

- `FloatingMIA.tsx:15` reads `window.innerWidth` at module eval (SSR/test crash).
- Dead `getDefaultAccount` leaks a prop-firm string into the bundle — `tradeStorage.ts:408-419`.
- jspdf DoS on very long unbounded text fields — `Gameplan.tsx:637`.
- Regex stalls (`O(n·m)`) on large pasted journals — `journalParser.ts:253,275-299`.
- Inconsistent `removeUndefined` across the two storage services.

---

## Recommended order

1. **C1** — proxy the Gemini key + GCP key restrictions (largest blast radius if deployed).
2. **C3** — harden `firestore.rules` (only server-side validation). ✅ *done this PR*
3. **C2** — photo MIME allowlist + count cap on both handlers. ✅ *done this PR*
4. **H1** — execute the date-handling plan.
5. Work down H2–H8, then MEDIUM/LOW.

See `docs/superpowers/plans/2026-06-03-critical-security-fixes.md` for the step-by-step remediation of C1–C3 and the highest HIGHs.
