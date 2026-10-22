import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mergedSelection,
  renderMergedContributions,
  replaceMergedContributions,
} from "./merged-contributions.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const login = "shuaiyafei";

// Every search explicitly excludes private repositories.
const query = `query {
  profile: user(login: "${login}") {
    repositories(privacy: PUBLIC, ownerAffiliations: [OWNER], first: 1) { totalCount }
  }
  all: search(query: "is:public is:pr author:${login}", type: ISSUE, first: 1) { issueCount }
  merged: search(query: "is:public is:pr is:merged author:${login}", type: ISSUE, first: 100) {
    ${mergedSelection}
  }
  open: search(query: "is:public is:pr is:open author:${login}", type: ISSUE, first: 1) { issueCount }
}`;

const themes = {
  dark: {
    bg: "#101820",
    fg: "#edf3f5",
    muted: "#a0afb9",
    soft: "#617381",
    accent: "#8ccfc9",
    line: "#2a3a47",
    glow: "#345d68",
  },
  light: {
    bg: "#f4f7f9",
    fg: "#172d3a",
    muted: "#526c7c",
    soft: "#78909d",
    accent: "#187c83",
    line: "#d7e1e6",
    glow: "#a8d5d6",
  },
};
const xml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );

function document(width, height, title, description, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${xml(title)}</title>
<desc id="desc">${xml(description)}</desc>
${body}
</svg>\n`;
}

function hero(theme, mobile) {
  const t = themes[theme];
  const w = mobile ? 640 : 1200;
  const h = mobile ? 430 : 300;
  const x = mobile ? 42 : 56;
  const subtitleY = mobile ? 148 : 130;
  const roleY = mobile ? 226 : 192;
  const font = mobile ? 26 : 24;
  const roles = [
    "AI agents. Practical by design.",
    "Developer tools. Built with care.",
    "Web experiences. Made to feel right.",
  ];
  const clips = roles
    .map(
      (_, i) => `<clipPath id="line-${i}">
  <rect x="${x}" y="${roleY - 35}" width="0" height="52">
    <animate attributeName="width" values="0;0;590;590;0;0" keyTimes="0;0.03;0.16;0.27;0.31;1" dur="18s" begin="${i * 6}s" repeatCount="indefinite"/>
  </rect>
</clipPath>`,
    )
    .join("\n");
  const roleText = roles
    .map(
      (text, i) =>
        `<text class="moving role" x="${x}" y="${roleY}" font-size="${font}" font-weight="450" fill="${t.accent}" clip-path="url(#line-${i})">${xml(text)}</text>`,
    )
    .join("\n");
  return document(
    w,
    h,
    "Software engineering — shuaiyafei",
    "Building practical AI agents, developer tools, and thoughtful web experiences. Rotating typed introductions.",
    `<defs>
  <radialGradient id="haze"><stop stop-color="${t.glow}" stop-opacity=".30"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="${t.line}" stroke-width=".7" opacity=".32"/></pattern>
  ${clips}
</defs>
<style>
  text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
  .mono { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; }
  .still { display: none; }
  @media (prefers-reduced-motion: reduce) {
    .moving { display: none; }
    .still { display: inline; }
  }
</style>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="22" fill="${t.bg}" stroke="${t.line}"/>
<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="22" fill="url(#grid)"/>
<ellipse cx="${mobile ? 535 : 1000}" cy="${mobile ? 100 : 150}" rx="310" ry="260" fill="url(#haze)"/>
<path d="M${x} ${mobile ? 67 : 55}h24" stroke="${t.accent}" stroke-width="2"/>
<text class="mono" x="${x + 38}" y="${mobile ? 72 : 60}" fill="${t.muted}" font-size="${mobile ? 17 : 13}" letter-spacing="2.5">SOFTWARE / OPEN SOURCE</text>
<text x="${x}" y="${subtitleY}" font-size="${mobile ? 28 : 30}" fill="${t.fg}">Software engineer. Curious by default.</text>
${roleText}
<text class="still" x="${x}" y="${roleY}" font-size="${font}" fill="${t.accent}">AI agents. Tools. Thoughtful interfaces.</text>
${
  mobile
    ? `<path d="M${x} 284H598" stroke="${t.line}"/>
<text x="${x}" y="330" font-size="22" fill="${t.fg}">Making complex things feel simple.</text>
<text class="mono" x="${x}" y="381" fill="${t.soft}" font-size="16" letter-spacing="1.1">BUILD / SHIP / REFINE</text>`
    : `<text class="mono" x="${x}" y="281" fill="${t.soft}" font-size="12" letter-spacing="2">BUILD / SHIP / REFINE</text>
<text x="752" y="281" fill="${t.soft}" font-size="13">Making complex things feel simple.</text>`
}`,
  );
}

function stats(theme, mobile, data, date) {
  const t = themes[theme];
  const values = [
    ["PUBLIC PRS", data.all.issueCount],
    ["MERGED PRS", data.merged.issueCount],
    ["OPEN PRS", data.open.issueCount],
    ["PUBLIC REPOS", data.profile.repositories.totalCount],
  ];
  for (const [, value] of values) {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error("Invalid public activity count");
  }
  const w = mobile ? 640 : 1200;
  const h = mobile ? 390 : 226;
  const cells = values
    .map(([label, value], i) => {
      const x = mobile ? 40 + (i % 2) * 298 : 48 + i * 290;
      const y = mobile ? 147 + Math.floor(i / 2) * 118 : 126;
      return `<text x="${x}" y="${y}" font-size="${mobile ? 52 : 46}" font-weight="600" letter-spacing="-2" fill="${t.fg}">${value}</text>
<text class="mono" x="${x + 1}" y="${y + 30}" font-size="${mobile ? 20 : 14}" letter-spacing="1.8" fill="${t.muted}">${label}</text>
${!mobile && i < 3 ? `<path d="M${x + 250} 84v80" stroke="${t.line}"/>` : ""}`;
    })
    .join("\n");
  const stamp = date.toISOString().slice(0, 16).replace("T", " ");
  return document(
    w,
    h,
    "Public GitHub activity",
    values.map(([name, value]) => `${name}: ${value}`).join(". ") +
      `. Refreshed ${stamp} UTC. GitHub search counts can lag new activity.`,
    `<style>text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}.mono{font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace}</style>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="18" fill="${t.bg}" stroke="${t.line}"/>
