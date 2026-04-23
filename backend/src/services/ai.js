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
const DEFAULT_DOC_PROMPT_PATH = resolve(__dirname, "../prompts/docsection.md");

// Minimal fallback in case the prompt file is missing / unreadable. The real
// persona + rules live in backend/src/prompts/testcase.md — keep this short.
const FALLBACK_SYSTEM_PROMPT =
  "You are a senior QA engineer. Draft concise, reproducible functional test cases from JIRA tickets. Steps must be imperative, executable by a manual tester, and free of code or selectors.";

const FALLBACK_DOC_SYSTEM_PROMPT =
  "You are a senior QA engineer curating internal QA documentation. Given a source document, produce a concise HTML fragment (headings, lists, links, tables) suitable for the QA portal. Return JSON with {title, content}.";

function loadPromptFile(envInline, envPath, defaultPath, fallback, label) {
  const inline = process.env[envInline];
  if (inline && inline.trim()) return inline.trim();

  const configured = process.env[envPath];
  const path = configured
    ? isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured)
    : defaultPath;

  try {
    const text = readFileSync(path, "utf8");
    const trimmed = text.trim();
    if (trimmed) return trimmed;
  } catch (err) {
    console.warn(
      `[ai] Could not read ${label} prompt at ${path}: ${err.message}. Using fallback prompt.`
    );
  }
  return fallback;
}

// Read once at startup — prompt edits take effect after backend restart.
const SYSTEM_PROMPT = loadPromptFile(
  "GEMINI_SYSTEM_PROMPT",
  "GEMINI_SYSTEM_PROMPT_PATH",
  DEFAULT_PROMPT_PATH,
  FALLBACK_SYSTEM_PROMPT,
  "testcase"
);
const DOC_SYSTEM_PROMPT = loadPromptFile(
  "GEMINI_DOC_SYSTEM_PROMPT",
  "GEMINI_DOC_SYSTEM_PROMPT_PATH",
  DEFAULT_DOC_PROMPT_PATH,
  FALLBACK_DOC_SYSTEM_PROMPT,
  "docsection"
);

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

/* ========================================================================
 * Documentation section drafting
 * ====================================================================== */

const DOC_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    content: { type: "string" },
  },
  required: ["title", "content"],
};

const MAX_DOC_SOURCE_CHARS = 40_000;
const DOC_FETCH_TIMEOUT_MS = 15_000;

function stripHtml(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Fetch the contents of a URL and return a plain-text excerpt (trimmed to
 * MAX_DOC_SOURCE_CHARS). Handles HTML, plain text, and Markdown. Does NOT
 * follow auth-protected pages (Confluence / Google Docs) — the caller can
 * paste raw text in those cases.
 */
export async function fetchSourceText(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw httpError(400, "Please provide a valid http(s) URL.");
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    throw httpError(400, "Only http(s) URLs are supported.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOC_FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; QAPortalBot/1.0; +https://buildee.com)",
        accept:
          "text/html,text/plain,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw httpError(
        504,
        `Timed out fetching ${parsed.hostname} (15s). Try pasting the content directly.`
      );
    }
    throw httpError(
      502,
      `Could not fetch ${parsed.hostname}: ${err.message}. Try pasting the content directly.`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw httpError(
      res.status,
      `Source URL returned HTTP ${res.status}. If the page requires login, paste the content directly.`
    );
  }
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const raw = await res.text();
  const text = contentType.includes("html") ? stripHtml(raw) : raw;
  const trimmed = text.trim();
  if (!trimmed) {
    throw httpError(
      422,
      "Source URL returned no readable text. Try pasting the content directly."
    );
  }
  return trimmed.slice(0, MAX_DOC_SOURCE_CHARS);
}

function buildDocUserPrompt({ sourceUrl, sourceText, hint }) {
  const parts = [
    `Draft ONE documentation section for the QA portal based on the source material below.`,
  ];
  if (sourceUrl) parts.push(`Source URL: ${sourceUrl}`);
  if (hint && hint.trim()) {
    parts.push(`Author's note / focus: ${hint.trim()}`);
  }
  parts.push(`\nSource content (may be truncated):\n"""\n${sourceText}\n"""`);
  parts.push(
    `\nReturn ONLY a JSON object with exactly these keys:\n` +
      `{\n  "title": "Short descriptive name (<= 60 chars, Title Case, no trailing punctuation).",\n` +
      `  "content": "HTML fragment following the formatting rules from the system prompt."\n}`
  );
  parts.push(
    `\nReminders:\n` +
      `- Do not invent facts not present in the source.\n` +
      `- Preserve every URL exactly as written.\n` +
      `- Use <h1> once for the title, then <h2>/<h3> for subsections.\n` +
      `- Use <a href="…">label</a> for links, <pre><code>…</code></pre> for commands.\n` +
      `- Use the <div class="doc-cards"> … </div> block for small sets of parallel items.`
  );
  return parts.join("\n\n");
}

function sanitizeDocHtml(html) {
  if (typeof html !== "string") return "";
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

function normalizeDocDraft(raw, { fallbackTitle } = {}) {
  const rawTitle = typeof raw?.title === "string" ? raw.title.trim() : "";
  const title = rawTitle.slice(0, 120) || fallbackTitle || "Draft section";
  const content = sanitizeDocHtml(raw?.content || "");
  return { title, content };
}

/**
 * Ask Gemini to produce a documentation section draft from the provided
 * source material. Either `sourceUrl` or `sourceText` must be provided; if
 * both are provided the raw text wins. Returns `{ title, content }` where
 * `content` is an HTML fragment suitable for the rich-text doc editor.
 */
export async function draftDocSectionFromSource({
  sourceUrl = "",
  sourceText = "",
  hint = "",
} = {}) {
  const rawText = String(sourceText || "").trim();
  const rawUrl = String(sourceUrl || "").trim();
  if (!rawText && !rawUrl) {
    throw httpError(
      400,
      "Provide either a source URL or pasted source text."
    );
  }
  if (!isAiConfigured()) {
    throw httpError(
      500,
      "AI is not configured. Set GEMINI_API_KEY in backend/.env (get a free key at https://aistudio.google.com/apikey)."
    );
  }

  const text = rawText
    ? rawText.slice(0, MAX_DOC_SOURCE_CHARS)
    : await fetchSourceText(rawUrl);

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
        parts: [{ text: DOC_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildDocUserPrompt({
                sourceUrl: rawUrl,
                sourceText: text,
                hint,
              }),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: DOC_RESPONSE_SCHEMA,
      },
    }),
  });

  if (res.status === 400) {
    const body = await res.text().catch(() => "");
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
      "Gemini rate limit hit (free tier). Wait a minute and try again."
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
  const responseText =
    data?.candidates?.[0]?.content?.parts
      ?.filter((p) => typeof p?.text === "string")
      .map((p) => p.text)
      .join("\n") || "";

  const parsed = extractJson(responseText);
  if (!parsed) {
    throw httpError(
      502,
      "AI response could not be parsed as JSON. Try again."
    );
  }

  const fallbackTitle = rawUrl
    ? `Draft from ${(() => {
        try {
          return new URL(rawUrl).hostname;
        } catch {
          return "source";
        }
      })()}`
    : "Draft section";

  const draft = normalizeDocDraft(parsed, { fallbackTitle });
  if (!draft.content) {
    throw httpError(502, "AI returned an empty draft. Try again.");
  }
  return draft;
}
