# Buildee QA · Documentation Site

A single-page documentation website that presents the **Buildee Playwright Automation Framework** and the **QA Process & Onboarding Guide** in a clean, searchable, dark/light-themed UI.

The site is fully static — no build step, no dependencies — so it runs straight from `index.html`.

## Contents

| File | Purpose |
|------|---------|
| `index.html` | Markup for the whole site (both doc tabs) |
| `styles.css` | Design system · light & dark themes · responsive layout |
| `script.js`  | Tab switcher · search · copy buttons · scroll-spy · theme toggle |
| `Playwright Documentation 2026.docx` | Source · Playwright framework documentation |
| `Playwright Framework FAQ Guide.docx` | Source · FAQ guide |
| `QA Process Documentation.docx` | Source · QA process & onboarding |

## Features

- **Two tabs**: *Playwright Automation* (Documentation + FAQ merged, deduped) · *QA Process*
- **Sticky sidebar TOC** with active-section highlighting
- **Full-text search** (`⌘K` / `Ctrl K`) with live highlighting
- **Dark / light mode** (persisted · respects system preference)
- **Copy buttons** on every code block
- **Mobile-friendly** layout
- **Zero dependencies** · works from `file://` or any static server

## Running locally

Just open `index.html` in a browser, or serve the folder:

```bash
# Python (any version)
python3 -m http.server 8080

# Or Node
npx serve .
```

Then open http://127.0.0.1:8080.

## Content sources

All content is extracted from the accompanying `.docx` files in this repo. Edits should be made in `index.html` and, where appropriate, reflected back into the source docs.

## QA Test Case Portal

This repo also hosts a separate **QA Test Case Portal** for browsing, adding, and editing test cases. Test cases are stored as JSON in `data/testcases.json` and every change becomes a GitHub commit.

- `frontend/` — static UI (deploy to GitHub Pages)
- `backend/` — Node.js/Express proxy that talks to the GitHub API
- `data/testcases.json` — source of truth

See [`PORTAL.md`](./PORTAL.md) for the full architecture, setup, and deployment guide.
