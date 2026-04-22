import { Router } from "express";
import {
  readTestCasesFile,
  writeTestCasesFile,
} from "../services/github.js";
import {
  validateSection,
  sanitizeSection,
  nextSectionId,
  nextSectionOrder,
} from "../utils/validate.js";
import { requireApiKey } from "../middleware/auth.js";

const router = Router();

// POST /api/sections  - create a new section
router.post("/", requireApiKey, async (req, res, next) => {
  try {
    validateSection(req.body);
    const { name } = sanitizeSection(req.body);

    const { json, sha } = await readTestCasesFile();
    if (json.sections.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: "Section name already exists" });
    }

    const now = new Date().toISOString();
    const section = {
      id: nextSectionId(json.sections),
      name,
      order: nextSectionOrder(json.sections),
      createdAt: now,
    };
    json.sections.push(section);
    json.updatedAt = now;

    await writeTestCasesFile(
      json,
      sha,
      `feat(qa): add section "${section.name}"`
    );
    res.status(201).json(section);
  } catch (e) {
    next(e);
  }
});

// PUT /api/sections/:id  - rename a section
router.put("/:id", requireApiKey, async (req, res, next) => {
  try {
    validateSection(req.body);
    const { name } = sanitizeSection(req.body);

    const { json, sha } = await readTestCasesFile();
    const idx = json.sections.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const now = new Date().toISOString();
    const existing = json.sections[idx];
    json.sections[idx] = { ...existing, name };
    json.updatedAt = now;

    await writeTestCasesFile(
      json,
      sha,
      `chore(qa): rename section ${existing.id} to "${name}"`
    );
    res.json(json.sections[idx]);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/sections/:id  - delete a section and all its test cases
router.delete("/:id", requireApiKey, async (req, res, next) => {
  try {
    const { json, sha } = await readTestCasesFile();
    const idx = json.sections.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const [removed] = json.sections.splice(idx, 1);
    const before = json.testCases.length;
    json.testCases = json.testCases.filter(
      (t) => t.sectionId !== req.params.id
    );
    const removedCount = before - json.testCases.length;
    json.updatedAt = new Date().toISOString();

    await writeTestCasesFile(
      json,
      sha,
      `chore(qa): delete section "${removed.name}" (${removedCount} test case${removedCount === 1 ? "" : "s"})`
    );
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
