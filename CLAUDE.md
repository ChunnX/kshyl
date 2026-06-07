# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A family voice-memory product: a **WeChat native mini program** (`miniprogram/`) plus a **Node.js + Express backend** (`server/`). Family members record life stories / kids' growth via voice; the backend transcribes (ASR), an LLM polishes into story drafts, family members proofread, and stories can be exported into a book. There is also a real-time voice "companion chat" and a consent-gated "memorial chat". UI is whole-age-friendly (large fonts/buttons). Most docs and user-facing strings are in Chinese; see `docs/` for product/architecture/API specs.

## Commands

The repo root has no package.json. All build/run/test commands live in `server/`:

```bash
cd server
npm install
npm run dev      # nodemon src/server.js (http://localhost:3000)
npm run start    # node src/server.js
npm run smoke    # end-to-end smoke test against an in-process server (the test suite)
npm run tunnel   # public HTTPS/WSS tunnel for testing on a real phone

# Prisma (only when using a real DB; see Storage abstraction below)
npm run prisma:migrate:dev   # create/apply a migration (dev)
npm run prisma:migrate       # apply migrations (deploy)
npm run db:seed              # seed the demo person
```

CI (`.github/workflows/ci.yml`) runs `npm run smoke` against both the JSON store and a Prisma/SQLite store on every push/PR.

There is **no lint step and no unit-test framework**. `npm run smoke` (`server/scripts/smoke-test.js`) is the test: it boots the app + WebSocket in-process on a random port against an isolated JSON store and asserts the full pipeline (create recording → generate story → family review → consent gate blocks memorial chat → grant consent allows it → export book). Run it after backend changes. To run a single check, edit/comment the steps in `smoke-test.js` (no per-test runner).

**Mini program**: no CLI build. Open the WeChat DevTools and import the `miniprogram/` directory. Disable domain checking in DevTools during development, or deploy the backend to HTTPS and configure legal request/socket domains in the WeChat console.

## Architecture

### Backend layering (`server/src/`)
`app.js` mounts routers → `routes/*.routes.js` (thin HTTP handlers) → `services/*.service.js` (business logic, e.g. `story-editor`, `conversation`) → `db/` store. `server.js` wraps the Express app in an `http` server and attaches the WebSocket handler.

### Storage abstraction — the key indirection
Every route/service `require('../db/memory-store')`. **`memory-store.js` self-delegates to `prisma-store.js` at its top when `process.env.DATABASE_URL` is set.** So:
- No `DATABASE_URL` → in-memory store that persists to a JSON file (`DATA_FILE`, default `server/data/dev-store.json`, gitignored). Seeds a demo person `person_demo_001`. Container restarts lose data.
- `DATABASE_URL` set → Prisma. Both stores expose the **same function names** (`createRecording`, `listStories`, …). When adding a store method, add it to **both** files or routes will break under the other backend. (`npm run smoke` passes under both backends — run it with `DATABASE_URL` set to catch parity drift.)

Prisma setup: single schema at `server/prisma/schema.prisma` (`provider = "sqlite"`), with committed `prisma/migrations/` and a seed (`scripts/seed.js`). First run: `DATABASE_URL="file:./dev.db" npm run prisma:migrate:dev && npm run db:seed`. SQLite is the default (zero-infra, survives restart, fine for demo); switching to PostgreSQL (see `docker-compose.yml`) means changing the schema `provider` to `postgresql` and re-running migrations — don't hardcode assumptions about the provider.

### Provider abstraction — mock-first, real behind env flags
ASR, LLM, voice-clone, streaming-ASR, streaming-TTS, and speech each live in their own `services/*.service.js` and switch implementation by env var (`ASR_PROVIDER`, `LLM_PROVIDER`, `VOICE_PROVIDER`, `STREAMING_ASR_PROVIDER`, `STREAMING_TTS_PROVIDER`; all default `mock`). The whole system runs offline with mocks. Real providers (Tencent ASR, Hunyuan/Gemini/OpenAI/DeepSeek LLM, etc.) are configured in `server/src/config/env.js` from environment variables. TTS is implemented for Tencent (`speech.service.js` + `streaming-tts.service.js` share `tencent-tts.js`, which synthesizes mp3 → storage → URL); mock stays silent (`audioUrl: null`). **Secrets/API keys go only in backend env (`server/.env`), never in mini-program code** — `miniprogram/` ships to clients.

