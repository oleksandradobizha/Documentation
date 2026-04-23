export const ALLOWED_MODULES = [
  "Analysis",
  "Buildings",
  "ESPM",
  "Measures",
  "Mobile",
  "Project",
  "Proposal",
];
export const ALLOWED_PRIORITIES = ["Highest", "High", "Medium", "Low"];
export const ALLOWED_AUTOMATION_STATUSES = [
  "Not Started",
  "In Progress",
  "Done",
];

export function validateSection(s) {
  const errors = [];
  if (!s || typeof s !== "object") errors.push("payload must be an object");
  if (!s?.name?.trim()) errors.push("name is required");
  if (s?.name && s.name.length > 80) errors.push("name is too long");
  if (errors.length) {
    const err = new Error(errors.join("; "));
    err.status = 400;
    throw err;
  }
}

export function validateTestCase(tc) {
  const errors = [];
  if (!tc || typeof tc !== "object") errors.push("payload must be an object");
  if (!tc?.title?.trim()) errors.push("title is required");
  if (!tc?.sectionId?.trim()) errors.push("sectionId is required");
  if (!ALLOWED_MODULES.includes(tc?.module)) {
    errors.push(`module must be one of: ${ALLOWED_MODULES.join(", ")}`);
  }
  if (!ALLOWED_PRIORITIES.includes(tc?.priority)) {
    errors.push(`priority must be one of: ${ALLOWED_PRIORITIES.join(", ")}`);
  }
  if (!ALLOWED_AUTOMATION_STATUSES.includes(tc?.automationStatus)) {
    errors.push(
      `automationStatus must be one of: ${ALLOWED_AUTOMATION_STATUSES.join(
        ", "
      )}`
    );
  }
  if (errors.length) {
    const err = new Error(errors.join("; "));
    err.status = 400;
    throw err;
  }
}

const JIRA_KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/;

export function sanitizeTestCase(tc) {
  return {
    sectionId: tc.sectionId.trim(),
    title: tc.title.trim(),
    module: tc.module,
    priority: tc.priority,
    automationStatus: tc.automationStatus,
    description: (tc.description || "").trim(),
    steps: Array.isArray(tc.steps)
      ? tc.steps.map((s) => String(s).trim()).filter(Boolean)
      : [],
    expectedResult: (tc.expectedResult || "").trim(),
    sources: Array.isArray(tc.sources)
      ? Array.from(
          new Set(
            tc.sources
              .map((s) => String(s).trim().toUpperCase())
              .filter((s) => JIRA_KEY_RE.test(s))
          )
        )
      : [],
  };
}

export function sanitizeSection(s) {
  return { name: s.name.trim() };
}

export function nextTestCaseId(existing) {
  const max = existing
    .map((t) => parseInt(String(t.id || "").replace(/^TC-/, ""), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `TC-${String(max + 1).padStart(4, "0")}`;
}

export function nextSectionId(existing) {
  const max = existing
    .map((s) => parseInt(String(s.id || "").replace(/^sec-/, ""), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `sec-${String(max + 1).padStart(3, "0")}`;
}

export function nextSectionOrder(existing) {
  return existing.reduce((m, s) => Math.max(m, s.order ?? 0), -1) + 1;
}

/* ---------- Documentation ---------- */

const MAX_DOC_CONTENT = 200_000; // ~200 KB of HTML per section

export function validateDocSection(s, { requireName = true } = {}) {
  const errors = [];
  if (!s || typeof s !== "object") errors.push("payload must be an object");
  if (requireName) {
    if (!s?.name?.trim()) errors.push("name is required");
    if (s?.name && s.name.length > 120) errors.push("name is too long");
  } else if (s?.name != null && s.name.length > 120) {
    errors.push("name is too long");
  }
  if (s?.content != null && typeof s.content !== "string") {
    errors.push("content must be a string");
  }
  if (typeof s?.content === "string" && s.content.length > MAX_DOC_CONTENT) {
    errors.push("content is too long");
  }
  if (errors.length) {
    const err = new Error(errors.join("; "));
    err.status = 400;
    throw err;
  }
}

export function sanitizeDocSection(s) {
  const out = {};
  if (s.name != null) out.name = String(s.name).trim();
  if (s.content != null) out.content = String(s.content);
  return out;
}

export function nextDocSectionId(existing) {
  const max = existing
    .map((s) => parseInt(String(s.id || "").replace(/^doc-/, ""), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `doc-${String(max + 1).padStart(3, "0")}`;
}

/* ---------- JIRA tickets ---------- */

export function validateJiraSection(s) {
  const errors = [];
  if (!s || typeof s !== "object") errors.push("payload must be an object");
  if (!s?.name?.trim()) errors.push("name is required");
  if (s?.name && s.name.length > 80) errors.push("name is too long");
  if (errors.length) {
    const err = new Error(errors.join("; "));
    err.status = 400;
    throw err;
  }
}

export function sanitizeJiraSection(s) {
  return { name: s.name.trim() };
}

export function nextJiraSectionId(existing) {
  const max = existing
    .map((s) => parseInt(String(s.id || "").replace(/^jsec-/, ""), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `jsec-${String(max + 1).padStart(3, "0")}`;
}

export function isJiraKey(value) {
  return typeof value === "string" && JIRA_KEY_RE.test(value.trim());
}
