import { Octokit } from "@octokit/rest";
import {
  UNDEFINED_SECTION_ID,
  UNDEFINED_SECTION_NAME,
} from "../utils/validate.js";

/**
 * Storage layout on GitHub:
 *
 *   data/
 *     docs/
 *       index.json                         # { version, updatedAt, sections[] (no content) }
 *       sections/<id>.json                 # { id, content, updatedAt }
 *     testcases/
 *       index.json                         # { version, updatedAt, sections[] }
 *       sections/<sectionId>.json          # { sectionId, testCases: [...] }
 *     jira/
 *       index.json                         # { version, updatedAt, sections[] }
 *       sections/<sectionId>.json          # { sectionId, tickets: [...] }
 *       unassigned.json                    # { tickets: [...] }  (tickets with sectionId === null)
 *
 * Legacy flat files (data/documentation.json, data/testcases.json,
 * data/jiratickets.json) are migrated into the new layout on first read,
 * then deleted as part of the migration commit. The old history is always
 * recoverable via `git log`.
 *
 * Each HTTP request performs one read-modify-write cycle. The write diffs
 * the pre-read snapshot against the route's post-mutation state and commits
 * only the files that actually changed, as a single atomic commit via the
 * Git Data API. This keeps per-edit payloads small even when the corpus
 * grows to hundreds of sections.
 */

let _octokit;
function octokit() {
  if (!_octokit) {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN is not set");
    }
    _octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return _octokit;
}

function repoCfg() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!owner || !repo) {
    throw new Error("GITHUB_OWNER and GITHUB_REPO must be set");
  }
  return { owner, repo, branch };
}

// ---------- Storage paths ----------

const DOCS_DIR = "data/docs";
const DOCS_INDEX_PATH = `${DOCS_DIR}/index.json`;
const DOCS_SECTIONS_DIR = `${DOCS_DIR}/sections`;

const TC_DIR = "data/testcases";
const TC_INDEX_PATH = `${TC_DIR}/index.json`;
const TC_SECTIONS_DIR = `${TC_DIR}/sections`;

const JIRA_DIR = "data/jira";
const JIRA_INDEX_PATH = `${JIRA_DIR}/index.json`;
const JIRA_SECTIONS_DIR = `${JIRA_DIR}/sections`;
const JIRA_UNASSIGNED_PATH = `${JIRA_DIR}/unassigned.json`;

// Legacy single-file locations (env vars kept for back-compat on first run).
function legacyDocsPath() {
  return process.env.DOCS_PATH || "data/documentation.json";
}
function legacyTestCasesPath() {
  return process.env.DATA_PATH || "data/testcases.json";
}
function legacyJiraPath() {
  return process.env.JIRA_PATH || "data/jiratickets.json";
}

function docContentPath(id) {
  return `${DOCS_SECTIONS_DIR}/${id}.json`;
}
function tcSectionPath(sectionId) {
  return `${TC_SECTIONS_DIR}/${sectionId}.json`;
}
function jiraSectionPath(sectionId) {
  return `${JIRA_SECTIONS_DIR}/${sectionId}.json`;
}

// ---------- Low-level GitHub helpers ----------

async function getFileIfExists(path) {
  const { owner, repo, branch } = repoCfg();
  try {
    const { data } = await octokit().repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    if (Array.isArray(data) || data.type !== "file") return null;
    const content = Buffer.from(data.content, "base64").toString("utf8");
    return { path, content, sha: data.sha };
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}

async function getJsonIfExists(path) {
  const file = await getFileIfExists(path);
  if (!file) return null;
  try {
    return { json: JSON.parse(file.content), sha: file.sha };
  } catch (e) {
    throw new Error(`Invalid JSON in ${path}: ${e.message}`);
  }
}

/**
 * Commit a batch of file changes (writes + deletions) as a single commit on
 * the configured branch, using the Git Data API.
 *
 * @param {{writes?: Array<{path:string, json:unknown}>, deletions?: string[], message: string}} params
 * @returns {Promise<string|null>} new commit SHA, or null if nothing to do.
 */
async function commitChanges({ writes = [], deletions = [], message }) {
  if (writes.length === 0 && deletions.length === 0) return null;

  const { owner, repo, branch } = repoCfg();
  const o = octokit();

  const { data: ref } = await o.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const parentCommitSha = ref.object.sha;
  const { data: parentCommit } = await o.git.getCommit({
    owner,
    repo,
    commit_sha: parentCommitSha,
  });
  const baseTreeSha = parentCommit.tree.sha;

  const treeEntries = [];
  // Create blobs in parallel — the contents API is I/O-bound and GitHub
  // handles concurrent blob creation fine.
  const blobs = await Promise.all(
    writes.map((w) =>
      o.git.createBlob({
        owner,
        repo,
        content: JSON.stringify(w.json, null, 2) + "\n",
        encoding: "utf-8",
      })
    )
  );
  for (let i = 0; i < writes.length; i++) {
    treeEntries.push({
      path: writes[i].path,
      mode: "100644",
      type: "blob",
      sha: blobs[i].data.sha,
    });
  }
  for (const p of deletions) {
    // sha: null in a tree entry deletes the file from the new tree.
    treeEntries.push({ path: p, mode: "100644", type: "blob", sha: null });
  }

  const { data: tree } = await o.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeEntries,
  });
  const { data: commit } = await o.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.sha,
    parents: [parentCommitSha],
  });
  await o.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.sha,
  });
  return commit.sha;
}

