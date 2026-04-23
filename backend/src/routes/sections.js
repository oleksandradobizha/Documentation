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
  validateParentPointer,
  UNDEFINED_SECTION_ID,
} from "../utils/validate.js";
import { requireApiKey } from "../middleware/auth.js";

const router = Router();

// POST /api/sections  - create a new section (optionally nested)
router.post("/", requireApiKey, async (req, res, next) => {
  try {
    validateSection(req.body);
    const clean = sanitizeSection(req.body);

    const { json, sha } = await readTestCasesFile();
    const parentId = clean.parentId || null;

    // Validate parent relationship (existence + depth)
    validateParentPointer(parentId, json.sections);

    // Duplicate name check scoped to the same parent.
    if (
      json.sections.some(
        (s) =>
          (s.parentId || null) === parentId &&
          s.name.toLowerCase() === clean.name.toLowerCase()
      )
    ) {
      return res.status(409).json({ error: "Section name already exists" });
    }

    const now = new Date().toISOString();
    const section = {
      id: nextSectionId(json.sections),
      name: clean.name,
      parentId,
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

// PUT /api/sections/:id  - rename and/or reparent a section
router.put("/:id", requireApiKey, async (req, res, next) => {
  try {
    validateSection(req.body);
    const clean = sanitizeSection(req.body);

    const { json, sha } = await readTestCasesFile();
    const idx = json.sections.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    if (req.params.id === UNDEFINED_SECTION_ID) {
      return res
        .status(400)
        .json({ error: "The Undefined section cannot be renamed or moved" });
    }

    const existing = json.sections[idx];
    const newParentId = Object.prototype.hasOwnProperty.call(clean, "parentId")
      ? clean.parentId || null
      : existing.parentId || null;

    validateParentPointer(newParentId, json.sections, existing.id);

    // Duplicate name check among siblings under the target parent.
    if (
      json.sections.some(
        (s) =>
          s.id !== existing.id &&
          (s.parentId || null) === newParentId &&
          s.name.toLowerCase() === clean.name.toLowerCase()
      )
    ) {
      return res.status(409).json({ error: "Section name already exists" });
    }

    const now = new Date().toISOString();
    json.sections[idx] = {
      ...existing,
      name: clean.name,
      parentId: newParentId,
    };
    json.updatedAt = now;

    await writeTestCasesFile(
      json,
      sha,
      `chore(qa): update section ${existing.id} "${clean.name}"`
    );
    res.json(json.sections[idx]);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/sections/:id  - delete a section; descendants and their test
// cases are moved to the Undefined section (never destructively removed).
router.delete("/:id", requireApiKey, async (req, res, next) => {
  try {
    if (req.params.id === UNDEFINED_SECTION_ID) {
      return res
        .status(400)
        .json({ error: "The Undefined section cannot be deleted" });
    }
    const { json, sha } = await readTestCasesFile();
    const idx = json.sections.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    // Collect the id + all descendants so we can remove them together.
    const toRemove = new Set([req.params.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of json.sections) {
        if (!toRemove.has(s.id) && s.parentId && toRemove.has(s.parentId)) {
          toRemove.add(s.id);
          grew = true;
        }
      }
    }

    const removed = json.sections.filter((s) => toRemove.has(s.id));
    json.sections = json.sections.filter((s) => !toRemove.has(s.id));

    // Move test cases from removed sections into Undefined.
    let moved = 0;
    for (const tc of json.testCases) {
      if (toRemove.has(tc.sectionId)) {
        tc.sectionId = UNDEFINED_SECTION_ID;
        moved += 1;
      }
    }
    json.updatedAt = new Date().toISOString();

    await writeTestCasesFile(
      json,
      sha,
      `chore(qa): delete section "${removed[0].name}" (moved ${moved} test case${
        moved === 1 ? "" : "s"
      } to Undefined)`
    );
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
