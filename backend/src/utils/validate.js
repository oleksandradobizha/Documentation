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