// Deep-clone via JSON — these documents are plain data, so this is safe and
// works on all Node versions. Used to snapshot the pre-mutation state.
function snapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

// ---------- Docs ----------

function stripContent(section) {
  const { content, ...rest } = section;
  return rest;
}

async function migrateDocsIfMissing() {
  const existing = await getJsonIfExists(DOCS_INDEX_PATH);
  if (existing) return null;

  const legacyPath = legacyDocsPath();
  const legacy = await getJsonIfExists(legacyPath);

  const now = new Date().toISOString();
  const writes = [];
  const deletions = [];
  let composed;

  if (legacy) {
    const sections = Array.isArray(legacy.json.sections)
      ? legacy.json.sections
      : [];
    composed = {
      version: legacy.json.version ?? 1,
      updatedAt: legacy.json.updatedAt ?? now,
      sections,
    };
    writes.push({
      path: DOCS_INDEX_PATH,
      json: {
        version: composed.version,
        updatedAt: composed.updatedAt,
        sections: sections.map(stripContent),
      },
    });
    for (const s of sections) {
      writes.push({
        path: docContentPath(s.id),
        json: {
          id: s.id,
          content: s.content || "",
          updatedAt: s.updatedAt || composed.updatedAt,
        },
      });
    }
    deletions.push(legacyPath);
  } else {
    composed = { version: 1, updatedAt: now, sections: [] };
    writes.push({ path: DOCS_INDEX_PATH, json: composed });
  }

  await commitChanges({
    writes,
    deletions,
    message: legacy
      ? "chore(storage): split documentation into per-section files"
      : "chore(storage): initialize docs storage layout",
  });
  return composed;
}

async function composeDocsDocument(indexOverride) {
  const index =
    indexOverride ??
    (await getJsonIfExists(DOCS_INDEX_PATH))?.json ?? {
      version: 1,
      updatedAt: new Date().toISOString(),
      sections: [],
    };
  const metas = Array.isArray(index.sections) ? index.sections : [];

  // Fetch all section content files in parallel.
  const contentFiles = await Promise.all(
    metas.map((m) => getJsonIfExists(docContentPath(m.id)))
  );
  const sections = metas.map((meta, i) => ({
    ...meta,
    content: contentFiles[i]?.json?.content ?? "",
  }));
  return {
    version: index.version ?? 1,
    updatedAt: index.updatedAt ?? new Date().toISOString(),
    sections,
  };
}

export async function readDocsFile() {
  let indexRes = await getJsonIfExists(DOCS_INDEX_PATH);
  if (!indexRes) {
    // First run (or mid-migration): create the new layout, then continue.
    await migrateDocsIfMissing();
    indexRes = await getJsonIfExists(DOCS_INDEX_PATH);
  }
  const json = await composeDocsDocument(indexRes?.json);
  // The "sha" we return is a snapshot of the pre-mutation state so
  // writeDocsFile can diff against exactly what the route started with,
  // not whatever is on disk right now.
  return { json, sha: { kind: "docs", prev: snapshot(json) } };
}

