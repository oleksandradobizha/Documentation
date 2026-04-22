# QA Test Case Portal

A lightweight portal for browsing, adding, and editing QA test cases.
Test cases are stored as structured JSON in this repo (`data/testcases.json`)
so every change is a reviewable commit with full history.

## Architecture

```
┌──────────────────────┐      ┌─────────────────────┐      ┌──────────────────────┐
│  frontend/           │      │  backend/           │      │  GitHub repo         │
│  Static HTML/JS/CSS  │─────▶│  Express + Octokit  │─────▶│  data/testcases.json │
│  GitHub Pages        │ JSON │  Render / Fly.io    │ API  │  (source of truth)   │
└──────────────────────┘      └─────────────────────┘      └──────────────────────┘
```

- **frontend/** — static UI, deployable to GitHub Pages. No secrets.
- **backend/** — Express proxy that holds the GitHub PAT and commits JSON updates.
- **data/testcases.json** — canonical list of test cases. Edited through the API, visible in PRs.

## Project layout

```
Documentation/
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── config.js           # points to the backend URL and optional shared API key
│   └── styles.css
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/testcases.js
│   │   ├── services/github.js
│   │   ├── middleware/auth.js
│   │   └── utils/validate.js
│   ├── package.json
│   └── .env.example
└── data/
    └── testcases.json
```

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in GITHUB_TOKEN (fine-grained PAT, Contents: read/write on this repo),
#           GITHUB_OWNER=oleksandradobizha
#           GITHUB_REPO=Documentation
#           API_KEY (any long random string)
npm install
npm run dev
```

Server listens on `http://localhost:8080`. Smoke test:

```bash
curl http://localhost:8080/api/testcases
```

### 2. Frontend

`frontend/config.js` defaults to `http://localhost:8080/api`. Just open
`frontend/index.html` in a browser, or serve the folder:

```bash
cd frontend
python3 -m http.server 5173
# open http://127.0.0.1:5173
```

If you set an `API_KEY` in the backend, paste the same value into
`frontend/config.js` so Add/Edit requests pass the `x-api-key` header.

## Authentication model

- **Backend ↔ GitHub**: fine-grained PAT stored in `GITHUB_TOKEN`. Never shipped to the browser.
- **Frontend ↔ Backend**: shared secret (`API_KEY`) sent as `x-api-key` for POST/PUT/DELETE.
  `GET /api/testcases` is public so read-only viewers can browse without a key.
- **Future**: swap the shared secret for GitHub OAuth (session cookie) without changing routes.

## Deployment

### Frontend → GitHub Pages

1. Enable Pages on this repo: Settings → Pages → source = `main` branch, folder = `/frontend`.
   (Or publish `frontend/` to a `gh-pages` branch with an Action.)
2. Your site will be available at `https://oleksandradobizha.github.io/Documentation/`.
3. Edit `frontend/config.js` to point `API_BASE` at your deployed backend URL.

### Backend → Render (or Fly.io / Railway)

1. Create a new Web Service pointing at the `backend/` directory.
   - Build command: `npm install`
   - Start command: `npm start`
2. Add environment variables from `.env.example`:
   - `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `DATA_PATH`
   - `API_KEY` (long random string)
   - `ALLOWED_ORIGIN=https://oleksandradobizha.github.io`
3. Deploy. Confirm `https://<your-service>/health` returns `{ "ok": true }`.

### Wire them together

Update `frontend/config.js` on the `main` branch:

```js
window.CONFIG = {
  API_BASE: "https://<your-service>.onrender.com/api",
  API_KEY: "<the same API_KEY set on the backend>",
};
```

Commit + push → Pages redeploys automatically.

## API reference

| Method | Path                 | Auth        | Body                              |
| ------ | -------------------- | ----------- | --------------------------------- |
| GET    | `/api/testcases`     | none        | —                                 |
| POST   | `/api/testcases`     | `x-api-key` | test case (without id/timestamps) |
| PUT    | `/api/testcases/:id` | `x-api-key` | test case (id in URL)             |
| DELETE | `/api/testcases/:id` | `x-api-key` | — (soft-deletes: status=deprecated)|

## Extending

- **Add fields** → edit `backend/src/utils/validate.js` and the form in `frontend/index.html`.
- **Delete / restore** → already supported server-side; add a button in the UI.
- **Split by module** → shard `data/testcases.json` into `data/<module>.json` and update `github.js`.
- **User identity** → replace `requireApiKey` with GitHub OAuth; attribute commits to the logged-in user.
