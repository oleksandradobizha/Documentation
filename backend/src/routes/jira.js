import { Router } from "express";
import { readJiraFile, writeJiraFile } from "../services/github.js";
import { searchIssues } from "../services/jira.js";
import {
  validateJiraSection,
  sanitizeJiraSection,
  nextJiraSectionId,
  nextSectionOrder,
  isJiraKey,
} from "../utils/validate.js";
import { requireApiKey } from "../middleware/auth.js";

const router = Router();

function ensureShape(json) {
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

function sanitizeTicket(t) {
  return {
    key: String(t.key || "").trim().toUpperCase(),
    url: String(t.url || "").trim(),
    summary: String(t.summary || "").trim(),
    issueType: String(t.issueType || "").trim(),
    priority: String(t.priority || "").trim(),
    status: String(t.status || "").trim(),
    labels: Array.isArray(t.labels) ? t.labels.map(String) : [],
    components: Array.isArray(t.components) ? t.components.map(String) : [],
  };
}

// GET /api/jira — full document (sections + tickets)
router.get("/", async (_req, res, next) => {
  try {
    const { json } = await readJiraFile();
    const shaped = ensureShape(json);
    shaped.sections = shaped.sections
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    res.json(shaped);
  } catch (e) {
    next(e);
  }
});

// POST /api/jira/sections — create a group of tickets
router.post("/sections", requireApiKey, async (req, res, next) => {
  try {
    validateJiraSection(req.body);
    const { name } = sanitizeJiraSection(req.body);

    const { json, sha } = await readJiraFile();
    const doc = ensureShape(json);
    if (doc.sections.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: "Section name already exists" });
    }

    const now = new Date().toISOString();
    const section = {
      id: nextJiraSectionId(doc.sections),
      name,
      order: nextSectionOrder(doc.sections),
      createdAt: now,
    };
    doc.sections.push(section);
    doc.updatedAt = now;

    await writeJiraFile(doc, sha, `feat(jira): add section "${section.name}"`);
    res.status(201).json(section);
  } catch (e) {
    next(e);
  }
});

// PUT /api/jira/sections/:id — rename a section
router.put("/sections/:id", requireApiKey, async (req, res, next) => {
  try {
    validateJiraSection(req.body);
    const { name } = sanitizeJiraSection(req.body);

    const { json, sha } = await readJiraFile();
    const doc = ensureShape(json);
    const idx = doc.sections.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const existing = doc.sections[idx];
    doc.sections[idx] = { ...existing, name };
    doc.updatedAt = new Date().toISOString();

    await writeJiraFile(
      doc,
      sha,
      `chore(jira): rename section ${existing.id} to "${name}"`
    );
    res.json(doc.sections[idx]);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/jira/sections/:id — deletes section; its tickets become unassigned
router.delete("/sections/:id", requireApiKey, async (req, res, next) => {
  try {
    const { json, sha } = await readJiraFile();
    const doc = ensureShape(json);
    const idx = doc.sections.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const [removed] = doc.sections.splice(idx, 1);
    doc.tickets.forEach((t) => {
      if (t.sectionId === removed.id) t.sectionId = null;
    });
    doc.updatedAt = new Date().toISOString();

    await writeJiraFile(
      doc,
      sha,
      `chore(jira): delete section "${removed.name}"`
    );
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/jira/extract
 * Body: { jql: string, sectionId?: string|null, maxResults?: number }
 * Runs the JQL query against JIRA, merges the results into the stored
 * tickets (dedup on issue key). Tickets without a sectionId stay
 * "unassigned". Returns the updated document.
 */
router.post("/extract", requireApiKey, async (req, res, next) => {
  try {
    const jql = String(req.body?.jql || "").trim();
    if (!jql) return res.status(400).json({ error: "jql is required" });
    const sectionId = req.body?.sectionId ? String(req.body.sectionId) : null;
    const maxResults = Number(req.body?.maxResults) || 50;

    const results = await searchIssues(jql, { maxResults });

    const { json, sha } = await readJiraFile();
    const doc = ensureShape(json);

    if (sectionId && !doc.sections.some((s) => s.id === sectionId)) {
      return res.status(400).json({ error: "Unknown sectionId" });
    }

    const now = new Date().toISOString();
    let added = 0;
    let updated = 0;

    for (const raw of results) {
      const t = sanitizeTicket(raw);
      if (!t.key) continue;
      const existing = doc.tickets.find((x) => x.key === t.key);
      if (existing) {
        Object.assign(existing, t, {
          sectionId: sectionId ?? existing.sectionId ?? null,
          updatedAt: now,
        });
        updated++;
      } else {
        doc.tickets.push({
          ...t,
          sectionId: sectionId ?? null,
          createdAt: now,
          updatedAt: now,
        });
        added++;
      }
    }
    doc.updatedAt = now;

    await writeJiraFile(
      doc,
      sha,
      `feat(jira): extract ${results.length} ticket${
        results.length === 1 ? "" : "s"
      } (+${added}/~${updated})`
    );

    doc.sections = doc.sections
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    res.json({ added, updated, found: results.length, doc });
  } catch (e) {
    next(e);
  }
});

// PUT /api/jira/tickets/:key — move into / out of a section
router.put("/tickets/:key", requireApiKey, async (req, res, next) => {
  try {
    const key = String(req.params.key || "").trim().toUpperCase();
    if (!isJiraKey(key)) {
      return res.status(400).json({ error: "Invalid JIRA key" });
    }
    const hasSection = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "sectionId"
    );
    if (!hasSection) {
      return res.status(400).json({ error: "sectionId is required" });
    }
    const sectionId = req.body.sectionId == null
      ? null
      : String(req.body.sectionId);

    const { json, sha } = await readJiraFile();
    const doc = ensureShape(json);
    const ticket = doc.tickets.find((t) => t.key === key);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    if (sectionId && !doc.sections.some((s) => s.id === sectionId)) {
      return res.status(400).json({ error: "Unknown sectionId" });
    }
    ticket.sectionId = sectionId;
    ticket.updatedAt = new Date().toISOString();
    doc.updatedAt = ticket.updatedAt;

    await writeJiraFile(
      doc,
      sha,
      `chore(jira): move ${key} ${sectionId ? "to section" : "out of section"}`
    );
    res.json(ticket);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/jira/tickets/:key — remove from our portal (JIRA untouched)
router.delete("/tickets/:key", requireApiKey, async (req, res, next) => {
  try {
    const key = String(req.params.key || "").trim().toUpperCase();
    const { json, sha } = await readJiraFile();
    const doc = ensureShape(json);
    const idx = doc.tickets.findIndex((t) => t.key === key);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const [removed] = doc.tickets.splice(idx, 1);
    doc.updatedAt = new Date().toISOString();
    await writeJiraFile(doc, sha, `chore(jira): remove ${removed.key}`);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
