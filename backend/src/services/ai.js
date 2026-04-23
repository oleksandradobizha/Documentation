/**
 * Google Gemini client - drafts a test case from a JIRA ticket.
 *
 * Uses the free tier of the Gemini API. Credentials live in backend/.env
 * (GEMINI_API_KEY). The frontend never sees the key - it only receives the
 * draft test case JSON returned from here.
 *
 * Get a key: https://aistudio.google.com/apikey
 *
 * Prompt editing: the "persona + skills + rules" block is loaded from
 *   backend/src/prompts/testcase.md
 * and sent to Gemini as a `systemInstruction`. Override at runtime with
 *   GEMINI_SYSTEM_PROMPT=...    (inline content — wins over the file)
 *   GEMINI_SYSTEM_PROMPT_PATH=./path/to/other.md   (alternate file)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, resolve } from "node:path";

import {
  ALLOWED_MODULES,
  ALLOWED_PRIORITIES,
  ALLOWED_AUTOMATION_STATUSES,
} from "../utils/validate.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROMPT_PATH = resolve(__dirname, "../prompts/testcase.md");

// Minimal fallback in case the prompt file is missing / unreadable. The real
// persona + rules live in backend/src/prompts/testcase.md — keep this short.
const FALLBACK_SYSTEM_PROMPT =
  "You are a senior QA engineer. Draft concise, reproducible functional test cases from JIRA tickets. Steps must be imperative, executable by a manual tester, and free of code or selectors.";

function loadSystemPrompt() {
  const inline = process.env.GEMINI_SYSTEM_PROMPT;
  if (inline && inline.trim()) return inline.trim();

  const configured = process.env.GEMINI_SYSTEM_PROMPT_PATH;
  const path = configured
    ? isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured)
    : DEFAULT_PROMPT_PATH;

  try {
    const text = readFileSync(path, "utf8");
    const trimmed = text.trim();
    if (trimmed) return trimmed;
  } catch (err) {
    console.warn(
      `[ai] Could not read system prompt at ${path}: ${err.message}. Using fallback prompt.`
    );
  }
  return FALLBACK_SYSTEM_PROMPT;
}

// Read once at startup — prompt edits take effect after backend restart.
const SYSTEM_PROMPT = loadSystemPrompt();

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function isAiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function formatIssueBlock(issue) {
  const labels = issue.labels?.length ? issue.labels.join(", ") : "(none)";
  const components = issue.components?.length
    ? issue.components.join(", ")
    : "(none)";
  return `JIRA ${issue.key} - ${issue.summary}
Type: ${issue.issueType || "(unknown)"}
Priority: ${issue.priority || "(unknown)"}
Status: ${issue.status || "(unknown)"}
Labels: ${labels}
Components: ${components}

Description / Acceptance Criteria:
"""
${issue.description || "(no description provided)"}
"""`;
}

/**
 * The per-request "user" prompt. Keeps only the data that varies per call:
 * the ticket(s) and the output JSON contract (which is derived from
 * validate.js enums, so it must live in code, not in the .md prompt).
 * The persona / skills / rules live in SYSTEM_PROMPT.
 */
function buildUserPrompt(issues) {
  const list = Array.isArray(issues) ? issues : [issues];
  const isMulti = list.length > 1;

  const task = isMulti
    ? `Draft ONE end-to-end functional test case that covers the combined scope of the JIRA tickets below. Synthesize a single cohesive scenario that exercises the key behavior of each ticket — do not produce N independent tests.`
    : `Draft ONE functional test case for the JIRA ticket below.`;

  const body = list.map(formatIssueBlock).join("\n\n---\n\n");

  return `${task}

${body}

Return ONLY a JSON object (no prose, no code fences) with exactly these keys:
{
  "title": "Short imperative sentence, <= 120 chars. Start with a verb.",
  "description": "One-sentence summary of what the test verifies.",
  "module": "One of: ${ALLOWED_MODULES.join(" | ")}",
  "priority": "One of: ${ALLOWED_PRIORITIES.join(" | ")}",
  "automationStatus": "Not Started",
  "steps": [
    "1. Navigate / Click / Fill / Select … (Playwright-style action)",
    "2. Next Playwright-style action",
    "..."
  ],
  "expectedResult": "What the user should observe when the steps succeed."
}

Constraints for this request:
- Pick the single most appropriate module from the allowed list.
- Map JIRA priority to the allowed list; default to "Medium" if unclear.
- Each \`steps\` entry MUST:
  - start with its 1-based number followed by \`. \` (e.g. \`1. \`, \`2. \`);
  - use a Playwright-oriented verb (Navigate, Open, Click, Fill, Select,
    Check, Uncheck, Press, Upload, Hover, Expect);
  - describe exactly ONE atomic action — never combine with "and" / "then";
  - quote UI labels exactly as they appear in the product.${
    isMulti
      ? "\n- Multiple tickets provided — pick the highest priority among them."
      : ""
  }`;
}