export async function writeDocsFile(newJson, shaToken, message) {
  const prev =
    shaToken && shaToken.kind === "docs" && shaToken.prev
      ? shaToken.prev
      : { version: 1, updatedAt: "", sections: [] };

  const oldById = new Map((prev.sections || []).map((s) => [s.id, s]));
  const newById = new Map((newJson.sections || []).map((s) => [s.id, s]));

  const writes = [];
  const deletions = [];

  const newIndex = {
    version: newJson.version ?? 1,
    updatedAt: newJson.updatedAt ?? new Date().toISOString(),
    sections: (newJson.sections || []).map(stripContent),
  };
  const oldIndex = {
    version: prev.version ?? 1,
    updatedAt: prev.updatedAt ?? "",
    sections: (prev.sections || []).map(stripContent),
  };
  if (JSON.stringify(newIndex) !== JSON.stringify(oldIndex)) {
    writes.push({ path: DOCS_INDEX_PATH, json: newIndex });
  }

  for (const [id, newSec] of newById) {
    const oldSec = oldById.get(id);
    const newContent = newSec.content ?? "";
    const oldContent = oldSec?.content ?? "";
    if (!oldSec || newContent !== oldContent) {
      writes.push({
        path: docContentPath(id),
        json: {
          id,
          content: newContent,
          updatedAt: newSec.updatedAt || newIndex.updatedAt,
        },
      });
    }
  }

  for (const [id] of oldById) {
    if (!newById.has(id)) deletions.push(docContentPath(id));
  }

  return commitChanges({ writes, deletions, message });
}

// ---------- Test cases ----------

function normalizeTestCasesJson(json) {
  if (!Array.isArray(json.sections)) json.sections = [];
  if (!Array.isArray(json.testCases)) json.testCases = [];

  for (const s of json.sections) {
    if (!Object.prototype.hasOwnProperty.call(s, "parentId")) {
      s.parentId = null;
    }
  }

  let undef = json.sections.find((s) => s.id === UNDEFINED_SECTION_ID);
  if (!undef) {
    undef = json.sections.find(
      (s) => (s.name || "").trim().toLowerCase() === "undefined"
    );
    if (!undef) {
      undef = {
        id: UNDEFINED_SECTION_ID,
        name: UNDEFINED_SECTION_NAME,
        parentId: null,
        order: -1,
        createdAt: new Date().toISOString(),
      };
      json.sections.unshift(undef);
    }
  }

  const sectionIds = new Set(json.sections.map((s) => s.id));
  for (const tc of json.testCases) {
    if (!tc.sectionId || !sectionIds.has(tc.sectionId)) {
      tc.sectionId = undef.id;
    }
  }
  return json;
}

function groupTestCasesBySection(testCases) {
  const map = new Map();
  for (const tc of testCases) {
    const key = tc.sectionId;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(tc);
  }
  return map;
}

async function migrateTestCasesIfMissing() {
  const existing = await getJsonIfExists(TC_INDEX_PATH);
  if (existing) return null;

  const legacyPath = legacyTestCasesPath();
  const legacy = await getJsonIfExists(legacyPath);

  const now = new Date().toISOString();
  const writes = [];
  const deletions = [];
  let composed;

  if (legacy) {
    composed = normalizeTestCasesJson({
      version: legacy.json.version ?? 2,
      updatedAt: legacy.json.updatedAt ?? now,
      sections: legacy.json.sections || [],
      testCases: legacy.json.testCases || [],
    });
    writes.push({
      path: TC_INDEX_PATH,
      json: {
        version: composed.version,
        updatedAt: composed.updatedAt,
        sections: composed.sections,
      },
    });
    const grouped = groupTestCasesBySection(composed.testCases);
    for (const section of composed.sections) {
      writes.push({
        path: tcSectionPath(section.id),
        json: {
          sectionId: section.id,
          testCases: grouped.get(section.id) || [],
        },
      });
    }
    deletions.push(legacyPath);
  } else {
    composed = normalizeTestCasesJson({
      version: 2,
      updatedAt: now,
      sections: [],
      testCases: [],
    });
    writes.push({
      path: TC_INDEX_PATH,
      json: {
        version: composed.version,
        updatedAt: composed.updatedAt,
        sections: composed.sections,
      },
    });
    // Ensure the Undefined bucket exists on disk.
    writes.push({
      path: tcSectionPath(UNDEFINED_SECTION_ID),
      json: { sectionId: UNDEFINED_SECTION_ID, testCases: [] },
    });
  }

  await commitChanges({
    writes,
    deletions,
    message: legacy
      ? "chore(storage): split test cases into per-section files"
      : "chore(storage): initialize test cases storage layout",
  });
  return composed;
}

async function composeTestCasesDocument(indexOverride) {
  const index =
    indexOverride ??
    (await getJsonIfExists(TC_INDEX_PATH))?.json ?? {
      version: 2,
      updatedAt: new Date().toISOString(),
      sections: [],
    };
  const sections = Array.isArray(index.sections) ? index.sections : [];

  const perSection = await Promise.all(
    sections.map((s) => getJsonIfExists(tcSectionPath(s.id)))
  );
  const testCases = [];
  for (let i = 0; i < sections.length; i++) {
    const payload = perSection[i]?.json;
    const list = Array.isArray(payload?.testCases) ? payload.testCases : [];
    for (const tc of list) testCases.push(tc);
  }

  return normalizeTestCasesJson({
    version: index.version ?? 2,
    updatedAt: index.updatedAt ?? new Date().toISOString(),
    sections,
    testCases,
  });
}

