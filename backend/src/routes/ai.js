import { Router } from "express";
import { fetchIssue } from "../services/jira.js";
import {
  draftTestCaseFromIssue,
  draftTestCaseFromIssues,
  draftDocSectionFromSource,
  isAiConfigured,
} from "../services/ai.js";
import { requireApiKey } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/ai/config
 * Public - the frontend uses this to decide whether to show the
 * "Generate from JIRA" button and the per-row "Run Automation" link.
 * Never returns secrets - only booleans and the public Actions URL template.
 */
router.get("/config", (_req, res) => {
  res.json({
    aiEnabled: isAiConfigured(),
    jiraEnabled: Boolean(
      process.env.JIRA_BASE_URL &&
        process.env.JIRA_EMAIL &&
        process.env.JIRA_API_TOKEN
    ),
    automationUrl: process.env.AUTOMATION_ACTIONS_URL || "",
  });
});

/**
 * POST /api/ai/generate-from-jira
 * Body: { jiraUrl: string, sectionId?: string }
 * Returns: { issue, draft } where draft matches the "Add Test Case" form shape.
 */
router.post("/generate-from-jira", requireApiKey, async (req, res, next) => {
  try {
    const jiraUrl = String(req.body?.jiraUrl || "").trim();
    if (!jiraUrl) {
      return res.status(400).json({ error: "jiraUrl is required" });
    }
    const issue = await fetchIssue(jiraUrl);
    const draft = await draftTestCaseFromIssue(issue);
    res.json({ issue, draft });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/ai/generate-from-tickets
 * Body: { keys: string[] }  (JIRA keys or full URLs)
 * Returns: { issues, draft } — a single test case draft covering the union
 * of the provided tickets. The frontend pre-fills the "Add Test Case" modal
 * with the draft and the linked source keys.
 */
router.post("/generate-from-tickets", requireApiKey, async (req, res, next) => {
  try {
    const raw = Array.isArray(req.body?.keys) ? req.body.keys : [];
    const inputs = raw.map((x) => String(x || "").trim()).filter(Boolean);
    if (!inputs.length) {
      return res.status(400).json({ error: "keys is required (array)" });
    }
    if (inputs.length > 8) {
      return res
        .status(400)
        .json({ error: "Too many tickets — please pick at most 8." });
    }
    const issues = [];
    for (const input of inputs) {
      issues.push(await fetchIssue(input));
    }
    const draft = await draftTestCaseFromIssues(issues);
    res.json({ issues, draft });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/ai/generate-doc-section
 * Body: { url?: string, text?: string, hint?: string }
 *
 * Fetches the source URL (or uses the raw pasted `text`), asks Gemini to
 * produce an HTML draft of a documentation section, and returns
 * `{ draft: { title, content } }`. The caller is responsible for creating
 * the actual section via POST /api/docs/sections with `isDraft: true`.
 */
router.post("/generate-doc-section", requireApiKey, async (req, res, next) => {
  try {
    const url = String(req.body?.url || "").trim();
    const text = String(req.body?.text || "").trim();
    const hint = String(req.body?.hint || "").trim();
    if (!url && !text) {
      return res
        .status(400)
        .json({ error: "Provide a source URL or pasted text." });
    }
    const draft = await draftDocSectionFromSource({
      sourceUrl: url,
      sourceText: text,
      hint,
    });
    res.json({ draft });
  } catch (e) {
    next(e);
  }
});

export default router;