// JSON Schema given to Gemini so it is forced to emit the exact shape we need.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    module: { type: "string", enum: ALLOWED_MODULES },
    priority: { type: "string", enum: ALLOWED_PRIORITIES },
    automationStatus: {
      type: "string",
      enum: ALLOWED_AUTOMATION_STATUSES,
    },
    steps: { type: "array", items: { type: "string" } },
    expectedResult: { type: "string" },
  },
  required: [
    "title",
    "description",
    "module",
    "priority",
    "automationStatus",
    "steps",
    "expectedResult",
  ],
};

function coerceEnum(value, allowed, fallback) {
  if (typeof value !== "string") return fallback;
  const hit = allowed.find(
    (v) => v.toLowerCase() === value.trim().toLowerCase()
  );
  return hit || fallback;
}

function normalizeDraft(raw) {
  const steps = Array.isArray(raw?.steps)
    ? raw.steps
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
    : [];
  return {
    title: String(raw?.title || "").trim().slice(0, 200),
    description: String(raw?.description || "").trim(),
    module: coerceEnum(raw?.module, ALLOWED_MODULES, "Project"),
    priority: coerceEnum(raw?.priority, ALLOWED_PRIORITIES, "Medium"),
    automationStatus: coerceEnum(
      raw?.automationStatus,
      ALLOWED_AUTOMATION_STATUSES,
      "Not Started"
    ),
    steps,
    expectedResult: String(raw?.expectedResult || "").trim(),
  };
}

function extractJson(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/**
 * Given one or more normalized JIRA issues, ask Gemini to produce a single
 * test case draft that covers them. Returns an object the frontend can feed
 * directly into the existing "Add Test Case" modal (sectionId is added by
 * the caller).
 */
export async function draftTestCaseFromIssues(issues) {
  const list = Array.isArray(issues) ? issues : [issues];
  if (!list.length) {
    throw httpError(400, "At least one JIRA ticket is required.");
  }
  if (!isAiConfigured()) {
    throw httpError(
      500,
      "AI is not configured. Set GEMINI_API_KEY in backend/.env (get a free key at https://aistudio.google.com/apikey)."
    );
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: buildUserPrompt(list) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1536,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (res.status === 400) {
    const body = await res.text().catch(() => "");
    // 400 from Gemini often means the API key is malformed or the model name is wrong.
    throw httpError(
      400,
      `Gemini rejected the request. Check GEMINI_API_KEY / GEMINI_MODEL in backend/.env. ${body.slice(
        0,
        200
      )}`
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw httpError(
      res.status,
      "Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env."
    );
  }
  if (res.status === 429) {
    throw httpError(
      429,
      "Gemini rate limit hit (free tier). Wait a minute and try again, or upgrade the key."
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw httpError(
      res.status,
      `Gemini error ${res.status}: ${body.slice(0, 200)}`
    );
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.filter((p) => typeof p?.text === "string")
      .map((p) => p.text)
      .join("\n") || "";

  const parsed = extractJson(text);
  if (!parsed) {
    throw httpError(
      502,
      "AI response could not be parsed as JSON. Try again."
    );
  }
  return normalizeDraft(parsed);
}

/** Back-compat wrapper — single-issue variant used by the legacy endpoint. */
export async function draftTestCaseFromIssue(issue) {
  return draftTestCaseFromIssues([issue]);
}
