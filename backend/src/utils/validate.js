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

export const MAX_SECTION_DEPTH = 2; // 0 = main, 1 = sub, 2 = sub-of-sub
export const UNDEFINED_SECTION_ID = "sec-undefined";
export const UNDEFINED_SECTION_NAME = "Undefined";

export function validateSection(s) {
  const errors = [];
  if (!s || typeof s !== "object") errors.push("payload must be an object");
  if (!s?.name?.trim()) errors.push("name is required");
  if (s?.name && s.name.length > 80) errors.push("name is too long");
  if (
    s?.parentId != null &&
    s.parentId !== "" &&
    typeof s.parentId !== "string"
  ) {
    errors.push("parentId must be a string");
  }
  if (errors.length) {
    const err = new Error(errors.join("; "));
    err.status = 400;
    throw err;
  }
}

// Compute depth of a section given the full list.
// Returns 0 for root (no parent), 1/2 for nested, Infinity on cycles.
export function sectionDepth(section, allSections) {
  const byId = new Map(allSections.map((s) => [s.id, s]));
  let depth = 0;
  let current = section;
  const seen = new Set();
  while (current && current.parentId) {
    if (seen.has(current.id)) return Infinity;
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) return depth; // orphan parent pointer = treat as root-ish
    depth += 1;
    current = parent;
  }
  return depth;
}

export function validateParentPointer(parentId, allSections, selfId) {
  if (!parentId) return; // root level is always fine
  const parent = allSections.find((s) => s.id === parentId);
  if (!parent) {
    const err = new Error("parent section not found");
    err.status = 400;
    throw err;
  }
  if (selfId && parent.id === selfId) {
    const err = new Error("a section cannot be its own parent");
    err.status = 400;
    throw err;
  }
  // Prevent cycles when moving an existing section
  if (selfId) {
    const byId = new Map(allSections.map((s) => [s.id, s]));
    let cur = parent;
    const seen = new Set();
    while (cur) {
      if (cur.id === selfId) {
        const err = new Error("cannot set parent to a descendant");
        err.status = 400;
        throw err;
      }
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : null;
    }
  }
  const depth = sectionDepth(parent, allSections);
  if (depth + 1 > MAX_SECTION_DEPTH) {
    const err = new Error(
      `maximum nesting depth is ${MAX_SECTION_DEPTH + 1} levels`
    );
    err.status = 400;
    throw err;
  }
}

export function validateTestCase(tc) {
  const errors = [];
  if (!tc || typeof tc !== "object") errors.push("payload must be an object");
  if (!tc?.title?.trim()) errors.push("title is required");
  // sectionId is optional — callers default to the Undefined section.
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
    sectionId: (tc.sectionId || "").trim() || UNDEFINED_SECTION_ID,
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
  const out = { name: s.name.trim() };
  if (s.parentId != null) {
    const p = String(s.parentId).trim();
    out.parentId = p || null;
  }
  return out;
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
  if (s?.isDraft != null && typeof s.isDraft !== "boolean") {
    errors.push("isDraft must be a boolean");
  }
  if (
    s?.parentId != null &&
    s.parentId !== "" &&
    typeof s.parentId !== "string"
  ) {
    errors.push("parentId must be a string or null");
  }
  if (s?.order != null && !Number.isFinite(Number(s.order))) {
    errors.push("order must be a number");
  }
  if (s?.icon != null && s.icon !== "" && typeof s.icon !== "string") {
    errors.push("icon must be a string or null");
  }
  if (typeof s?.icon === "string" && s.icon.length > 16) {
    errors.push("icon is too long");
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
  if (s.isDraft != null) out.isDraft = Boolean(s.isDraft);
  if (Object.prototype.hasOwnProperty.call(s, "parentId")) {
    const v = s.parentId;
    out.parentId = v === "" || v == null ? null : String(v).trim();
  }
  if (s.order != null && Number.isFinite(Number(s.order))) {
    out.order = Number(s.order);
  }
  if (Object.prototype.hasOwnProperty.call(s, "icon")) {
    const v = s.icon;
    out.icon = v === "" || v == null ? null : String(v).trim().slice(0, 16);
  }
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
