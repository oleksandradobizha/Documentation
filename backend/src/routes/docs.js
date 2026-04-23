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
    const { name, content = "" } = sanitizeDocSection({
      name: req.body?.name,
      content: req.body?.content ?? "",
    });

    const { json, sha } = await readDocsFile();
    const doc = ensureShape(json);

    if (
      doc.sections.some((s) => s.name.toLowerCase() === name.toLowerCase())
    ) {
      return res.status(409).json({ error: "Section name already exists" });
    }

    const now = new Date().toISOString();
    const section = {
      id: nextDocSectionId(doc.sections),
      name,
      order: nextSectionOrder(doc.sections),
      content,
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

// PUT /api/docs/sections/:id — rename or update content
router.put("/sections/:id", requireApiKey, async (req, res, next) => {
  try {
    const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, "name");
    const hasContent = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "content"
    );
    if (!hasName && !hasContent) {
      return res
        .status(400)
        .json({ error: "Provide at least 'name' or 'content'" });
    }
    validateDocSection(req.body, { requireName: hasName });
    const patch = sanitizeDocSection(req.body);

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

    const now = new Date().toISOString();
    const existing = doc.sections[idx];
    const updated = { ...existing, ...patch, updatedAt: now };
    doc.sections[idx] = updated;
    doc.updatedAt = now;

    const msg = patch.name
      ? `docs(qa): rename section ${existing.id} to "${patch.name}"`
      : `docs(qa): update section "${existing.name}"`;

    await writeDocsFile(doc, sha, msg);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/docs/sections/:id
router.delete("/sections/:id", requireApiKey, async (req, res, next) => {
  try {
    const { json, sha } = await readDocsFile();
    const doc = ensureShape(json);
    const idx = doc.sections.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const [removed] = doc.sections.splice(idx, 1);
    doc.updatedAt = new Date().toISOString();

    await writeDocsFile(
      doc,
      sha,
      `docs(qa): delete section "${removed.name}"`
    );
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
