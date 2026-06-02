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
      contentQuality: item.contentQuality,
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
      --chrome: #f1f1f1;
      --chrome-dark: #e1e5ec;
      --panel: #ffffff;
      --sidebar: #f7f7f7;
      --line: #d5d9df;
      --line-strong: #b7bec8;
      --text: #222222;
      --muted: #666f7a;
      --muted-soft: #8a929d;
      --blue: #1d5f9f;
      --blue-soft: #e8f0fe;
      --orange: #d66b00;
      --green: #24875a;
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
      background: var(--panel);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      letter-spacing: 0;
    }

    a {
      color: var(--blue);
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
      height: 48px;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 0 16px;
      border-bottom: 1px solid #c8ccd2;
      background: linear-gradient(#f7f7f7, #e8ebef);
    }

    .brand {
      flex: 0 0 auto;
      display: flex;
      align-items: baseline;
      gap: 6px;
      width: 220px;
      color: #444444;
      font-size: 20px;
      font-weight: 400;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .brand strong {
      color: #111111;
      font-weight: 700;
    }

    .search-form {
      flex: 1 1 auto;
      min-width: 120px;
      max-width: 620px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .search-input {
      width: 100%;
      height: 28px;
      padding: 0 9px;
      border: 1px solid #aeb4bd;
      border-radius: 2px;
      background: #ffffff;
      color: var(--text);
      outline: none;
    }

    .search-input:focus {
      border-color: #6a8fc4;
      box-shadow: 0 0 0 2px rgba(29, 95, 159, 0.16);
    }

    .top-links {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .reader-shell {
      height: calc(100dvh - 48px);
      min-height: 0;
      display: grid;
      grid-template-columns: 254px minmax(0, 1fr);
    }

    .sidebar {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: auto auto auto auto minmax(0, 1fr);
      border-right: 1px solid var(--line);
      background: var(--sidebar);
    }

    .sidebar-top {
      padding: 12px 10px 10px;
      border-bottom: 1px solid var(--line);
    }

    .filter-section {
      padding: 8px 10px 7px;
      border-bottom: 1px solid var(--line);
    }

    .filter-heading {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 0 8px 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }

    .nav-item,
    .source-item,
    .tool-button {
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      text-align: left;
    }

    .nav-item {
      width: 100%;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0 8px;
      border-radius: 2px;
      color: #333333;
    }

    .nav-item.active,
    .source-item.active,
    .quality-item.active,
    .date-item.active {
      background: var(--blue-soft);
      color: #174d82;
      font-weight: 700;
    }

    .nav-count {
      color: var(--muted);
      font-size: 12px;
      font-weight: 400;
    }

    .quality-item,
    .date-item {
      width: 100%;
      height: 25px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0 8px;
      border: 0;
      border-radius: 2px;
      background: transparent;
      color: #394150;
      cursor: pointer;
      text-align: left;
    }

    .quality-label,
    .date-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sidebar-meta {
      padding: 9px 16px;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .source-section {
      min-height: 0;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
    }

    .section-title {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 16px 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .source-list {
      min-height: 0;
      overflow: auto;
      padding: 0 8px 12px;
    }

    .source-item {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      height: 24px;
      padding: 0 8px;
      border-radius: 2px;
      color: #394150;
    }

    .source-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .source-count {
      flex: 0 0 auto;
      color: var(--muted-soft);
      font-size: 11px;
    }

    .content {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      background: #ffffff;
    }

    .content-titlebar {
      min-height: 46px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 0 16px;
      border-bottom: 1px solid var(--line);
      background: #ffffff;
    }

    .view-title {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 18px;
      font-weight: 700;
    }

    .view-meta {
      flex: 0 0 auto;
      color: var(--muted);
      font-size: 12px;
    }

    .toolbar {
      min-height: 37px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 10px;
      border-bottom: 1px solid var(--line);
      background: var(--chrome);
    }

    .tool-button,
    .tool-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 26px;
      padding: 0 10px;
      border: 1px solid var(--line-strong);
      border-radius: 2px;
      background: linear-gradient(#ffffff, #f1f1f1);
      color: #333333;
      font-size: 12px;
      line-height: 1;
      text-decoration: none;
      white-space: nowrap;
    }

    .tool-button.active {
      border-color: #8caad2;
      background: #dceafe;
      color: #173f70;
      font-weight: 700;
    }

    .tool-button:disabled {
      color: #9aa2ad;
      cursor: default;
      opacity: 0.65;
    }

    .tool-spacer {
      flex: 0 0 auto;
      width: 1px;
      height: 20px;
      background: var(--line);
    }

    .stream {
      min-height: 0;
      overflow: auto;
      background: #ffffff;
    }

    .entry {
      border-bottom: 1px solid var(--line);
      background: #ffffff;
    }

    .entry.active {
      box-shadow: inset 3px 0 0 var(--orange);
    }

    .entry-summary {
      width: 100%;
      min-height: 32px;
      display: grid;
      grid-template-columns: 14px minmax(110px, 180px) minmax(0, 1fr) 76px 72px;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      text-align: left;
    }

    .entry-summary:hover {
      background: #f5f8fc;
    }

    .entry.active .entry-summary {
      background: #fff8e8;
    }

    .read .entry-title,
    .read .entry-source {
      color: #5f6670;
      font-weight: 400;
    }

    .unread-marker {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--green);
      justify-self: center;
    }

    .read .unread-marker {
      background: transparent;
    }

    .entry-source,
    .entry-title,
    .entry-quality,
    .entry-date {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .entry-source {
      color: #27384d;
      font-weight: 700;
      font-size: 12px;
    }

    .entry-title {
      font-weight: 700;
      line-height: 1.25;
    }

    .entry-quality {
      color: #b05b00;
      font-size: 12px;
      text-align: right;
    }

    .entry-date {
      color: var(--muted);
      font-size: 12px;
      text-align: right;
    }

    .entry-expanded {
      display: none;
      padding: 14px 20px 28px 214px;
      border-top: 1px solid #edf0f4;
      background: #ffffff;
    }

    .entry.active .entry-expanded {
      display: block;
    }

    .expanded-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .expanded-sticky {
      position: sticky;
      top: 0;
      z-index: 3;
      margin: -14px -20px 16px -214px;
      padding: 10px 20px 10px 214px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(8px);
    }

    .expanded-title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      margin-top: 5px;
    }

    .expanded-title {
      min-width: 0;
      margin: 0;
      font-size: 19px;
      line-height: 1.28;
      font-weight: 700;
    }

    .expanded-actions {
      flex: 0 0 auto;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    .entry-content {
      max-width: 820px;
      color: #222222;
      font-size: 15px;
      line-height: 1.68;
      overflow-wrap: anywhere;
    }

    .entry-content p,
    .entry-content ul,
    .entry-content ol,
    .entry-content blockquote,
    .entry-content pre,
    .entry-content table {
      margin: 0 0 1.1em;
    }

    .entry-content img {
      max-width: 100%;
      height: auto;
      border: 1px solid var(--line);
    }

    .entry-content pre {
      overflow: auto;
      padding: 12px;
      border: 1px solid #2d3748;
      background: #111827;
      color: #e5e7eb;
      line-height: 1.55;
    }

    .entry-content code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.92em;
    }

    .entry-content blockquote {
      padding-left: 16px;
      border-left: 4px solid var(--line-strong);
      color: #465366;
    }

    .entry-content table {
      width: 100%;
      border-collapse: collapse;
      font-size: 15px;
    }

    .entry-content th,
    .entry-content td {
      padding: 8px;
      border: 1px solid var(--line);
      vertical-align: top;
    }

    .empty-state {
      color: var(--muted);
      padding: 28px;
      text-align: center;
    }

    @media (max-width: 860px) {
      .topbar {
        height: auto;
        min-height: 82px;
        align-items: flex-start;
        flex-direction: column;
        padding: 10px 12px;
        gap: 8px;
      }

      .brand {
        width: 100%;
      }

      .search-form {
        width: 100%;
        max-width: none;
      }

      .top-links {
        overflow-x: auto;
      }

      .reader-shell {
        height: calc(100dvh - 126px);
        grid-template-columns: 1fr;
        grid-template-rows: auto minmax(0, 1fr);
      }

      .sidebar {
        max-height: 188px;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      .sidebar-meta {
        display: none;
      }

      .content-titlebar {
        min-height: 40px;
      }

      .entry-summary {
        grid-template-columns: 12px minmax(0, 1fr) 58px;
      }

      .entry-source,
      .entry-quality {
        display: none;
      }

      .entry-expanded {
        padding: 14px 16px 26px;
      }

      .expanded-sticky {
        margin: -14px -16px 16px;
        padding: 10px 16px;
      }

      .expanded-title-row {
        flex-direction: column;
        gap: 8px;
      }

      .expanded-actions {
        justify-content: flex-start;
      }

      .toolbar {
        overflow-x: auto;
      }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand"><strong>Reader</strong><span>中文独立博客</span></div>
    <form class="search-form" role="search">
      <input id="search" class="search-input" type="search" autocomplete="off" placeholder="搜索所有文章">
    </form>
    <nav class="top-links" aria-label="输出">
      <span id="updated-at"></span>
      <a href="all.xml">RSS</a>
      <a href="feeds.opml">OPML</a>
      <a href="status.json">Status</a>
    </nav>
  </header>
  <div class="reader-shell">
    <aside class="sidebar">
      <div class="sidebar-top">
        <button class="nav-item active" type="button" data-filter="all">
          <span>所有文章</span><span class="nav-count" id="all-count"></span>
        </button>
        <button class="nav-item" type="button" data-filter="unread">
          <span>未读文章</span><span class="nav-count" id="nav-unread-count"></span>
        </button>
        <button class="nav-item" type="button" data-filter="read">
          <span>已读文章</span><span class="nav-count" id="read-count"></span>
        </button>
      </div>
      <div class="filter-section">
        <div class="filter-heading"><span>质量</span><span id="quality-total"></span></div>
        <button class="quality-item active" type="button" data-quality="all">
          <span class="quality-label">全部质量</span><span class="nav-count" id="quality-all-count"></span>
        </button>
        <button class="quality-item" type="button" data-quality="high">
          <span class="quality-label">高分</span><span class="nav-count" id="quality-high-count"></span>
        </button>
        <button class="quality-item" type="button" data-quality="medium">
          <span class="quality-label">中分</span><span class="nav-count" id="quality-medium-count"></span>
        </button>
        <button class="quality-item" type="button" data-quality="low">
          <span class="quality-label">低分</span><span class="nav-count" id="quality-low-count"></span>
        </button>
      </div>
      <div class="filter-section">
        <div class="filter-heading"><span>时间</span><span id="date-total"></span></div>
        <button class="date-item active" type="button" data-date="all">
          <span class="date-label">全部时间</span><span class="nav-count" id="date-all-count"></span>
        </button>
        <button class="date-item" type="button" data-date="today">
          <span class="date-label">今日</span><span class="nav-count" id="date-today-count"></span>
        </button>
        <button class="date-item" type="button" data-date="week">
          <span class="date-label">本周</span><span class="nav-count" id="date-week-count"></span>
        </button>
        <button class="date-item" type="button" data-date="month">
          <span class="date-label">本月</span><span class="nav-count" id="date-month-count"></span>
        </button>
      </div>
      <div class="sidebar-meta">
        <div id="visible-count"></div>
        <div id="crawl-summary"></div>
      </div>
      <section class="source-section">
        <div class="section-title"><span>订阅源</span><span id="source-total"></span></div>
        <div id="source-list" class="source-list"></div>
      </section>
    </aside>
    <main class="content">
      <div class="content-titlebar">
        <div id="view-title" class="view-title">所有文章</div>
        <div id="view-meta" class="view-meta"></div>
      </div>
      <div class="toolbar">
        <button class="tool-button active" type="button" data-filter="all">全部</button>
        <button class="tool-button" type="button" data-filter="unread">未读</button>
        <button class="tool-button" type="button" data-filter="read">已读</button>
        <span class="tool-spacer"></span>
        <button class="tool-button active" type="button" data-date="all">全部时间</button>
        <button class="tool-button" type="button" data-date="today">今日</button>
        <button class="tool-button" type="button" data-date="week">本周</button>
        <button class="tool-button" type="button" data-date="month">本月</button>
        <span class="tool-spacer"></span>
        <button id="mark-visible-read" class="tool-button" type="button">当前列表标为已读</button>
        <button id="toggle-active-read" class="tool-button" type="button">标记未读</button>
        <button id="collapse-active" class="tool-button" type="button">收起</button>
        <a id="open-original" class="tool-link" target="_blank" rel="noopener noreferrer">打开原文</a>
      </div>
      <div id="stream" class="stream" role="list"></div>
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
    let qualityFilter = "all";
    let dateFilter = "all";
    let query = "";
    let sourceFilter = "";
    let sourceFilterName = "";
    let retainedUnreadId = "";

    const stream = document.getElementById("stream");
    const search = document.getElementById("search");
    const viewTitle = document.getElementById("view-title");
    const viewMeta = document.getElementById("view-meta");
    const visibleCount = document.getElementById("visible-count");
    const crawlSummary = document.getElementById("crawl-summary");
    const allCount = document.getElementById("all-count");
    const navUnreadCount = document.getElementById("nav-unread-count");
    const readCount = document.getElementById("read-count");
    const qualityTotal = document.getElementById("quality-total");
    const qualityAllCount = document.getElementById("quality-all-count");
    const qualityHighCount = document.getElementById("quality-high-count");
    const qualityMediumCount = document.getElementById("quality-medium-count");
    const qualityLowCount = document.getElementById("quality-low-count");
    const dateTotal = document.getElementById("date-total");
    const dateAllCount = document.getElementById("date-all-count");
    const dateTodayCount = document.getElementById("date-today-count");
    const dateWeekCount = document.getElementById("date-week-count");
    const dateMonthCount = document.getElementById("date-month-count");
    const sourceTotal = document.getElementById("source-total");
    const sourceList = document.getElementById("source-list");
    const updatedAt = document.getElementById("updated-at");
    const openOriginal = document.getElementById("open-original");
    const markVisibleRead = document.getElementById("mark-visible-read");
    const toggleActiveRead = document.getElementById("toggle-active-read");
    const collapseActive = document.getElementById("collapse-active");

    function persistReadItems() {
      localStorage.setItem(readKey, JSON.stringify([...readItems].slice(-5000)));
    }

    function formatDate(value, options) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("zh-CN", options).format(date);
    }

    function sourceKey(item) {
      return item.feedUrl || item.sourceUrl || item.sourceTitle || "unknown";
    }

    function qualityLevel(item) {
      return item.contentQuality?.level || "low";
    }

    function qualityStars(item) {
      return item.contentQuality?.stars || 1;
    }

    function itemTimeMs(item) {
      if (!item.publishedAt) return 0;
      const time = new Date(item.publishedAt).getTime();
      return Number.isFinite(time) ? time : 0;
    }

    function startOfToday(now) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }

    function startOfWeek(now) {
      const day = now.getDay() || 7;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1).getTime();
    }

    function startOfMonth(now) {
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }

    function matchesDateFilter(item) {
      if (dateFilter === "all") return true;
      const now = new Date();
      const time = itemTimeMs(item);
      if (!time || time > now.getTime()) return false;
      if (dateFilter === "today") return time >= startOfToday(now);
      if (dateFilter === "week") return time >= startOfWeek(now);
      if (dateFilter === "month") return time >= startOfMonth(now);
      return true;
    }

    function sourceStats() {
      const map = new Map();
      for (const item of items) {
        const key = sourceKey(item);
        const existing = map.get(key) || {
          key,
          name: item.sourceTitle || "Unknown",
          count: 0,
        };
        existing.count += 1;
        map.set(key, existing);
      }
      return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }

    function visibleItems() {
      const q = query.trim().toLowerCase();
      return items.filter((item) => {
        const isRead = readItems.has(item.id);
        if (filter === "read" && !isRead) return false;
        if (filter === "unread" && isRead && item.id !== retainedUnreadId) return false;
        if (qualityFilter !== "all" && qualityLevel(item) !== qualityFilter) return false;
        if (!matchesDateFilter(item)) return false;
        if (sourceFilter && sourceKey(item) !== sourceFilter) return false;
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
      const readInCurrentItems = items.filter((item) => readItems.has(item.id)).length;
      const unread = items.length - readInCurrentItems;
      const filterTitles = {
        all: "所有文章",
        unread: "未读文章",
        read: "已读文章",
      };
      const qualityTitles = {
        all: "",
        high: "高分",
        medium: "中分",
        low: "低分",
      };
      const dateTitles = {
        all: "",
        today: "今日",
        week: "本周",
        month: "本月",
      };
      const qualityCounts = { high: 0, medium: 0, low: 0 };
      const dateCounts = { today: 0, week: 0, month: 0 };
      const now = new Date();
      const nowMs = now.getTime();
      const todayStart = startOfToday(now);
      const weekStart = startOfWeek(now);
      const monthStart = startOfMonth(now);

      for (const item of items) {
        qualityCounts[qualityLevel(item)] += 1;
        const time = itemTimeMs(item);
        if (time && time <= nowMs) {
          if (time >= todayStart) dateCounts.today += 1;
          if (time >= weekStart) dateCounts.week += 1;
          if (time >= monthStart) dateCounts.month += 1;
        }
      }

      const titleParts = [sourceFilter ? sourceFilterName : filterTitles[filter]];
      if (qualityTitles[qualityFilter]) titleParts.push(qualityTitles[qualityFilter]);
      if (dateTitles[dateFilter]) titleParts.push(dateTitles[dateFilter]);

      viewTitle.textContent = titleParts.join(" / ");
      allCount.textContent = String(items.length);
      navUnreadCount.textContent = String(unread);
      readCount.textContent = String(readInCurrentItems);
      qualityTotal.textContent = String(items.length);
      qualityAllCount.textContent = String(items.length);
      qualityHighCount.textContent = String(qualityCounts.high);
      qualityMediumCount.textContent = String(qualityCounts.medium);
      qualityLowCount.textContent = String(qualityCounts.low);
      dateTotal.textContent = String(items.length);
      dateAllCount.textContent = String(items.length);
      dateTodayCount.textContent = String(dateCounts.today);
      dateWeekCount.textContent = String(dateCounts.week);
      dateMonthCount.textContent = String(dateCounts.month);
      visibleCount.textContent = visible.length + " 篇可见，" + unread + " 篇未读";
      viewMeta.textContent = visible.length + " 篇";
      crawlSummary.textContent = status.summary
        ? status.summary.totalFeeds + " 个源，" + status.summary.outputItemCount + " 篇输出"
        : "";
      updatedAt.textContent = status.updatedAt
        ? "更新 " + formatDate(status.updatedAt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "";
      toggleActiveRead.textContent = readItems.has(activeId) ? "标记未读" : "标记已读";
    }

    function setActiveClasses() {
      document.querySelectorAll("[data-filter]").forEach((button) => {
        button.classList.toggle("active", button.dataset.filter === filter);
      });
      document.querySelectorAll("[data-quality]").forEach((button) => {
        button.classList.toggle("active", button.dataset.quality === qualityFilter);
      });
      document.querySelectorAll("[data-date]").forEach((button) => {
        button.classList.toggle("active", button.dataset.date === dateFilter);
      });
      document.querySelectorAll(".source-item").forEach((button) => {
        button.classList.toggle("active", button.dataset.source === sourceFilter);
      });
    }

    function renderSources() {
      const stats = sourceStats();
      sourceTotal.textContent = String(stats.length);
      const fragment = document.createDocumentFragment();

      const allSources = document.createElement("button");
      allSources.type = "button";
      allSources.className = "source-item";
      allSources.dataset.source = "";
      const allName = document.createElement("span");
      allName.className = "source-name";
      allName.textContent = "全部订阅源";
      const allSourceCount = document.createElement("span");
      allSourceCount.className = "source-count";
      allSourceCount.textContent = String(items.length);
      allSources.append(allName, allSourceCount);
      fragment.append(allSources);

      for (const source of stats) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "source-item";
        button.dataset.source = source.key;

        const name = document.createElement("span");
        name.className = "source-name";
        name.textContent = source.name;

        const count = document.createElement("span");
        count.className = "source-count";
        count.textContent = String(source.count);

        button.append(name, count);
        fragment.append(button);
      }

      sourceList.replaceChildren(fragment);
      setActiveClasses();
    }

    function renderStream() {
      const visible = visibleItems();
      if (activeId && !visible.some((item) => item.id === activeId)) {
        activeId = "";
        clearLocationHash();
        syncToolbarLinks(null);
      }

      const fragment = document.createDocumentFragment();

      for (const item of visible) {
        const entry = document.createElement("article");
        entry.className = "entry";
        entry.dataset.id = item.id;
        entry.setAttribute("role", "listitem");
        if (item.id === activeId) entry.classList.add("active");
        if (readItems.has(item.id)) entry.classList.add("read");

        const header = document.createElement("button");
        header.type = "button";
        header.className = "entry-summary";
        header.dataset.id = item.id;

        const dot = document.createElement("span");
        dot.className = "unread-marker";

        const source = document.createElement("span");
        source.className = "entry-source";
        source.textContent = item.sourceTitle || "Unknown";

        const title = document.createElement("span");
        title.className = "entry-title";
        title.textContent = item.title;

        const quality = document.createElement("span");
        quality.className = "entry-quality";
        quality.title = "质量分 " + (item.contentQuality?.score ?? 0);
        quality.textContent = "★ " + qualityStars(item);

        const date = document.createElement("span");
        date.className = "entry-date";
        date.textContent = formatDate(item.publishedAt, { month: "2-digit", day: "2-digit" });

        header.append(dot, source, title, quality, date);
        entry.append(header);

        if (item.id === activeId) {
          entry.append(renderExpanded(item));
        }

        fragment.append(entry);
      }

      stream.replaceChildren(fragment);
      renderStats(visible);
      setActiveClasses();

      if (visible.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "没有可显示的文章";
        stream.replaceChildren(empty);
        openOriginal.removeAttribute("href");
      }
    }

    function appendMetaPart(container, node) {
      if (container.childNodes.length > 0) {
        container.append(document.createTextNode(" / "));
      }
      container.append(node);
    }

    function renderExpanded(item) {
      const expanded = document.createElement("div");
      expanded.className = "entry-expanded";

      const sticky = document.createElement("div");
      sticky.className = "expanded-sticky";

      const meta = document.createElement("div");
      meta.className = "expanded-meta";
      const published = formatDate(item.publishedAt, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      if (item.sourceUrl) {
        const sourceLink = document.createElement("a");
        sourceLink.href = item.sourceUrl;
        sourceLink.target = "_blank";
        sourceLink.rel = "noopener noreferrer";
        sourceLink.textContent = item.sourceTitle || "Unknown";
        appendMetaPart(meta, sourceLink);
      } else if (item.sourceTitle) {
        appendMetaPart(meta, document.createTextNode(item.sourceTitle));
      }
      if (item.author) appendMetaPart(meta, document.createTextNode(item.author));
      if (published) appendMetaPart(meta, document.createTextNode(published));
      if (item.contentQuality) {
        appendMetaPart(
          meta,
          document.createTextNode(
            "质量 " + item.contentQuality.score + " / " + item.contentQuality.stars + "星",
          ),
        );
      }

      const title = document.createElement("h1");
      title.className = "expanded-title";
      title.textContent = item.title;

      const titleRow = document.createElement("div");
      titleRow.className = "expanded-title-row";

      const actions = document.createElement("div");
      actions.className = "expanded-actions";

      if (item.link || item.sourceUrl || item.feedUrl) {
        const link = document.createElement("a");
        link.className = "tool-link";
        link.href = item.link || item.sourceUrl || item.feedUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "打开原文";
        actions.append(link);
      }

      const markButton = document.createElement("button");
      markButton.className = "tool-button";
      markButton.type = "button";
      markButton.dataset.toggleRead = item.id;
      markButton.textContent = readItems.has(item.id) ? "标记未读" : "标记已读";
      actions.append(markButton);

      const collapseButton = document.createElement("button");
      collapseButton.className = "tool-button";
      collapseButton.type = "button";
      collapseButton.dataset.collapse = item.id;
      collapseButton.textContent = "收起";
      actions.append(collapseButton);

      const content = document.createElement("div");
      content.className = "entry-content";
      content.innerHTML = item.contentHtml || '<p class="empty-state">这篇文章没有可显示的正文。</p>';

      titleRow.append(title, actions);
      sticky.append(meta, titleRow);
      expanded.append(sticky, content);
      return expanded;
    }

    function syncToolbarLinks(item) {
      if (!item) {
        openOriginal.removeAttribute("href");
        toggleActiveRead.disabled = true;
        collapseActive.disabled = true;
        toggleActiveRead.textContent = "标记已读";
        return;
      }

      openOriginal.href = item.link || item.sourceUrl || item.feedUrl;
      toggleActiveRead.disabled = false;
      collapseActive.disabled = false;
      toggleActiveRead.textContent = readItems.has(item.id) ? "标记未读" : "标记已读";
    }

    function clearLocationHash() {
      history.replaceState(null, "", location.pathname + location.search);
    }

    function collapseItem({ clearRetained = false } = {}) {
      if (clearRetained) retainedUnreadId = "";
      activeId = "";
      clearLocationHash();
      syncToolbarLinks(null);
      renderStream();
    }

    function selectItem(id, markRead = true) {
      const item = byId.get(id);
      if (!item) return;

      const shouldRetainInUnread =
        filter === "unread" && (id === retainedUnreadId || (markRead && !readItems.has(id)));
      retainedUnreadId = shouldRetainInUnread ? id : "";
      activeId = id;
      if (markRead) {
        readItems.add(id);
        persistReadItems();
      }

      history.replaceState(null, "", "#" + encodeURIComponent(id));
      syncToolbarLinks(item);
      renderStream();
      const active = [...stream.querySelectorAll(".entry")].find((entry) => entry.dataset.id === id);
      if (active) active.scrollIntoView({ block: "nearest" });
    }

    function moveSelection(delta) {
      const visible = visibleItems();
      const current = visible.findIndex((item) => item.id === activeId);
      const nextIndex = Math.min(Math.max(current + delta, 0), visible.length - 1);
      if (visible[nextIndex]) selectItem(visible[nextIndex].id);
    }

    stream.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-toggle-read]");
      if (toggle) {
        event.stopPropagation();
        toggleReadState(toggle.dataset.toggleRead);
        return;
      }

      const collapse = event.target.closest("[data-collapse]");
      if (collapse) {
        event.stopPropagation();
        collapseItem();
        return;
      }

      const row = event.target.closest(".entry-summary");
      if (row) {
        if (row.dataset.id === activeId) collapseItem();
        else selectItem(row.dataset.id);
      }
    });

    search.addEventListener("input", () => {
      retainedUnreadId = "";
      query = search.value;
      renderStream();
    });
    document.querySelector(".search-form").addEventListener("submit", (event) => {
      event.preventDefault();
    });

    for (const button of document.querySelectorAll("[data-filter]")) {
      button.addEventListener("click", () => {
        retainedUnreadId = "";
        filter = button.dataset.filter;
        renderStream();
      });
    }

    for (const button of document.querySelectorAll("[data-quality]")) {
      button.addEventListener("click", () => {
        retainedUnreadId = "";
        qualityFilter = button.dataset.quality;
        renderStream();
      });
    }

    for (const button of document.querySelectorAll("[data-date]")) {
      button.addEventListener("click", () => {
        retainedUnreadId = "";
        dateFilter = button.dataset.date;
        renderStream();
      });
    }

    sourceList.addEventListener("click", (event) => {
      const button = event.target.closest(".source-item");
      if (!button) return;
      retainedUnreadId = "";
      sourceFilter = button.dataset.source || "";
      sourceFilterName = button.querySelector(".source-name")?.textContent || "";
      renderStream();
    });

    function toggleReadState(id) {
      if (!id) return;
      if (readItems.has(id)) {
        readItems.delete(id);
        if (retainedUnreadId === id) retainedUnreadId = "";
      } else {
        readItems.add(id);
        retainedUnreadId = filter === "unread" ? id : "";
      }
      persistReadItems();
      syncToolbarLinks(byId.get(activeId));
      renderStream();
    }

    toggleActiveRead.addEventListener("click", () => {
      toggleReadState(activeId);
    });

    collapseActive.addEventListener("click", () => {
      collapseItem();
    });

    markVisibleRead.addEventListener("click", () => {
      retainedUnreadId = "";
      for (const item of visibleItems()) {
        readItems.add(item.id);
      }
      persistReadItems();
      syncToolbarLinks(byId.get(activeId));
      renderStream();
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

    renderSources();
    if (items.length > 0) {
      activeId = byId.has(activeId) ? activeId : "";
      syncToolbarLinks(byId.get(activeId));
      renderStream();
    } else {
      syncToolbarLinks(null);
      renderStream();
    }
  </script>
</body>
</html>
`;
}
