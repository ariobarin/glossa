import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { marked } from "marked";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDirectory = join(repositoryRoot, "site", "docs");
const checkOnly = process.argv.includes("--check");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function findMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findMarkdownFiles(path));
    } else if (extname(entry.name) === ".md") {
      files.push(path);
    }
  }

  return files.sort();
}

function readPage(source, sourcePath) {
  const lines = source.replaceAll("\r\n", "\n").trim().split("\n");
  const titleLine = lines.findIndex((line) => line.startsWith("# "));
  if (titleLine === -1) {
    throw new Error(`${sourcePath} needs a level-one heading`);
  }

  const summaryLine = lines.findIndex(
    (line, index) => index > titleLine && line.trim() !== "",
  );
  if (summaryLine === -1 || lines[summaryLine].startsWith("#")) {
    throw new Error(`${sourcePath} needs a summary after its title`);
  }

  return {
    title: lines[titleLine].slice(2).trim(),
    summary: lines[summaryLine].trim(),
    body: lines.filter((_, index) => index !== titleLine && index !== summaryLine).join("\n").trim(),
  };
}

function addCopyButtons(html, slug) {
  let index = 0;

  return html.replace(
    /<pre><code(?: class="([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_, className, code) => {
      index += 1;
      const id = `${slug.replaceAll("/", "-")}-code-${index}`;
      const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";
      return `<div class="code-block">
  <button class="copy-button" type="button" data-copy-target="${id}" aria-label="Copy code">
    <span class="copy-tooltip" aria-hidden="true">Copy</span>
  </button>
  <pre><code${classAttribute} id="${id}">${code}</code></pre>
</div>`;
    },
  );
}

function slugifyHeading(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addHeadingIds(html) {
  const usedIds = new Map();

  return html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, level, content) => {
    const baseId = slugifyHeading(content) || "section";
    const count = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
    return `<h${level} id="${id}"><a class="heading-anchor" href="#${id}" aria-label="Link to ${escapeHtml(content.replace(/<[^>]+>/g, ""))}"></a>${content}</h${level}>`;
  });
}

function renderAudienceSwitchers(source) {
  const replacements = new Map();
  let index = 0;
  const prepared = source.replace(
    /<!-- audience-switcher:start -->([\s\S]*?)<!-- audience-switcher:end -->/g,
    (_, content) => {
      const personalMarker = "<!-- audience:personal -->";
      const workspaceMarker = "<!-- audience:workspace -->";
      const personalStart = content.indexOf(personalMarker);
      const workspaceStart = content.indexOf(workspaceMarker);

      if (personalStart === -1 || workspaceStart === -1 || workspaceStart < personalStart) {
        throw new Error("Audience switchers need personal and workspace sections");
      }

      index += 1;
      const token = `audience-switcher-${index}`;
      const personal = content
        .slice(personalStart + personalMarker.length, workspaceStart)
        .trim();
      const workspace = content
        .slice(workspaceStart + workspaceMarker.length)
        .trim();
      const personalId = `${token}-personal`;
      const workspaceId = `${token}-workspace`;

      replacements.set(token, `<div class="audience-switcher" data-audience-switcher>
  <p class="audience-prompt">Which ChatGPT setup are you using?</p>
  <div class="audience-tabs" role="tablist" aria-label="ChatGPT setup">
    <button id="${personalId}-tab" type="button" role="tab" aria-selected="true" aria-controls="${personalId}" data-audience-tab="personal">Personal</button>
    <button id="${workspaceId}-tab" type="button" role="tab" aria-selected="false" aria-controls="${workspaceId}" data-audience-tab="workspace" tabindex="-1">Workspace</button>
  </div>
  <div id="${personalId}" class="audience-panel" role="tabpanel" aria-labelledby="${personalId}-tab" data-audience-panel="personal">
${marked.parse(personal, { gfm: true })}  </div>
  <div id="${workspaceId}" class="audience-panel" role="tabpanel" aria-labelledby="${workspaceId}-tab" data-audience-panel="workspace" hidden>
${marked.parse(workspace, { gfm: true })}  </div>
</div>`);

      return `<doc-audience-placeholder data-id="${token}"></doc-audience-placeholder>`;
    },
  );

  let html = marked.parse(prepared, { gfm: true });
  for (const [token, replacement] of replacements) {
    const placeholder = `<doc-audience-placeholder data-id="${token}"></doc-audience-placeholder>`;
    html = html.replace(`<p>${placeholder}</p>`, replacement);
  }

  return html;
}

