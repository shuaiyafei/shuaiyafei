import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { replaceMergedContributions } from "./merged-contributions.mjs";

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

const contributions = await readFile(
  resolve(root, ".generated", "merged-contributions.md"),
  "utf8",
);
const mainRef = await api("/git/ref/heads/main");
const readme = await api(`/contents/README.md?ref=${mainRef.object.sha}`);
if (readme.type !== "file" || readme.encoding !== "base64") {
  throw new Error("Profile README is unavailable");
}
const currentReadme = Buffer.from(readme.content, "base64").toString("utf8");
const updatedReadme = replaceMergedContributions(currentReadme, contributions);
if (updatedReadme === currentReadme) {
  console.log("Merged contributions are unchanged; no README commit needed.");
} else {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) { commit { oid } }
      }`,
      variables: {
        input: {
          branch: { repositoryNameWithOwner: repository, branchName: "main" },
          expectedHeadOid: mainRef.object.sha,
          message: { headline: "chore(profile): refresh merged contributions" },
          fileChanges: {
            additions: [
              {
                path: "README.md",
                contents: Buffer.from(updatedReadme, "utf8").toString("base64"),
              },
            ],
          },
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`README publication failed (${response.status})`);
  const result = await response.json();
  if (result.errors?.length || !result.data?.createCommitOnBranch?.commit?.oid) {
    throw new Error(
      `README publication failed: ${
        result.errors?.map((error) => error.message).join("; ") ||
        "GitHub returned no commit"
      }`,
    );
  }
  console.log("Updated merged contributions in the profile README.");
}
