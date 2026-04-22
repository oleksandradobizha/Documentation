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

function cfg() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  const path = process.env.DATA_PATH || "data/testcases.json";
  if (!owner || !repo) {
    throw new Error("GITHUB_OWNER and GITHUB_REPO must be set");
  }
  return { owner, repo, branch, path };
}

export async function readTestCasesFile() {
  const { owner, repo, branch, path } = cfg();
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

export async function writeTestCasesFile(json, sha, message) {
  const { owner, repo, branch, path } = cfg();
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