<circle cx="${mobile ? 46 : 53}" cy="42" r="4" fill="${t.accent}"/>
<text class="mono" x="${mobile ? 62 : 69}" y="47" font-size="${mobile ? 19 : 14}" letter-spacing="2" fill="${t.muted}">OPEN-SOURCE PULSE</text>
${cells}
<path d="M${mobile ? 40 : 48} ${h - 49}H${w - (mobile ? 40 : 48)}" stroke="${t.line}"/>
<text class="mono" x="${mobile ? 40 : 48}" y="${h - 23}" font-size="${mobile ? 16 : 12}" fill="${t.soft}">PUBLIC ACTIVITY · ${stamp} UTC</text>
${mobile ? "" : `<text class="mono" x="1152" y="${h - 23}" font-size="11" text-anchor="end" fill="${t.soft}">REFRESHED DAILY</text>`}`,
  );
}

async function publicData(query, variables) {
  const token = process.env.GITHUB_TOKEN;
  if (!token)
    throw new Error(
      "Use --input with complete public API data, or set GITHUB_TOKEN",
    );
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`GitHub public-data request failed (${response.status})`);
  const payload = await response.json();
  if (payload.errors?.length || !payload.data)
    throw new Error("Public GitHub data is unavailable");
  return payload;
}

async function main() {
  const queryFile = process.argv.indexOf("--query-file");
  if (queryFile !== -1) {
    await writeFile(process.argv[queryFile + 1], JSON.stringify({ query }));
    return;
  }
  const input = process.argv.indexOf("--input");
  let payload;
  if (input !== -1) {
    payload = JSON.parse(await readFile(process.argv[input + 1], "utf8"));
  } else {
    payload = await publicData(query);
  }
  if (payload.errors?.length || !payload.data?.profile)
    throw new Error("Public GitHub data is unavailable");
  let page = payload.data.merged;
  if (!Array.isArray(page?.nodes) || !page.pageInfo)
    throw new Error("Public merged pull-request details are unavailable");
  const merged = [...page.nodes];
  let pages = 1;
  while (page.pageInfo.hasNextPage) {
    if (input !== -1 || pages >= 10 || !page.pageInfo.endCursor)
      throw new Error("Merged pull-request history is incomplete");
    const next = await publicData(
      `query($cursor: String!) {
        merged: search(query: "is:public is:pr is:merged author:${login}", type: ISSUE, first: 100, after: $cursor) {
          ${mergedSelection}
        }
      }`,
      { cursor: page.pageInfo.endCursor },
    );
    page = next.data.merged;
    if (!Array.isArray(page?.nodes) || !page.pageInfo)
      throw new Error("Public merged pull-request details are unavailable");
    merged.push(...page.nodes);
    pages += 1;
  }
  const contributions = renderMergedContributions(merged, login);
  const readme = await readFile(resolve(root, "README.md"), "utf8");
  const preview = replaceMergedContributions(readme, contributions);
  const date = new Date();
  await mkdir(resolve(root, "assets"), { recursive: true });
  await mkdir(resolve(root, ".generated"), { recursive: true });
  await writeFile(
    resolve(root, ".generated", "merged-contributions.md"),
    contributions + "\n",
  );
  await writeFile(resolve(root, ".generated", "README.preview.md"), preview);
  for (const theme of ["dark", "light"]) {
    for (const mobile of [false, true]) {
      const suffix = `${mobile ? "mobile-" : ""}${theme}.svg`;
      await writeFile(
        resolve(root, "assets", `hero-${suffix}`),
        hero(theme, mobile),
      );
      await writeFile(
        resolve(root, ".generated", `stats-${suffix}`),
        stats(theme, mobile, payload.data, date),
      );
    }
  }
  console.log(
    "Rendered four hero variants, four activity cards, and recent merged contributions.",
  );
}

await main();
