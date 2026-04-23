import { Octokit } from "@octokit/rest";

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

function testCasesPath() {
  return process.env.DATA_PATH || "data/testcases.json";
}

function docsPath() {
  return process.env.DOCS_PATH || "data/documentation.json";
}

function jiraPath() {
  return process.env.JIRA_PATH || "data/jiratickets.json";
}

async function readJsonFile(path) {
  const { owner, repo, branch } = repoCfg();
  const { data } = await octokit().repos.getContent({
    owner,
    repo,
    path,
    ref: branch,
  });
  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`Expected file at ${path}`);
  }
  const content = Buffer.from(data.content, "base64").toString("utf8");
  return { json: JSON.parse(content), sha: data.sha };
}

async function writeJsonFile(path, json, sha, message) {
  const { owner, repo, branch } = repoCfg();
  const content = Buffer.from(JSON.stringify(json, null, 2) + "\n").toString(
    "base64"
  );
  const { data } = await octokit().repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    branch,
    message,
    content,
    sha,
  });
  return data.content?.sha;
}

export async function readTestCasesFile() {
  return readJsonFile(testCasesPath());
}

export async function writeTestCasesFile(json, sha, message) {
  return writeJsonFile(testCasesPath(), json, sha, message);
}

export async function readDocsFile() {
  try {
    return await readJsonFile(docsPath());
  } catch (e) {
    // First run: file does not exist yet — return empty doc so the UI can start fresh.
    if (e?.status === 404) {
      return {
        json: {
          version: 1,
          updatedAt: new Date().toISOString(),
          sections: [],
        },
        sha: undefined,
      };
    }
    throw e;
  }
}

export async function writeDocsFile(json, sha, message) {
  return writeJsonFile(docsPath(), json, sha, message);
}

export async function readJiraFile() {
  try {
    return await readJsonFile(jiraPath());
  } catch (e) {
    if (e?.status === 404) {
      return {
        json: {
          version: 1,
          updatedAt: new Date().toISOString(),
          sections: [],
          tickets: [],
        },
        sha: undefined,
      };
    }
    throw e;
  }
}

export async function writeJiraFile(json, sha, message) {
  return writeJsonFile(jiraPath(), json, sha, message);
}
