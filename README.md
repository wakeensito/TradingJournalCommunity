
## Trading Journal (Community)

A fast, Firebase-backed trading journal built with **React + TypeScript + Vite**. Track trades, manage prop firm accounts, analyze performance, and generate PDFs for your daily/weekly gameplan.

**Design source**: `https://www.figma.com/design/NLiTIllwDd3jVItzerGpUA/Trading-Journal--Community-`

### Features

- **Trades**: create/import trades, track P&L, view history
- **Accounts**: manage prop firm accounts and combined stats
- **Analytics**: dashboard metrics (win rate, streaks, P&L)
- **Gameplan + PDF**: write analyses and export PDF
- **Optional AI**: journal analysis + Market Intelligence Assistant via Gemini (requires your own API key)

### Tech stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind + Radix UI
- **Backend**: Firebase Auth + Firestore (client SDK)

### Getting started

1. Install deps

```bash
npm i
```

2. Configure environment variables (recommended)

- Copy `env.example` → `.env`
- Fill in your Firebase config (and optional Gemini key)

3. Run locally

```bash
npm run dev
```

### Environment variables

Required for Firebase:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Optional:

- `VITE_GEMINI_API_KEY` (enables AI features)

### Build & deploy (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting
```

### Security / secrets

- This repo is set up to **ignore `.env*` files** via `.gitignore`.
- Don’t commit API keys or service account JSON. Use environment variables instead.
- See `SECURITY.md` for reporting and remediation steps.
  
