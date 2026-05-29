import { CONFIG } from "./config.js";
import { cdata, escapeXml, itemKey } from "./utils.js";
import { writeFile } from "node:fs/promises";

export async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function rfc822(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toUTCString();
}

export function dedupeAndSortItems(items, maxItems) {
  const byKey = new Map();

  for (const item of items) {
    const key = itemKey(item);
    const existing = byKey.get(key);
    if (!existing || item.publishedAtMs > existing.publishedAtMs) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.publishedAtMs - a.publishedAtMs || a.title.localeCompare(b.title))
    .slice(0, maxItems);
}

export function buildOpml(feeds) {
  const outlines = feeds
    .map((feed) => {
      const attrs = [
        ["text", feed.title],
        ["title", feed.title],
        ["type", "rss"],
        ["xmlUrl", feed.feedUrl],
        ["htmlUrl", feed.siteUrl],
      ];

      if (feed.tags.length > 0) attrs.push(["category", feed.tags.join(",")]);

      return `<outline ${attrs
        .filter(([, value]) => value)
        .map(([name, value]) => `${name}="${escapeXml(value)}"`)
        .join(" ")}/>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n<head>\n<title>中文独立博客列表</title>\n</head>\n<body>\n${outlines}\n</body>\n</opml>\n`;
}

export function buildRss(items, status) {
  const siteUrl = CONFIG.publicBaseUrl.replace(/\/$/, "");
  const feedUrl = `${siteUrl}/all.xml`;
  const pubDate = rfc822(status.updatedAt) ?? new Date().toUTCString();

  const itemXml = items
    .map((item) => {
      const guid = item.link || `${item.feedUrl}#${encodeURIComponent(item.guid || item.title)}`;
      const pubDateXml = rfc822(item.publishedAt);
      const categories = item.tags
        .map((tag) => `<category>${escapeXml(tag)}</category>`)
        .join("");

      return `<item>
<title>${escapeXml(item.title || "(untitled)")}</title>
${item.link ? `<link>${escapeXml(item.link)}</link>` : ""}
<guid isPermaLink="${item.link ? "true" : "false"}">${escapeXml(guid)}</guid>
${pubDateXml ? `<pubDate>${pubDateXml}</pubDate>` : ""}
${item.author ? `<dc:creator>${escapeXml(item.author)}</dc:creator>` : ""}
<source url="${escapeXml(item.feedUrl)}">${escapeXml(item.sourceTitle)}</source>
${categories}
${item.content ? `<description>${cdata(item.content)}</description>` : ""}
</item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>中文独立博客聚合</title>
<link>${escapeXml(siteUrl)}</link>
<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
<description>Recent posts aggregated from timqian/chinese-independent-blogs.</description>
<language>zh-CN</language>
<lastBuildDate>${pubDate}</lastBuildDate>
<generator>hunya-ops/chinese-independent-blogs-rss</generator>
${itemXml}
</channel>
</rss>
`;
}

export function buildStatus({ registry, crawlResults, outputItemCount, startedAt, updatedAt }) {
  const summary = {
    totalFeeds: registry.feeds.length,
    missingFeeds: registry.missing.length,
    outputItemCount,
    ok: 0,
    notModified: 0,
    timeout: 0,
    error: 0,
  };

  const feeds = crawlResults.map((result) => {
    if (result.lastStatus === "ok") summary.ok += 1;
    else if (result.lastStatus === "not-modified") summary.notModified += 1;
    else if (result.lastStatus === "timeout") summary.timeout += 1;
    else summary.error += 1;

    return {
      title: result.feed.title,
      siteUrl: result.feed.siteUrl,
      feedUrl: result.feed.feedUrl,
      lastStatus: result.lastStatus,
      lastError: result.lastError,
      lastFetchedAt: result.lastFetchedAt,
      lastSuccessAt: result.lastSuccessAt,
      itemCount: result.items.length,
      failureCount: result.failureCount,
    };
  });

  return {
    sourceCsvUrl: registry.sourceCsvUrl,
    startedAt,
    updatedAt,
    summary,
    feeds,
  };
}
