import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const branch = "profile-assets";
if (repository !== "shuaiyafei/shuaiyafei" || !token) {
  throw new Error(
    "Publishing is restricted to the profile repository's Actions environment",
  );
}

async function api(path, method = "GET", body, allowMissing = false) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (allowMissing && response.status === 404) return null;
  if (!response.ok)
    throw new Error(
      `Asset publication failed (${response.status} ${method} ${path})`,
    );
  return response.json();
}

const ref = await api(`/git/ref/heads/${branch}`, "GET", undefined, true);
const parentSha =
  ref?.object.sha ?? (await api("/git/ref/heads/main")).object.sha;
const parent = await api(`/git/commits/${parentSha}`);
const files = [
  "stats-dark.svg",
  "stats-light.svg",
  "stats-mobile-dark.svg",
  "stats-mobile-light.svg",
  "contributions-dark.svg",
  "contributions-light.svg",
];
const tree = await Promise.all(
  files.map(async (file) => {
    const content = await readFile(resolve(root, ".generated", file), "utf8");
    if (!content.includes("<svg"))
      throw new Error(`Missing SVG asset: ${file}`);
    return { path: `generated/${file}`, mode: "100644", type: "blob", content };
  }),
);
const nextTree = await api("/git/trees", "POST", {
  base_tree: parent.tree.sha,
  tree,
});
if (ref && nextTree.sha === parent.tree.sha) {
  console.log("Generated visuals are unchanged.");
} else {
  const commit = await api("/git/commits", "POST", {
    message: "chore(profile): refresh public activity visuals",
    tree: nextTree.sha,
    parents: [parentSha],
  });
  if (ref) {
    await api(`/git/refs/heads/${branch}`, "PATCH", {
      sha: commit.sha,
      force: false,
    });
  } else {
    await api("/git/refs", "POST", {
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    });
  }
  console.log("Published generated visuals to profile-assets.");
}
