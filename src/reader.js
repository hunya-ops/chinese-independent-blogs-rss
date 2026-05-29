import sanitizeHtml from "sanitize-html";
import { CONFIG } from "./config.js";
import { compactText, itemKey, truncate } from "./utils.js";

const CONTENT_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

function cleanContent(value) {
  return sanitizeHtml(String(value ?? ""), {
    allowedTags: CONTENT_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding", "referrerpolicy"],
      "*": ["title"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform(
        "a",
        { target: "_blank", rel: "noopener noreferrer" },
        true,
      ),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: "lazy",
          decoding: "async",
          referrerpolicy: "no-referrer",
        },
      }),
    },
  }).trim();
}

function toPlainText(value) {
  return compactText(
    sanitizeHtml(String(value ?? ""), {
      allowedTags: [],
      allowedAttributes: {},
    }),
  );
}

function serializeForScript(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function safeWebUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") return url.href;
  } catch {
    return "";
  }

  return "";
}

export function buildReaderItems(items) {
  return items.map((item) => {
    const contentHtml = cleanContent(item.content);
    const summarySource = contentHtml || item.content || item.title;

    return {
      id: itemKey(item),
      title: item.title || "(untitled)",
      link: safeWebUrl(item.link),
      publishedAt: item.publishedAt,
      author: item.author,
      sourceTitle: item.sourceTitle,
      sourceUrl: safeWebUrl(item.sourceUrl),
      feedUrl: safeWebUrl(item.feedUrl),
      tags: item.tags,
      summary: truncate(toPlainText(summarySource), 220),
      contentHtml,
    };
  });
}

