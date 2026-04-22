# QA Docs Backend

Thin Express proxy that reads/writes `data/testcases.json` in this GitHub repo.

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