export async function readTestCasesFile() {
  let indexRes = await getJsonIfExists(TC_INDEX_PATH);
  if (!indexRes) {
    await migrateTestCasesIfMissing();
    indexRes = await getJsonIfExists(TC_INDEX_PATH);
  }
  const json = await composeTestCasesDocument(indexRes?.json);
  return { json, sha: { kind: "testcases", prev: snapshot(json) } };
}

export async function writeTestCasesFile(newJson, shaToken, message) {
  const prev =
    shaToken && shaToken.kind === "testcases" && shaToken.prev
      ? shaToken.prev
      : { version: 2, updatedAt: "", sections: [], testCases: [] };

  const writes = [];
  const deletions = [];

  const newIndex = {
    version: newJson.version ?? 2,
    updatedAt: newJson.updatedAt ?? new Date().toISOString(),
    sections: newJson.sections || [],
  };
  const oldIndex = {
    version: prev.version ?? 2,
    updatedAt: prev.updatedAt ?? "",
    sections: prev.sections || [],
  };
  if (JSON.stringify(newIndex) !== JSON.stringify(oldIndex)) {
    writes.push({ path: TC_INDEX_PATH, json: newIndex });
  }

  const oldGrouped = groupTestCasesBySection(prev.testCases || []);
  const newGrouped = groupTestCasesBySection(newJson.testCases || []);
  const oldSectionIds = new Set((prev.sections || []).map((s) => s.id));
  const newSectionIds = new Set((newJson.sections || []).map((s) => s.id));
  const allIds = new Set([
    ...oldSectionIds,
    ...newSectionIds,
    ...oldGrouped.keys(),
    ...newGrouped.keys(),
  ]);

  for (const id of allIds) {
    const stillExists = newSectionIds.has(id);
    if (!stillExists) {
      // Section was removed — drop its bucket file (routes already
      // reassigned its tests into Undefined).
      if (oldSectionIds.has(id) || oldGrouped.has(id)) {
        deletions.push(tcSectionPath(id));
      }
      continue;
    }
    const oldList = oldGrouped.get(id) || [];
    const newList = newGrouped.get(id) || [];
    if (JSON.stringify(oldList) !== JSON.stringify(newList)) {
      writes.push({
        path: tcSectionPath(id),
        json: { sectionId: id, testCases: newList },
      });
    }
  }

  return commitChanges({ writes, deletions, message });
}

// ---------- JIRA ----------

function ensureJiraShape(json) {
  if (!json || typeof json !== "object") {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      sections: [],
      tickets: [],
    };
  }
  if (!Array.isArray(json.sections)) json.sections = [];
  if (!Array.isArray(json.tickets)) json.tickets = [];
  return json;
}

function groupJiraTicketsBySection(tickets) {
  const bySection = new Map();
  const unassigned = [];
  for (const t of tickets) {
    if (t.sectionId == null) {
      unassigned.push(t);
      continue;
    }
    if (!bySection.has(t.sectionId)) bySection.set(t.sectionId, []);
    bySection.get(t.sectionId).push(t);
  }
  return { bySection, unassigned };
}

async function migrateJiraIfMissing() {
  const existing = await getJsonIfExists(JIRA_INDEX_PATH);
  if (existing) return null;

  const legacyPath = legacyJiraPath();
  const legacy = await getJsonIfExists(legacyPath);

  const now = new Date().toISOString();
  const writes = [];
  const deletions = [];
  let composed;

  if (legacy) {
    composed = ensureJiraShape({
      version: legacy.json.version ?? 1,
      updatedAt: legacy.json.updatedAt ?? now,
      sections: legacy.json.sections || [],
      tickets: legacy.json.tickets || [],
    });
    writes.push({
      path: JIRA_INDEX_PATH,
      json: {
        version: composed.version,
        updatedAt: composed.updatedAt,
        sections: composed.sections,
      },
    });
    const { bySection, unassigned } = groupJiraTicketsBySection(
      composed.tickets
    );
    for (const section of composed.sections) {
      writes.push({
        path: jiraSectionPath(section.id),
        json: {
          sectionId: section.id,
          tickets: bySection.get(section.id) || [],
        },
      });
    }
    writes.push({
      path: JIRA_UNASSIGNED_PATH,
      json: { tickets: unassigned },
    });
    deletions.push(legacyPath);
  } else {
    composed = ensureJiraShape({
      version: 1,
      updatedAt: now,
      sections: [],
      tickets: [],
    });
    writes.push({
      path: JIRA_INDEX_PATH,
      json: {
        version: composed.version,
        updatedAt: composed.updatedAt,
        sections: composed.sections,
      },
    });
    writes.push({
      path: JIRA_UNASSIGNED_PATH,
      json: { tickets: [] },
    });
  }

  await commitChanges({
    writes,
    deletions,
    message: legacy
      ? "chore(storage): split jira tickets into per-section files"
      : "chore(storage): initialize jira storage layout",
  });
  return composed;
}

