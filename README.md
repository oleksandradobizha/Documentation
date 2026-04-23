# buildee QA Portal

Internal portal for browsing, adding, and editing QA test cases. Test cases live in `data/testcases.json` and every change becomes a GitHub commit through the backend proxy.

- `frontend/` — static UI (HTML / CSS / vanilla JS)
- `backend/` — Node.js / Express API that talks to GitHub
- `data/testcases.json` — source of truth (sections + test cases)

## Prerequisites

- **Node.js 18+** (`node -v`)
- A GitHub **fine-grained personal access token** with `Contents: Read and write` on the repo that stores `data/testcases.json`

## 1. Configure the backend (`.env`)

Copy the example file and fill in the values:

```bash
cd backend
cp .env.example .env
```

Then open `backend/.env` and set:

| Variable | What to put there |
|---|---|
| `PORT` | Port the API listens on. Default `8080`. |
| `GITHUB_TOKEN` | Your fine-grained PAT (starts with `github_pat_…`). Keep secret. |
| `GITHUB_OWNER` | GitHub user / org that owns the repo (e.g. `oleksandradobizha`). |
| `GITHUB_REPO` | Repo name that holds the data file (e.g. `Documentation`). |
| `GITHUB_BRANCH` | Branch to read from / commit to (usually `main`). |
| `DATA_PATH` | Path to the test cases JSON inside that repo. Default `data/testcases.json`. |
| `DOCS_PATH` | Path to the documentation JSON inside that repo. Default `data/documentation.json`. |
| `JIRA_PATH` | Path to the stored JIRA tickets JSON inside that repo. Default `data/jiratickets.json`. |
| `API_KEY` | Any long random string. Required for all write endpoints (add / edit / delete). |
| `ALLOWED_ORIGIN` | Comma-separated list of origins allowed by CORS (e.g. `https://oleksandradobizha.github.io`). `localhost` and `file://` are always allowed for dev. |
| `GEMINI_API_KEY` | Google Gemini API key for the AI Agent that drafts test cases from JIRA tickets. Free tier works fine. Get one at <https://aistudio.google.com/apikey>. Leave blank to hide the "Generate from JIRA" button. |
| `GEMINI_MODEL` | Optional override (default `gemini-2.5-flash`). |
| `JIRA_BASE_URL` | Your JIRA Cloud base URL, e.g. `https://yourcompany.atlassian.net`. |
| `JIRA_EMAIL` | Email of the JIRA user whose API token will be used. |
| `JIRA_API_TOKEN` | JIRA API token — create at <https://id.atlassian.com/manage-profile/security/api-tokens>. |
| `AUTOMATION_ACTIONS_URL` | URL opened by the ⚡ button in each test case row. Supports the `{id}` placeholder, replaced with the test case id. Leave blank to hide the button. |

Example `backend/.env`:

```env
PORT=8080
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=oleksandradobizha
GITHUB_REPO=Documentation
GITHUB_BRANCH=main
DATA_PATH=data/testcases.json
API_KEY=super-long-random-string-change-me
ALLOWED_ORIGIN=https://oleksandradobizha.github.io

# AI Agent (optional — enables the "Generate from JIRA" button)
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=you@yourcompany.com
JIRA_API_TOKEN=xxxxxxxxxxxxxxxxxxxx

# Optional — enables the ⚡ button on each test case row
AUTOMATION_ACTIONS_URL=https://github.com/your-org/your-automation-repo/actions?query={id}
```

> `backend/.env` is git-ignored (see `backend/.gitignore`). **Never commit real keys or tokens.** Rotate any credential that lands in Git history.

## 2. Point the frontend at the backend

Open `frontend/config.js` and set the same `API_KEY` you put in `.env` so the UI can perform write operations:

```js
window.CONFIG = {
  API_BASE: "http://localhost:8080/api",
  API_KEY: "super-long-random-string-change-me",
};
```

> Leave `API_KEY` empty if you only need read-only access.

## 3. Run the backend

```bash
cd backend
npm install
node --watch src/server.js
```

You should see:

```
QA docs backend listening on :8080
```

