# QA Docs Backend

Thin Express proxy that reads and writes the QA portal's data files in this
GitHub repo.

## Storage layout

Data is split across many small files so no single document ever gets big
enough to hit GitHub's 1 MB contents-API ceiling:

```
data/
  docs/
    index.json                         # { version, updatedAt, sections[] (no HTML content) }
    sections/<id>.json                 # { id, content, updatedAt }
  testcases/
    index.json                         # { version, updatedAt, sections[] }
    sections/<sectionId>.json          # { sectionId, testCases: [...] }
  jira/
    index.json                         # { version, updatedAt, sections[] }
    sections/<sectionId>.json          # { sectionId, tickets: [...] }
    unassigned.json                    # { tickets: [...] }  (sectionId === null)
```

Each HTTP write computes the diff between the pre-read snapshot and the
post-mutation state and commits only the files that actually changed, as a
single atomic commit via the Git Data API. Renaming a section, for example,
touches only `index.json`; editing a documentation section rewrites only that
one section file.

The first time the server starts against a repo that still has the legacy
flat files (`data/documentation.json`, `data/testcases.json`,
`data/jiratickets.json`), it transparently splits them into the new layout
and removes the flat files in a single migration commit. No manual step is
required. The old contents are always recoverable via `git log`.

## Setup

```bash
cd backend
cp .env.example .env
# fill in GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, API_KEY, ALLOWED_ORIGIN
npm install
npm run dev
```

Server listens on `http://localhost:8080`.

## Endpoints

| Method | Path                    | Auth         | Description                    |
| ------ | ----------------------- | ------------ | ------------------------------ |
| GET    | `/health`               | none         | Health check                   |
| GET    | `/api/testcases`        | none         | List all test cases            |
| POST   | `/api/testcases`        | `x-api-key`  | Create a test case             |
| PUT    | `/api/testcases/:id`    | `x-api-key`  | Update a test case             |
| DELETE | `/api/testcases/:id`    | `x-api-key`  | Soft-delete (status=deprecated)|

Every write creates a real commit on the configured branch.

## GitHub token

Use a **fine-grained Personal Access Token** scoped to just this repo with
`Contents: Read and write`. Never put it in the frontend.
