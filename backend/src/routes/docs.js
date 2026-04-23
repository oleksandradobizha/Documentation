import { Router } from "express";
import { readDocsFile, writeDocsFile } from "../services/github.js";
import {
  validateDocSection,
  sanitizeDocSection,
  nextDocSectionId,
  nextSectionOrder,
} from "../utils/validate.js";
import { requireApiKey } from "../middleware/auth.js";

const router = Router();

function ensureShape(json) {
  if (!json || typeof json !== "object") {
    return { version: 1, updatedAt: new Date().toISOString(), sections: [] };
  }
  if (!Array.isArray(json.sections)) json.sections = [];
  return json;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Verify `parentId` references an existing top-level (no parent) section.
 * The portal only supports a single level of nesting: main pages can have
 * sub pages, but a sub page cannot itself be a parent.
 */
function assertValidParent(sections, parentId, selfId) {
  if (parentId == null) return null;
  if (parentId === selfId) {
    throw httpError(400, "A section cannot be its own parent.");
  }
  const parent = sections.find((s) => s.id === parentId);
  if (!parent) {
    throw httpError(400, `Parent section "${parentId}" not found.`);
  }
  if (parent.parentId) {
    throw httpError(
      400,
      "Sub pages cannot contain other sub pages (max nesting depth is 1)."
    );
  }
  if (selfId) {
    // If the section being updated already has children, it cannot become a child itself.
    const hasChildren = sections.some((s) => s.parentId === selfId);
    if (hasChildren) {
      throw httpError(
        400,
        "This section has sub pages — move or delete them before nesting it under another page."
      );
    }
  }
  return parent.id;
}

// GET /api/docs — return full documentation document
router.get("/", async (_req, res, next) => {
  try {
    const { json } = await readDocsFile();
    const shaped = ensureShape(json);
    shaped.sections = shaped.sections
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    res.json(shaped);
  } catch (e) {
    next(e);
  }
});

// POST /api/docs/sections — create a new doc section
router.post("/sections", requireApiKey, async (req, res, next) => {
  try {
    validateDocSection(req.body);
    const sanitized = sanitizeDocSection({
      name: req.body?.name,
      content: req.body?.content ?? "",
      isDraft: req.body?.isDraft,
      parentId: req.body?.parentId,
      order: req.body?.order,
    });
    const { name, content = "" } = sanitized;
    const isDraft = sanitized.isDraft === true;

    const { json, sha } = await readDocsFile();
    const doc = ensureShape(json);

    if (
      doc.sections.some((s) => s.name.toLowerCase() === name.toLowerCase())
    ) {
      return res.status(409).json({ error: "Section name already exists" });
    }

    const parentId =
      "parentId" in sanitized
        ? assertValidParent(doc.sections, sanitized.parentId, null)
        : null;

    // If no explicit order, append to the end of the target group (top-level
    // or siblings under the chosen parent) so it shows up last.
    const siblings = doc.sections.filter(
      (s) => (s.parentId || null) === (parentId || null)
    );
    const order =
      sanitized.order != null
        ? Number(sanitized.order)
        : siblings.reduce((m, s) => Math.max(m, s.order ?? 0), -1) + 1;

    const now = new Date().toISOString();
    const section = {
      id: nextDocSectionId(doc.sections),
      name,
      order,
      parentId: parentId || null,
      content,
      ...(isDraft ? { isDraft: true } : {}),
      createdAt: now,
      updatedAt: now,
    };
    doc.sections.push(section);
    doc.updatedAt = now;

    await writeDocsFile(doc, sha, `docs(qa): add section "${section.name}"`);
    res.status(201).json(section);
  } catch (e) {
    next(e);
  }
});

// PUT /api/docs/sections/:id — rename, update content, move, or toggle draft
router.put("/sections/:id", requireApiKey, async (req, res, next) => {
  try {
    const body = req.body || {};
    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasContent = Object.prototype.hasOwnProperty.call(body, "content");
    const hasDraft = Object.prototype.hasOwnProperty.call(body, "isDraft");
    const hasParent = Object.prototype.hasOwnProperty.call(body, "parentId");
    const hasOrder = Object.prototype.hasOwnProperty.call(body, "order");
    if (!hasName && !hasContent && !hasDraft && !hasParent && !hasOrder) {
      return res.status(400).json({
        error:
          "Provide at least 'name', 'content', 'isDraft', 'parentId', or 'order'.",
      });
    }
    validateDocSection(body, { requireName: hasName });
    const patch = sanitizeDocSection(body);

    const { json, sha } = await readDocsFile();
    const doc = ensureShape(json);
    const idx = doc.sections.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    if (patch.name) {
      const taken = doc.sections.some(
        (s, i) =>
          i !== idx && s.name.toLowerCase() === patch.name.toLowerCase()
      );
      if (taken) {
        return res.status(409).json({ error: "Section name already exists" });
      }
    }

    if (hasParent) {
      const parentId = assertValidParent(
        doc.sections,
        patch.parentId,
        req.params.id
      );
      patch.parentId = parentId || null;
    }

    const now = new Date().toISOString();
    const existing = doc.sections[idx];
    const updated = { ...existing, ...patch, updatedAt: now };
    if (patch.isDraft === false) delete updated.isDraft;
    doc.sections[idx] = updated;
    doc.updatedAt = now;

    const msg = patch.name
      ? `docs(qa): rename section ${existing.id} to "${patch.name}"`
      : hasParent || hasOrder
      ? `docs(qa): move section "${existing.name}"`
      : `docs(qa): update section "${existing.name}"`;

    await writeDocsFile(doc, sha, msg);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/docs/sections/reorder
 * Body: { items: [{ id, parentId, order }, ...] }
 *
 * Applies parent/order updates to the provided sections in a single commit.
 * Returns the updated documentation document.
 */
router.post("/sections/reorder", requireApiKey, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items) {
      return res.status(400).json({ error: "items array is required" });
    }

    const { json, sha } = await readDocsFile();
    const doc = ensureShape(json);

    // First pass: validate every item resolves to an existing section and
    // its parentId is a legal top-level section (or null).
    const byId = new Map(doc.sections.map((s) => [s.id, s]));
    const normalized = items.map((raw) => {
      const id = String(raw?.id || "").trim();
      if (!id || !byId.has(id)) {
        throw httpError(400, `Unknown section "${id}"`);
      }
      const parentId =
        raw?.parentId == null || raw.parentId === ""
          ? null
          : String(raw.parentId).trim();
      if (parentId != null) {
        if (parentId === id) {
          throw httpError(400, `Section "${id}" cannot be its own parent.`);
        }
        const parent = byId.get(parentId);
        if (!parent) {
          throw httpError(400, `Parent section "${parentId}" not found.`);
        }
        // Parent must be top-level after the reorder too. Because the caller
        // sends the full desired state, we accept it as long as the parent's
        // own item either isn't in the batch or is being placed at top-level.
        const parentPatch = items.find(
          (it) => String(it?.id || "").trim() === parentId
        );
        const parentNewParent = parentPatch
          ? parentPatch.parentId == null || parentPatch.parentId === ""
            ? null
            : String(parentPatch.parentId).trim()
          : parent.parentId || null;
        if (parentNewParent) {
          throw httpError(
            400,
            "Sub pages cannot contain other sub pages (max nesting depth is 1)."
          );
        }
      }
      const order = Number.isFinite(Number(raw?.order)) ? Number(raw.order) : 0;
      return { id, parentId, order };
    });

    const now = new Date().toISOString();
    for (const patch of normalized) {
      const idx = doc.sections.findIndex((s) => s.id === patch.id);
      if (idx === -1) continue;
      doc.sections[idx] = {
        ...doc.sections[idx],
        parentId: patch.parentId,
        order: patch.order,
        updatedAt: now,
      };
    }
    doc.updatedAt = now;

    await writeDocsFile(doc, sha, "docs(qa): reorder sections");
    const shaped = {
      ...doc,
      sections: doc.sections
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    };
    res.json(shaped);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/docs/sections/:id
// Deletes the section and (cascade) any sub pages attached to it.
router.delete("/sections/:id", requireApiKey, async (req, res, next) => {
  try {
    const { json, sha } = await readDocsFile();
    const doc = ensureShape(json);
    const idx = doc.sections.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const removed = doc.sections[idx];
    const childIds = doc.sections
      .filter((s) => s.parentId === removed.id)
      .map((s) => s.id);
    const toRemove = new Set([removed.id, ...childIds]);
    doc.sections = doc.sections.filter((s) => !toRemove.has(s.id));
    doc.updatedAt = new Date().toISOString();

    const msg = childIds.length
      ? `docs(qa): delete section "${removed.name}" and ${childIds.length} sub page(s)`
      : `docs(qa): delete section "${removed.name}"`;

    await writeDocsFile(doc, sha, msg);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