export function buildReaderHtml(readerItems, status) {
  const siteUrl = CONFIG.publicBaseUrl.replace(/\/$/, "");
  const data = serializeForScript({
    items: readerItems,
    status: {
      updatedAt: status.updatedAt,
      summary: status.summary,
    },
  });

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>中文独立博客聚合</title>
  <link rel="alternate" type="application/rss+xml" title="中文独立博客聚合" href="${siteUrl}/all.xml">
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f6f8;
      --panel: #ffffff;
      --panel-soft: #f8fafc;
      --line: #d7dde5;
      --line-strong: #b9c3cf;
      --text: #172033;
      --muted: #607086;
      --muted-soft: #8491a3;
      --accent: #2563eb;
      --accent-soft: #e7efff;
      --success: #14855f;
      --shadow: 0 12px 24px rgba(23, 32, 51, 0.08);
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      height: 100%;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 15px;
      letter-spacing: 0;
    }

    a {
      color: var(--accent);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    button,
    input {
      font: inherit;
      letter-spacing: 0;
    }

    .topbar {
      height: 54px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 0 18px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }

    .brand {
      min-width: 0;
      font-size: 17px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }

    .reader-shell {
      height: calc(100dvh - 54px);
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(310px, 390px) minmax(0, 1fr);
    }

    .sidebar {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      border-right: 1px solid var(--line);
      background: var(--panel-soft);
    }

    .sidebar-controls {
      padding: 14px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }

    .search-input {
      width: 100%;
      height: 38px;
      padding: 0 12px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: #ffffff;
      color: var(--text);
      outline: none;
    }

    .search-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }

    .filters {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-top: 10px;
    }

    .filter-button {
      height: 32px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #ffffff;
      color: var(--muted);
      cursor: pointer;
    }

    .filter-button.active {
      border-color: var(--accent);
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 650;
    }

    .stats-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 14px;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
      background: #f9fbfd;
    }

    .item-list {
      min-height: 0;
      overflow: auto;
    }

    .item-row {
      width: 100%;
      min-height: 96px;
      display: block;
      padding: 12px 14px 11px 18px;
      border: 0;
      border-bottom: 1px solid var(--line);
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .item-row:hover {
      background: #eef4fb;
    }

    .item-row.active {
      background: #ffffff;
      box-shadow: inset 3px 0 0 var(--accent);
    }

    .item-row.read .item-title {
      color: #566273;
      font-weight: 500;
    }

    .item-source-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
      margin-bottom: 5px;
      color: var(--muted);
      font-size: 12px;
    }

    .item-source {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .item-date {
      flex: 0 0 auto;
      color: var(--muted-soft);
    }

    .item-title {
      display: -webkit-box;
      min-height: 40px;
      overflow: hidden;
      color: var(--text);
      font-weight: 700;
      line-height: 1.35;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .item-summary {
      display: -webkit-box;
      margin-top: 5px;
      overflow: hidden;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.35;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .unread-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--success);
      flex: 0 0 auto;
    }

    .item-row.read .unread-dot {
      background: transparent;
    }

    .article-pane {
      min-width: 0;
      min-height: 0;
      overflow: auto;
      background: var(--panel);
    }

    .article {
      max-width: 900px;
      margin: 0 auto;
      padding: 34px 38px 72px;
    }

    .article-kicker {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }

    .article-title {
      margin: 10px 0 12px;
      color: var(--text);
      font-size: 30px;
      line-height: 1.25;
      font-weight: 760;
    }

    .article-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 18px 0 24px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--line);
    }

    .action-link,
    .action-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 0 12px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: #ffffff;
      color: var(--text);
      cursor: pointer;
    }

    .action-link.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: #ffffff;
    }

    .article-content {
      color: #202838;
      font-size: 17px;
      line-height: 1.78;
      overflow-wrap: anywhere;
    }

    .article-content p,
    .article-content ul,
    .article-content ol,
    .article-content blockquote,
    .article-content pre,
    .article-content table {
      margin: 0 0 1.1em;
    }

    .article-content img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      box-shadow: var(--shadow);
    }

    .article-content pre {
      overflow: auto;
      padding: 14px;
      border-radius: 6px;
      background: #111827;
      color: #e5e7eb;
      line-height: 1.55;
    }

    .article-content code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.92em;
    }

    .article-content blockquote {
      padding-left: 16px;
      border-left: 4px solid var(--line-strong);
      color: #465366;
    }

    .article-content table {
      width: 100%;
      border-collapse: collapse;
      font-size: 15px;
    }

    .article-content th,
    .article-content td {
      padding: 8px;
      border: 1px solid var(--line);
      vertical-align: top;
    }

    .empty-state {
      color: var(--muted);
      padding: 24px;
      text-align: center;
    }

    @media (max-width: 840px) {
      .topbar {
        height: auto;
        min-height: 58px;
        align-items: flex-start;
        flex-direction: column;
        padding: 10px 14px;
        gap: 6px;
      }

      .top-actions {
        width: 100%;
        overflow-x: auto;
      }

      .reader-shell {
        height: calc(100dvh - 86px);
        grid-template-columns: 1fr;
        grid-template-rows: minmax(260px, 42dvh) minmax(0, 1fr);
      }

      .sidebar {
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      .article {
        padding: 24px 18px 56px;
      }

      .article-title {
        font-size: 24px;
      }

      .article-content {
        font-size: 16px;
      }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">中文独立博客聚合</div>
    <nav class="top-actions" aria-label="输出">
      <span id="updated-at"></span>
      <a href="all.xml">RSS</a>
      <a href="feeds.opml">OPML</a>
      <a href="status.json">Status</a>
    </nav>
  </header>
  <div class="reader-shell">
    <aside class="sidebar">
      <div class="sidebar-controls">
        <input id="search" class="search-input" type="search" autocomplete="off" placeholder="搜索文章或博客">
        <div class="filters" role="tablist" aria-label="阅读状态">
          <button class="filter-button active" type="button" data-filter="all">全部</button>
          <button class="filter-button" type="button" data-filter="unread">未读</button>
          <button class="filter-button" type="button" data-filter="read">已读</button>
        </div>
      </div>
      <div class="stats-row">
        <span id="visible-count"></span>
        <span id="unread-count"></span>
      </div>
      <div id="item-list" class="item-list" role="listbox" aria-label="文章列表"></div>
    </aside>
    <main class="article-pane" id="article-pane">
      <article class="article">
        <div id="article-kicker" class="article-kicker"></div>
        <h1 id="article-title" class="article-title"></h1>
        <div class="article-actions">
          <a id="open-original" class="action-link primary" target="_blank" rel="noopener noreferrer">打开原文</a>
          <button id="toggle-read" class="action-button" type="button">标记未读</button>
        </div>
        <div id="article-content" class="article-content"></div>
      </article>
    </main>
  </div>
  <script type="application/json" id="reader-data">${data}</script>
  <script>
    const payload = JSON.parse(document.getElementById("reader-data").textContent);
    const items = payload.items;
    const status = payload.status;
    const readKey = "cibr:read-items";
    const readItems = new Set(JSON.parse(localStorage.getItem(readKey) || "[]"));
    const byId = new Map(items.map((item) => [item.id, item]));

    let activeId = decodeURIComponent(location.hash.slice(1)) || items[0]?.id || "";
    let filter = "all";
    let query = "";

    const list = document.getElementById("item-list");
    const search = document.getElementById("search");
    const visibleCount = document.getElementById("visible-count");
    const unreadCount = document.getElementById("unread-count");
    const updatedAt = document.getElementById("updated-at");
    const articlePane = document.getElementById("article-pane");
    const articleKicker = document.getElementById("article-kicker");
    const articleTitle = document.getElementById("article-title");
    const articleContent = document.getElementById("article-content");
    const openOriginal = document.getElementById("open-original");
    const toggleRead = document.getElementById("toggle-read");

    function persistReadItems() {
      localStorage.setItem(readKey, JSON.stringify([...readItems].slice(-5000)));
    }

    function formatDate(value, options) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("zh-CN", options).format(date);
    }

    function visibleItems() {
      const q = query.trim().toLowerCase();
      return items.filter((item) => {
        const isRead = readItems.has(item.id);
        if (filter === "read" && !isRead) return false;
        if (filter === "unread" && isRead) return false;
        if (!q) return true;
        return [
          item.title,
          item.sourceTitle,
          item.author,
          item.summary,
          ...(item.tags || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
    }

    function renderStats(visible) {
      visibleCount.textContent = visible.length + " 篇";
      unreadCount.textContent = (items.length - readItems.size) + " 未读";
      updatedAt.textContent = status.updatedAt
        ? "更新 " + formatDate(status.updatedAt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "";
    }

    function renderList() {
      const visible = visibleItems();
      const fragment = document.createDocumentFragment();

      for (const item of visible) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "item-row";
        row.dataset.id = item.id;
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", item.id === activeId ? "true" : "false");
        if (item.id === activeId) row.classList.add("active");
        if (readItems.has(item.id)) row.classList.add("read");

        const sourceLine = document.createElement("div");
        sourceLine.className = "item-source-line";

        const source = document.createElement("span");
        source.className = "item-source";
        const dot = document.createElement("span");
        dot.className = "unread-dot";
        source.append(dot, " ", item.sourceTitle || "Unknown");

        const date = document.createElement("span");
        date.className = "item-date";
        date.textContent = formatDate(item.publishedAt, { month: "2-digit", day: "2-digit" });

        const title = document.createElement("div");
        title.className = "item-title";
        title.textContent = item.title;

        const summary = document.createElement("div");
        summary.className = "item-summary";
        summary.textContent = item.summary;

        sourceLine.append(source, date);
        row.append(sourceLine, title, summary);
        fragment.append(row);
      }

      list.replaceChildren(fragment);
      renderStats(visible);

      if (!byId.has(activeId) && visible[0]) {
        selectItem(visible[0].id, false);
      } else if (visible.length === 0) {
        articleKicker.textContent = "";
        articleTitle.textContent = "没有可显示的文章";
        articleContent.innerHTML = '<p class="empty-state">调整搜索或阅读状态。</p>';
        openOriginal.removeAttribute("href");
      }
    }

    function appendKickerPart(node) {
      if (articleKicker.childNodes.length > 0) {
        articleKicker.append(document.createTextNode(" / "));
      }
      articleKicker.append(node);
    }

    function renderArticle(item) {
      const published = formatDate(item.publishedAt, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      articleKicker.replaceChildren();
      if (item.sourceUrl) {
        const sourceLink = document.createElement("a");
        sourceLink.href = item.sourceUrl;
        sourceLink.target = "_blank";
        sourceLink.rel = "noopener noreferrer";
        sourceLink.textContent = item.sourceTitle || "Unknown";
        appendKickerPart(sourceLink);
      } else if (item.sourceTitle) {
        appendKickerPart(document.createTextNode(item.sourceTitle));
      }
      if (item.author) appendKickerPart(document.createTextNode(item.author));
      if (published) appendKickerPart(document.createTextNode(published));
      articleTitle.textContent = item.title;
      articleContent.innerHTML = item.contentHtml || '<p class="empty-state">这篇文章没有可显示的正文。</p>';
      openOriginal.href = item.link || item.sourceUrl || item.feedUrl;
      toggleRead.textContent = readItems.has(item.id) ? "标记未读" : "标记已读";
      articlePane.scrollTop = 0;
    }

    function selectItem(id, markRead = true) {
      const item = byId.get(id);
      if (!item) return;

      activeId = id;
      if (markRead) {
        readItems.add(id);
        persistReadItems();
      }

      history.replaceState(null, "", "#" + encodeURIComponent(id));
      renderArticle(item);
      renderList();
    }

    function moveSelection(delta) {
      const visible = visibleItems();
      const current = visible.findIndex((item) => item.id === activeId);
      const nextIndex = Math.min(Math.max(current + delta, 0), visible.length - 1);
      if (visible[nextIndex]) selectItem(visible[nextIndex].id);
    }

    list.addEventListener("click", (event) => {
      const row = event.target.closest(".item-row");
      if (row) selectItem(row.dataset.id);
    });

    search.addEventListener("input", () => {
      query = search.value;
      renderList();
    });

    for (const button of document.querySelectorAll(".filter-button")) {
      button.addEventListener("click", () => {
        filter = button.dataset.filter;
        document.querySelectorAll(".filter-button").forEach((item) => {
          item.classList.toggle("active", item === button);
        });
        renderList();
      });
    }

    toggleRead.addEventListener("click", () => {
      if (!activeId) return;
      if (readItems.has(activeId)) readItems.delete(activeId);
      else readItems.add(activeId);
      persistReadItems();
      renderArticle(byId.get(activeId));
      renderList();
    });

    document.addEventListener("keydown", (event) => {
      if (event.target === search) return;
      if (event.key === "ArrowDown" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        moveSelection(1);
      }
      if (event.key === "ArrowUp" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        moveSelection(-1);
      }
    });

    if (items.length > 0) {
      selectItem(byId.has(activeId) ? activeId : items[0].id, false);
    } else {
      renderList();
    }
  </script>
</body>
</html>
`;
}
