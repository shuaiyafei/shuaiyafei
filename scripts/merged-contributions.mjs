export const mergedSelection = `
  issueCount
  pageInfo { hasNextPage endCursor }
  nodes {
    __typename
    ... on PullRequest {
      number title url merged mergedAt
      author { login }
      repository {
        nameWithOwner url isPrivate isFork
        owner { login }
      }
    }
  }
`;

const startMarker = "<!-- MERGED-PRS:START -->";
const endMarker = "<!-- MERGED-PRS:END -->";

function markdownText(value) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_[\]|]/g, "\\$&");
}

export function renderMergedContributions(nodes, login) {
  if (!Array.isArray(nodes)) {
    throw new Error("Public merged pull requests are unavailable");
  }
  const seen = new Set();
  const contributions = [];
  for (const pr of nodes) {
    const repo = pr.repository;
    if (
      pr.__typename !== "PullRequest" ||
      pr.merged !== true ||
      pr.author?.login !== login ||
      repo?.isPrivate !== false ||
      typeof repo.isFork !== "boolean" ||
      !Number.isSafeInteger(pr.number) ||
      pr.number < 1 ||
      typeof pr.title !== "string" ||
      typeof pr.mergedAt !== "string" ||
      !Number.isFinite(Date.parse(pr.mergedAt))
    ) {
      throw new Error("Refusing incomplete or non-public contribution data");
    }
    if (
      pr.url !== `https://github.com/${repo.nameWithOwner}/pull/${pr.number}` ||
      repo.url !== `https://github.com/${repo.nameWithOwner}`
    ) {
      throw new Error("Unexpected contribution URL");
    }
    if (repo.isFork || repo.owner.login.toLowerCase() === login.toLowerCase()) {
      continue;
    }
    if (!seen.has(pr.url)) {
      seen.add(pr.url);
      contributions.push(pr);
    }
  }
  contributions.sort(
    (a, b) =>
      Date.parse(b.mergedAt) - Date.parse(a.mergedAt) ||
      b.number - a.number ||
      a.url.localeCompare(b.url),
  );
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const rows = contributions.slice(0, 6).map(
    (pr) =>
      `| [${markdownText(pr.repository.nameWithOwner)}](${pr.repository.url}) | ` +
      `[${markdownText(`#${pr.number} · ${pr.title}`)}](${pr.url}) | ` +
      `${date.format(new Date(pr.mergedAt))} |`,
  );
  const allMerged = `https://github.com/pulls?q=${encodeURIComponent(
    `is:public is:pr is:merged author:${login} -user:${login}`,
  )}`;
  return [
    "### Recently merged",
    "",
    ...(rows.length
      ? [
          "| Project | Contribution | Merged |",
          "| :-- | :-- | :-- |",
          ...rows,
        ]
      : ["No public upstream pull requests have been merged yet."]),
    "",
    `<sub>Public upstream contributions · Dates in UTC+8 · Updated daily · <a href="${allMerged}">View all merged PRs ↗</a></sub>`,
  ].join("\n");
}

export function replaceMergedContributions(readme, content) {
  const start = readme.indexOf(startMarker);
  const end = readme.indexOf(endMarker);
  if (
    start < 0 ||
    end <= start ||
    start !== readme.lastIndexOf(startMarker) ||
    end !== readme.lastIndexOf(endMarker)
  ) {
    throw new Error("README must contain one ordered pair of MERGED-PRS markers");
  }
  return (
    readme.slice(0, start + startMarker.length) +
    `\n${content.trim()}\n` +
    readme.slice(end)
  );
}
