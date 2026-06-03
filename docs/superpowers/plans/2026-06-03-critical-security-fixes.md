# Critical Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three CRITICAL findings (C1 Gemini key exposure, C2 photo upload validation, C3 Firestore rule hardening) plus the two highest-impact HIGHs (H3 broken account deletion, H5 localStorage parse crashes) from the 2026-06-03 security review.

**Architecture:** C2/C3/H3/H5 are self-contained client + rules changes done here. C1 requires standing up a server-side proxy (Firebase Cloud Function) so the Gemini key never reaches the browser — it's a larger change with its own task and a deploy step, kept last.

**Tech Stack:** React 18 + TypeScript, Vite, Firebase (Firestore client SDK + optional Cloud Functions), Google Gemini REST API.

**Status:** Tasks 1 (C3) and 2 (C2) were applied directly in the review session; their steps are marked done and serve as the record. Tasks 3–5 are open.

---

### Task 1: C3 — Harden Firestore security rules ✅ (applied in review session)

**Files:**
- Modify: `firestore.rules`

Validation uses **conditional type checks** (`!('field' in data) || data.field is T`) so a write is only rejected for a *wrong-typed present* field — missing optional fields and future new fields never break. Firestore rules cannot measure total document bytes, so array-length and field-count caps stand in for the photo-blob / junk-doc concern.

- [x] **Step 1: Replace the trades/accounts/journal rules with validated versions**

For trades, split owner-only read/delete from validated create/update:
```
match /users/{userId}/trades/{tradeId} {
  allow read, delete: if isOwner(userId);
  allow create, update: if isOwner(userId) && isValidTrade();
}
function isValidTrade() {
  let d = request.resource.data;
  return d.keys().size() < 60
    && (!('date' in d)   || d.date is string)
    && (!('symbol' in d) || d.symbol is string)
    && (!('status' in d) || d.status in ['open', 'closed'])
    && (!('pnl' in d)    || d.pnl is number)
    && (!('quantity' in d)   || d.quantity is number)
    && (!('entryPrice' in d) || d.entryPrice is number)
    && (!('photos' in d) || (d.photos is list && d.photos.size() <= 6))
    && (!('tags' in d)   || (d.tags is list && d.tags.size() <= 50));
}
```
Apply the analogous `isValidAccount()` (`accountSize is number`, `status in ['active','passed','failed','archived']`, key cap) to the accounts path, keep journal/preferences owner-gated with a key-count cap, and keep the default-deny wildcard.

- [x] **Step 2: Validate rule syntax**