function groupSections(html) {
  const parts = html.split(/(?=<h2 id=")/);
  return parts.map((part) => (
    part.startsWith("<h2") ? `<section class="doc-section">\n${part}</section>` : part
  )).join("");
}

function renderSectionNavigation(html) {
  const headings = [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)];
  if (headings.length < 2) return "";

  const links = headings.map(([, id, label]) => (
    `          <li><a href="#${id}">${label.replace(/<[^>]+>/g, "")}</a></li>`
  )).join("\n");

  return `      <nav class="docs-toc" aria-label="On this page">
        <strong>On this page</strong>
        <ol>
${links}
        </ol>
      </nav>`;
}

function renderDocsSidebar(slug) {
  const groups = [
    {
      title: "Getting started",
      links: [{ slug: "quickstart", label: "Quickstart" }],
    },
    {
      title: "Learn",
      links: [{ slug: "why", label: "Why Glossa" }],
    },
    {
      title: "Safety",
      links: [{ slug: "security", label: "Security model" }],
    },
  ];

  const contents = groups.map(({ title, links }) => {
    const items = links.map(({ slug: linkSlug, label }) => {
      const current = slug === linkSlug;
      return `          <li><a${current ? " class=\"is-current\" aria-current=\"page\"" : ""} href="/docs/${linkSlug}">${label}</a></li>`;
    }).join("\n");
    return `        <section>
          <h2>${title}</h2>
          <ul>
${items}
          </ul>
        </section>`;
  }).join("\n");

  return `      <nav class="docs-sidebar" aria-label="Documentation">
${contents}
      </nav>`;
}

function renderPage(page, slug) {
  const renderedTitle = escapeHtml(page.title);
  const tabTitle = slug
    .split("/")
    .at(-1)
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  const renderedBody = addHeadingIds(addCopyButtons(renderAudienceSwitchers(page.body), slug));
  const body = groupSections(renderedBody);
  const sectionNavigation = renderSectionNavigation(renderedBody);
  const sidebar = renderDocsSidebar(slug);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeHtml(page.summary)}" />
    <meta name="theme-color" content="#111016" />
    <title>${escapeHtml(tabTitle)} | Glossa</title>
    <link rel="icon" href="/glossa-symbol.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/styles.css?v=37" />
    <script src="/copy.js?v=4" defer></script>
  </head>
  <body class="docs-shell">
    <!-- Generated from ${slug}.md. Run npm run docs:build after editing Markdown. -->
    <header class="site-header page-width">
      <a class="brand" href="/" aria-label="Glossa home">
        <img class="brand-symbol" src="/glossa-symbol.svg" alt="" />
        <span>Glossa</span>
      </a>
      <nav class="header-links" aria-label="Site navigation">
        <a href="/docs/quickstart">Quickstart</a>
        <a href="/security">Security</a>
        <a href="/support">Support</a>
        <a href="https://github.com/ariobarin/glossa">GitHub</a>
      </nav>
    </header>

    <main class="docs-main">
      <div class="docs-layout${sectionNavigation ? " has-toc" : ""}">
${sidebar}
      <header class="docs-intro">
        <div class="docs-kicker">Glossa documentation</div>
        <div class="docs-title-row">
          <h1>${renderedTitle}</h1>
          <button class="copy-page-button" type="button" data-copy-page aria-label="Copy page link">Copy page</button>
        </div>
        <p class="docs-summary">${marked.parseInline(page.summary)}</p>
      </header>

${sectionNavigation}
      <article class="docs-content">
${body}
      </article>
      </div>
    </main>

    <footer class="site-footer">
      <div class="site-footer-inner page-width">
        <span>Need help? <a href="/support">Visit support.</a></span>
        <nav aria-label="Legal and support">
          <a href="/security">Security</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/support">Support</a>
        </nav>
      </div>
    </footer>
  </body>
</html>
`;
}

const markdownPages = (await findMarkdownFiles(docsDirectory)).map((sourcePath) => ({
  sourcePath,
  slug: relative(docsDirectory, sourcePath).replaceAll("\\", "/").slice(0, -3),
  outputPath: sourcePath.slice(0, -3) + ".html",
}));

markdownPages.push({
  sourcePath: join(repositoryRoot, "docs", "security.md"),
  slug: "security",
  outputPath: join(docsDirectory, "security.html"),
});

const stalePages = [];

for (const { sourcePath, slug, outputPath } of markdownPages) {
  const source = await readFile(sourcePath, "utf8");
  const page = readPage(source, sourcePath);
  const output = renderPage(page, slug);

  if (checkOnly) {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current.replaceAll("\r\n", "\n") !== output) {
      stalePages.push(relative(repositoryRoot, sourcePath).replaceAll("\\", "/"));
    }
  } else {
    await writeFile(outputPath, output, "utf8");
  }
}

if (stalePages.length > 0) {
  throw new Error(`Generated docs are stale: ${stalePages.join(", ")}. Run npm run docs:build.`);
}

console.log(`${checkOnly ? "Checked" : "Built"} ${markdownPages.length} documentation page${markdownPages.length === 1 ? "" : "s"}.`);
