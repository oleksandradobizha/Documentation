/**
 * Thin JIRA Cloud client.
 *
 * Auth: Basic (email + API token). Credentials live in backend/.env:
 *   JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN
 *
 * Only the endpoints we need are implemented. Never expose these creds to the
 * frontend - the browser only ever sees the derived { key, summary, description }.
 */

const ISSUE_KEY_RE = /([A-Z][A-Z0-9_]+-\d+)/;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function jiraConfig() {
  const baseUrl = (process.env.JIRA_BASE_URL || "").replace(/\/+$/, "");
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!baseUrl || !email || !token) {
    throw httpError(
      500,
      "JIRA is not configured. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN in backend/.env."
    );
  }
  const authHeader =
    "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
  return { baseUrl, authHeader };
}

/**
 * Accepts either a raw issue key ("PROJ-123") or a full JIRA URL
 * ("https://foo.atlassian.net/browse/PROJ-123"). Returns the bare key.
 */
export function extractIssueKey(input) {
  if (!input || typeof input !== "string") return null;
  const match = input.match(ISSUE_KEY_RE);
  return match ? match[1] : null;
}

/**
 * Recursively flattens an Atlassian Document Format (ADF) node tree to plain
 * text. JIRA Cloud returns descriptions / comments in ADF.
 */
function adfToPlainText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfToPlainText).join("");
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  const children = Array.isArray(node.content)
    ? node.content.map(adfToPlainText).join("")
    : "";
  switch (node.type) {
    case "paragraph":
    case "heading":
      return children + "\n\n";
    case "bulletList":
    case "orderedList":
      return children + "\n";
    case "listItem":
      return "- " + children.trim() + "\n";
    case "codeBlock":
      return "\n" + children + "\n";
    default:
      return children;
  }
}

/**
 * Fetch an issue and return a compact, AI-friendly shape.
 */
export async function fetchIssue(keyOrUrl) {
  const key = extractIssueKey(keyOrUrl);
  if (!key) {
    throw httpError(
      400,
      "Could not find a JIRA issue key (e.g. PROJ-123) in the provided link."
    );
  }
  const { baseUrl, authHeader } = jiraConfig();
  const url = `${baseUrl}/rest/api/3/issue/${encodeURIComponent(
    key
  )}?fields=summary,description,issuetype,priority,status,labels,components`;

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw httpError(
      res.status,
      "JIRA rejected the credentials. Check JIRA_EMAIL / JIRA_API_TOKEN in backend/.env."
    );
  }
  if (res.status === 404) {
    throw httpError(404, `JIRA issue ${key} not found (or no access).`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw httpError(res.status, `JIRA error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const fields = data.fields || {};
  return {
    key: data.key || key,
    url: `${baseUrl}/browse/${data.key || key}`,
    summary: fields.summary || "",
    description: adfToPlainText(fields.description).trim(),
    issueType: fields.issuetype?.name || "",
    priority: fields.priority?.name || "",
    status: fields.status?.name || "",
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    components: Array.isArray(fields.components)
      ? fields.components.map((c) => c.name).filter(Boolean)
      : [],
  };
}

/**
 * Search JIRA with a JQL query. Returns a compact array of issue summaries
 * (no description, to keep the response small — callers fetchIssue() for the
 * full payload when they need to draft a test case).
 *
 * Uses the new /rest/api/3/search/jql endpoint (the legacy /rest/api/3/search
 * was removed by Atlassian — it now returns HTTP 410 Gone). The new API is
 * cursor-paginated (nextPageToken) and expects a JSON body on POST. See:
 * https://developer.atlassian.com/changelog/#CHANGE-20
 */
export async function searchIssues(jql, { maxResults = 50 } = {}) {
  const q = String(jql || "").trim();
  if (!q) {
    throw httpError(400, "A JQL query (or filter) is required.");
  }
  const { baseUrl, authHeader } = jiraConfig();

  const cap = Math.min(Math.max(1, Number(maxResults) || 50), 100);
  const FIELDS = ["summary", "issuetype", "priority", "status", "labels", "components"];

  const collected = [];
  let nextPageToken;
  // Page through results until we hit `cap` or JIRA says there's nothing more.
  // The new endpoint typically returns 50 issues per page and signals the end
  // via `isLast: true` or the absence of `nextPageToken`.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const remaining = cap - collected.length;
    if (remaining <= 0) break;

    const body = {
      jql: q,
      fields: FIELDS,
      maxResults: Math.min(remaining, 100),
    };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const res = await fetch(`${baseUrl}/rest/api/3/search/jql`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 400) {
      const txt = await res.text().catch(() => "");
      throw httpError(
        400,
        `JIRA rejected the query. Check your JQL syntax. ${txt.slice(0, 300)}`
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw httpError(
        res.status,
        "JIRA rejected the credentials. Check JIRA_EMAIL / JIRA_API_TOKEN in backend/.env."
      );
    }
    if (res.status === 410) {
      throw httpError(
        410,
        "JIRA returned 410 Gone for /rest/api/3/search/jql. Ensure the backend is up to date."
      );
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw httpError(res.status, `JIRA error ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json();
    const issues = Array.isArray(data.issues) ? data.issues : [];
    for (const i of issues) {
      collected.push(i);
      if (collected.length >= cap) break;
    }

    if (collected.length >= cap) break;
    if (data.isLast === true) break;
    if (!data.nextPageToken) break;
    nextPageToken = data.nextPageToken;
  }

  return collected.map((i) => {
    const f = i.fields || {};
    return {
      key: i.key,
      url: `${baseUrl}/browse/${i.key}`,
      summary: f.summary || "",
      issueType: f.issuetype?.name || "",
      priority: f.priority?.name || "",
      status: f.status?.name || "",
      labels: Array.isArray(f.labels) ? f.labels : [],
      components: Array.isArray(f.components)
        ? f.components.map((c) => c.name).filter(Boolean)
        : [],
    };
  });
}
