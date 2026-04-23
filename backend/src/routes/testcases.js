import { Router } from "express";
import {
  readTestCasesFile,
  writeTestCasesFile,
} from "../services/github.js";
import {
  validateTestCase,
  sanitizeTestCase,
  nextTestCaseId,
  UNDEFINED_SECTION_ID,
} from "../utils/validate.js";
import { requireApiKey } from "../middleware/auth.js";

const router = Router();

// GET /api/testcases  - returns entire document (sections + testCases)
router.get("/", async (_req, res, next) => {
  try {
    const { json } = await readTestCasesFile();
    res.json(json);
  } catch (e) {
    next(e);
  }
});

// POST /api/testcases  - create a test case inside a section
router.post("/", requireApiKey, async (req, res, next) => {
  try {
    validateTestCase(req.body);
    const clean = sanitizeTestCase(req.body);

    const { json, sha } = await readTestCasesFile();
    if (!json.sections.some((s) => s.id === clean.sectionId)) {
      // Fall back to the Undefined catch-all section instead of 400-ing.
      clean.sectionId = UNDEFINED_SECTION_ID;
    }

    const now = new Date().toISOString();
    const tc = {
      id: nextTestCaseId(json.testCases),
      ...clean,
      createdAt: now,
      updatedAt: now,
    };
    json.testCases.push(tc);
    json.updatedAt = now;

    await writeTestCasesFile(
      json,
      sha,
      `feat(qa): add ${tc.id} - ${tc.title}`
    );
    res.status(201).json(tc);
  } catch (e) {
    next(e);
  }
});

// PUT /api/testcases/:id  - update a test case (can move between sections)
router.put("/:id", requireApiKey, async (req, res, next) => {
  try {
    validateTestCase(req.body);
    const clean = sanitizeTestCase(req.body);

    const { json, sha } = await readTestCasesFile();
    const idx = json.testCases.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    if (!json.sections.some((s) => s.id === clean.sectionId)) {
      clean.sectionId = UNDEFINED_SECTION_ID;
    }

    const now = new Date().toISOString();
    const existing = json.testCases[idx];
    const updated = {
      ...existing,
      ...clean,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    json.testCases[idx] = updated;
    json.updatedAt = now;

    await writeTestCasesFile(
      json,
      sha,
      `chore(qa): update ${updated.id} - ${updated.title}`
    );
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/testcases/:id  - hard delete
router.delete("/:id", requireApiKey, async (req, res, next) => {
  try {
    const { json, sha } = await readTestCasesFile();
    const idx = json.testCases.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const [removed] = json.testCases.splice(idx, 1);
    json.updatedAt = new Date().toISOString();

    await writeTestCasesFile(
      json,
      sha,
      `chore(qa): delete ${removed.id} - ${removed.title}`
    );
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