async function composeJiraDocument(indexOverride) {
  const index =
    indexOverride ??
    (await getJsonIfExists(JIRA_INDEX_PATH))?.json ?? {
      version: 1,
      updatedAt: new Date().toISOString(),
      sections: [],
    };
  const sections = Array.isArray(index.sections) ? index.sections : [];

  const [perSection, unassignedRes] = await Promise.all([
    Promise.all(sections.map((s) => getJsonIfExists(jiraSectionPath(s.id)))),
    getJsonIfExists(JIRA_UNASSIGNED_PATH),
  ]);

  const tickets = [];
  for (let i = 0; i < sections.length; i++) {
    const list = Array.isArray(perSection[i]?.json?.tickets)
      ? perSection[i].json.tickets
      : [];
    for (const t of list) tickets.push(t);
  }
  const unassigned = Array.isArray(unassignedRes?.json?.tickets)
    ? unassignedRes.json.tickets
    : [];
  for (const t of unassigned) tickets.push(t);

  return ensureJiraShape({
    version: index.version ?? 1,
    updatedAt: index.updatedAt ?? new Date().toISOString(),
    sections,
    tickets,
  });
}

export async function readJiraFile() {
  let indexRes = await getJsonIfExists(JIRA_INDEX_PATH);
  if (!indexRes) {
    await migrateJiraIfMissing();
    indexRes = await getJsonIfExists(JIRA_INDEX_PATH);
  }
  const json = await composeJiraDocument(indexRes?.json);
  return { json, sha: { kind: "jira", prev: snapshot(json) } };
}

export async function writeJiraFile(newJson, shaToken, message) {
  const prev =
    shaToken && shaToken.kind === "jira" && shaToken.prev
      ? shaToken.prev
      : { version: 1, updatedAt: "", sections: [], tickets: [] };

  const writes = [];
  const deletions = [];

  const newIndex = {
    version: newJson.version ?? 1,
    updatedAt: newJson.updatedAt ?? new Date().toISOString(),
    sections: newJson.sections || [],
  };
  const oldIndex = {
    version: prev.version ?? 1,
    updatedAt: prev.updatedAt ?? "",
    sections: prev.sections || [],
  };
  if (JSON.stringify(newIndex) !== JSON.stringify(oldIndex)) {
    writes.push({ path: JIRA_INDEX_PATH, json: newIndex });
  }

  const oldSplit = groupJiraTicketsBySection(prev.tickets || []);
  const newSplit = groupJiraTicketsBySection(newJson.tickets || []);
  const oldSectionIds = new Set((prev.sections || []).map((s) => s.id));
  const newSectionIds = new Set((newJson.sections || []).map((s) => s.id));
  const allIds = new Set([
    ...oldSectionIds,
    ...newSectionIds,
    ...oldSplit.bySection.keys(),
    ...newSplit.bySection.keys(),
  ]);

  for (const id of allIds) {
    const stillExists = newSectionIds.has(id);
    if (!stillExists) {
      if (oldSectionIds.has(id) || oldSplit.bySection.has(id)) {
        deletions.push(jiraSectionPath(id));
      }
      continue;
    }
    const oldList = oldSplit.bySection.get(id) || [];
    const newList = newSplit.bySection.get(id) || [];
    if (JSON.stringify(oldList) !== JSON.stringify(newList)) {
      writes.push({
        path: jiraSectionPath(id),
        json: { sectionId: id, tickets: newList },
      });
    }
  }

  if (
    JSON.stringify(oldSplit.unassigned) !== JSON.stringify(newSplit.unassigned)
  ) {
    writes.push({
      path: JIRA_UNASSIGNED_PATH,
      json: { tickets: newSplit.unassigned },
    });
  }

  return commitChanges({ writes, deletions, message });
}