Smoke test it: <http://localhost:8080/health> → `{ "ok": true }`.

## 4. Run the frontend

In a **second terminal**, from the project root:

```bash
npx serve -l 5173 frontend
```

Then open <http://localhost:5173> and you'll land on the Test Cases tab.

## Jira Tickets tab

Open the **Jira Tickets** tab to pull tickets from JIRA into the portal and
drive AI test-case generation from one or many of them.

1. Click **Extract from JIRA** and enter a JQL filter (e.g.
   `project = PROJ AND labels = qa-ready`). The backend runs the query against
   JIRA Cloud (`JIRA_BASE_URL` + `JIRA_EMAIL` + `JIRA_API_TOKEN`) and stores
   the matching tickets in `data/jiratickets.json`.
2. Organize tickets into **sections** via the sidebar. Use the per-row
   checkbox (or the section-level checkbox) to build a selection.
3. Click **Generate Test Case**. The selected tickets are sent as a group to
   Google Gemini (`GEMINI_API_KEY`); a single combined test case draft is
   returned and pre-filled into the normal **Add Test Case** modal, with the
   source JIRA keys linked in the new **Source** field.

The **Test Case** column in the tickets table shows **Yes/No** based on
whether any existing test case lists the ticket in its `sources` field. The
**TC ID** column lists the linked test case IDs as clickable chips that jump
to the **Test Cases** tab and open the draft for editing.

All credentials stay on the server; the browser only ever sees the JSON
returned by the backend.

### Tuning the AI prompt

The "persona + skills + rules" Gemini sees on every generate request lives in
a plain-text Markdown file — you do not need to edit any code to iterate on it:

- **File**: [`backend/src/prompts/testcase.md`](backend/src/prompts/testcase.md)
  — edit the role, skills, voice & style, and rules sections, then restart the
  backend. It is sent to Gemini via the `systemInstruction` API so the model
  follows it more reliably than if it were mixed into the user turn.
- **Env overrides** (no restart needed beyond picking them up):
  - `GEMINI_SYSTEM_PROMPT` — inline override of the whole prompt (wins over
    the file). Handy for one-off experiments.
  - `GEMINI_SYSTEM_PROMPT_PATH` — alternate file path (absolute, or relative
    to the backend cwd). Useful for keeping A/B prompt variants around.
- **What stays in code** (`backend/src/services/ai.js`):
  - The per-request user prompt (ticket blocks + JSON shape + enum values).
  - The `responseSchema` that forces Gemini's output into the fields the
    portal saves (`title`, `module`, `priority`, `steps`, `expectedResult`,
    ...). Add a new field here if you want the AI to populate it; also update
    `normalizeDraft`, `sanitizeTestCase`, and the Add Test Case modal.
  - Generation knobs (`temperature`, `maxOutputTokens`, `GEMINI_MODEL`).

## Run automation from the portal

Each test case row shows a ⚡ button when `AUTOMATION_ACTIONS_URL` is set. The
URL supports a `{id}` placeholder:

```env
AUTOMATION_ACTIONS_URL=https://github.com/your-org/your-automation-repo/actions?query={id}
```

Clicking the button opens that URL in a new tab (e.g. filtered to runs for
`TC-0017`). No credentials leave the browser.

## Handy URLs

| URL | What it is |
|---|---|
| <http://localhost:5173> | Frontend |
| <http://localhost:8080/health> | Backend health check |
| <http://localhost:8080/api/testcases> | Raw JSON (sections + test cases) |

## Common issues

- **CORS error in browser** — make sure the backend is running on `:8080` and `API_BASE` in `frontend/config.js` matches.
- **401 `Unauthorized`** on add / edit / delete — `API_KEY` in `frontend/config.js` doesn't match `API_KEY` in `backend/.env`.
- **GitHub 401 / 403 in backend logs** — check `GITHUB_TOKEN` hasn't expired and has `Contents: Read and write` on the target repo.
- **Changes don't persist** — verify `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` / `DATA_PATH` all point at a real file on a real branch.

## More

See [`PORTAL.md`](./PORTAL.md) for the full architecture and deployment guide (GitHub Pages + any Node host).