Run (if Firebase CLI is available):
```bash
firebase deploy --only firestore:rules --dry-run
```
Expected: rules compile with no syntax errors. (If the CLI/login isn't set up, syntax was reviewed manually; deploy when credentials are available.)

- [x] **Step 3: Smoke test in the running app**

With `npm run dev` running and signed in, create a trade, edit it, and delete it. Expected: all succeed (valid writes pass the conditional checks). Watch the console for `permission-denied`.

- [x] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "security: validate trade/account writes in Firestore rules (C3)"
```

> **Deploy reminder:** rules only take effect after `firebase deploy --only firestore:rules`. Do this before relying on them in production.

---

### Task 2: C2 — Validate photo uploads (MIME allowlist + count cap) ✅ (applied in review session)

**Files:**
- Modify: `src/components/TradeEntry.tsx` (`handlePhotoUpload`, ~line 97)
- Modify: `src/components/TradesList.tsx` (`handlePhotoUpload`, ~line 214)

- [x] **Step 1: Define shared constants and tighten `TradeEntry.tsx`**

Replace `!file.type.startsWith('image/')` with a raster allowlist and add a count cap:
```ts
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_PHOTOS = 5;
// inside the forEach, before reading:
if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
  setUploadError('Only JPEG, PNG, WebP, or GIF images are allowed');
  return;
}
// gate the count in the setter:
reader.onload = (e) => {
  const base64 = e.target?.result as string;
  setPhotos(prev => (prev.length >= MAX_PHOTOS ? prev : [...prev, base64]));
};
```

- [x] **Step 2: Add the same validation to `TradesList.tsx`** (which previously had no MIME check), using `alert(...)` to match its existing UX, and the same `MAX_PHOTOS` cap in its setter.

- [x] **Step 3: Verify**

```bash
npm run build
```
Expected: build succeeds. Then in the dev server, try uploading a `.svg` (rejected) and a 6th image (ignored).

- [x] **Step 4: Commit**

```bash
git add src/components/TradeEntry.tsx src/components/TradesList.tsx
git commit -m "security: raster-only MIME allowlist and 5-photo cap on uploads (C2)"
```

---

### Task 3: H5 — Crash-proof localStorage reads (open)

**Files:**
- Modify: `src/App.tsx:22-25`
- Modify: `src/components/Gameplan.tsx:132-133,174-175`
- Create: `src/lib/storage.ts`

- [ ] **Step 1: Create a safe JSON-localStorage helper**

`src/lib/storage.ts`:
```ts
/** Read and JSON-parse a localStorage key; returns `fallback` on miss or malformed data. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
```

- [ ] **Step 2: Use it in `App.tsx` darkMode initializer**

```ts
import { readJSON } from '@/lib/storage';
const [darkMode, setDarkMode] = useState(() => readJSON('darkMode', true));
```

- [ ] **Step 3: Use it in `Gameplan.tsx`** for `tradingJournal_dailyAnalyses` and `tradingJournal_weeklyGameplans` initializers (replace the raw `JSON.parse(localStorage.getItem(...))` calls), defaulting to `[]`/`{}` as appropriate.

- [ ] **Step 4: Verify**

In DevTools console: `localStorage.setItem('darkMode','{bad json')` then reload. Expected: app loads with the default instead of a white screen.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/App.tsx src/components/Gameplan.tsx
git commit -m "fix: crash-proof localStorage JSON reads (H5)"
```

---

### Task 4: H3 — Persist account deletion to Firestore (open)

**Files:**
- Modify: `src/services/tradeStorage.ts` (add `deleteAccount`)
- Modify: `src/App.tsx:581-594` (`deleteAccount`, `resetAccountPnL`)

- [ ] **Step 1: Add a `deleteAccount` service that removes the doc and the account's trades**

In `tradeStorage.ts`, mirror the existing `deleteTrades` pattern:
```ts
export async function deleteAccount(accountId: string): Promise<void> {
  const { doc, deleteDoc } = await import('firebase/firestore');
  const { initializeFirebase } = await import('./firebase');
  const { db, auth } = await initializeFirebase();
  if (!db || !auth?.currentUser) throw new Error('Not authenticated');
  await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'accounts', accountId));
}
```

- [ ] **Step 2: Call it from `App.tsx` `deleteAccount`**, awaiting the Firestore delete and `deleteTrades(...)` for trades with that `accountId` **before** updating local state, using the functional updater form of `setAccounts`/`setTrades`.

- [ ] **Step 3: Fix `resetAccountPnL`** to call `deleteTrades` for the affected trades (it currently filters stale closure state and never persists) and set `isDeleting` around the operation so the upsert `useEffect` doesn't fight it.

- [ ] **Step 4: Verify**

In the dev server: create an account, add a trade to it, delete the account, then reload. Expected: the account and its trades stay gone (no reappearance from Firestore).

- [ ] **Step 5: Commit**

```bash
git add src/services/tradeStorage.ts src/App.tsx
git commit -m "fix: persist account deletion and P&L reset to Firestore (H3)"
```

---

### Task 5: C1 — Move the Gemini key behind a server proxy (open, requires deploy)

**Files:**
- Create: `functions/` (Firebase Cloud Functions project) with a `geminiProxy` callable/HTTPS function
- Modify: `src/services/geminiService.ts`, `src/services/miaService.ts` to call the proxy instead of `generativelanguage.googleapis.com`
- Modify: `firebase.json` to include the functions config
- Modify: `GEMINI_SETUP.md` and `env.example` to document the server-side `GEMINI_API_KEY` (no `VITE_` prefix)

- [ ] **Step 1: Scaffold Cloud Functions**

```bash
firebase init functions   # TypeScript, install deps
```

- [ ] **Step 2: Implement an authenticated `geminiProxy` HTTPS callable** that reads `process.env.GEMINI_API_KEY` (server-side secret via `firebase functions:secrets:set GEMINI_API_KEY`), enforces `context.auth` (signed-in users only), caps input length, and forwards the request to Gemini, returning only the model text. Use the `system_instruction` field to carry the MIA rules separately from user input (also fixes **H2** prompt injection).

- [ ] **Step 3: Repoint the client.** In `geminiService.ts` / `miaService.ts`, replace the direct `fetch(generativelanguage…?key=…)` with a call to the callable (`httpsCallable(functions, 'geminiProxy')`). Delete all reads of `import.meta.env.VITE_GEMINI_API_KEY`. Keep the keyword-analysis fallback for when the function is unavailable.

- [ ] **Step 4: Restrict the now-unused key and remove it from the client.** Rotate the existing Gemini key, store the new one only as a Functions secret, and remove `VITE_GEMINI_API_KEY` from `.env` / `env.example` / `GEMINI_SETUP.md`.

- [ ] **Step 5: Deploy and verify**

```bash
firebase deploy --only functions
npm run build
```
In the deployed app, confirm AI analysis works and that the built bundle no longer contains the key:
```bash
grep -r "AIzaSy" build/ ; echo "expect: no Gemini key in bundle"
```

- [ ] **Step 6: Commit**

```bash
git add functions firebase.json src/services/geminiService.ts src/services/miaService.ts GEMINI_SETUP.md env.example
git commit -m "security: proxy Gemini behind Cloud Function; remove client-side key (C1, H2)"
```

---

## Self-Review Notes

- **Coverage:** C1 (Task 5), C2 (Task 2 ✅), C3 (Task 1 ✅), H3 (Task 4), H5 (Task 3). H2 is folded into Task 5 via `system_instruction`. H1 lives in the separate date-handling plan. H4/H6/H7/H8 remain tracked in `docs/security-review-2026-06-03.md` for follow-up.
- **Non-breaking guarantee for C3:** all rule field checks are conditional on the field being present, so existing valid `setDoc(..., {merge:true})` writes continue to pass.
- **Deploy dependency:** Tasks 1 and 5 require `firebase deploy` to take effect in production; code/rules in the repo are necessary but not sufficient until deployed.