### Core pipeline
recording → `asr.transcribeRecording` → transcript → `llm.polishStory` → story draft (`story-editor.service.js`) → family edits `polishedText` + sets `status: 'approved'` → `book-export.service.js` renders a real **DOCX** (via the `docx` lib) and persists it through `storage.service.js`.

### Auth & ownership (added)
`POST /api/auth/wechat-login` exchanges a `wx.login` `code` via `code2Session` (needs `WECHAT_APPID`/`WECHAT_SECRET`) and returns a JWT. `middleware/auth.js` `requireAuth` guards every `/api/*` route **except** `/api/auth` and `/api/invitations` (public share links), populating `req.userId`. `DEV_AUTH_BYPASS` (default on outside `NODE_ENV=production`) short-circuits to the demo user so offline dev + smoke work tokenless. Person-scoped routes call `loadOwnedPerson(store, personId, userId)` (and analogous helpers for story/conversation/theme) which returns 404 on not-owned to prevent IDOR. The mini-program attaches `Authorization: Bearer <token>` from storage in `services/api.js` + `services/upload.js`. **Known gap:** the realtime WebSocket isn't token-checked yet (relies on bypass in dev).

### File storage
`storage.service.js` abstracts artifact persistence: `local` writes under `STORAGE_DIR` and serves it at `STORAGE_PUBLIC_PATH` (`/files`, static-mounted in `app.js`); `cos` is a stub for Tencent COS. Book exports + synthesized speech go through it; the client builds absolute URLs by stripping `/api` off `BASE_URL`. Uploads are validated (type + size) by `middleware/upload.js`.

### Conversation + realtime
Conversations have two modes: `dialogue` (build a life story) and `vent` (listen first). Turns can be text or a `recordingId`. The real-time voice path is a WebSocket at `REALTIME_WS_PATH` (default `/realtime/conversations`), wired in `realtime/conversation-realtime.js`: streaming ASR → conversation service → streaming TTS. Note: real Tencent ASR may be flagged as cross-border from a local machine — deploy to Shanghai CloudBase for a stable realtime path (see `docs/cloudbase-deploy.md`).

### Consent gate (product-critical)
`POST /api/persons/:personId/chat` (memorial chat) returns **403 unless `person.consentStatus === 'granted'`**, and answers **only from stories with `status === 'approved'`** (`server/src/routes/persons.routes.js`). Preserve both constraints when touching that path; the smoke test asserts the 403. The response also carries a `disclaimer` ("AI-generated, not the real person") the UI must show, and the route is rate-limited. Privacy deletion endpoints exist (`DELETE` for recording/story/photo/book, and `DELETE /api/persons/:id` cascades everything); invitations are revocable (`POST /api/invitations/:code/revoke` → reads/contributions then 410).

### Route mounting note
`conversationRoutes` is mounted at `/api` (not `/api/conversations`) because its paths are person-scoped (`/api/persons/:id/conversations`, `/api/conversations/:id/...`). Other routers mount under their resource prefix.

## Mini program ↔ backend wiring

- `miniprogram/services/api.js` is the single HTTP client; all calls go through `request()` and prepend `CONFIG.BASE_URL`. WebSocket realtime uses `CONFIG.WS_URL`.
- `miniprogram/config.js` selects the environment via the `MODE` constant: `local` | `lan` | `tunnel` | `cloud`. **Changing where the backend runs means editing `MODE` (and the matching IP/host constants) in this file.** Production must use `https://` + `wss://` and have those domains whitelisted in the WeChat console.
- Pages are under `miniprogram/pages/<name>/` as the standard WXML/WXSS/JS(+optional JSON) quad, registered in `miniprogram/app.json`.

## Deploy

Backend targets CloudBase 云托管 (container): `server/Dockerfile` + `server/container.config.json` (`containerPort: 3000`, `hasWebSocket: true`). Set env vars in the CloudBase console, not in the image. Full steps in `docs/cloudbase-deploy.md`.
