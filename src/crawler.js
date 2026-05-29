import Parser from "rss-parser";
import { CONFIG } from "./config.js";
import { compactText, normalizeItem, truncate } from "./utils.js";

const parser = new Parser({
  timeout: CONFIG.requestTimeoutMs,
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["dc:creator", "dcCreator"],
      ["media:thumbnail", "mediaThumbnail"],
    ],
    feed: [
      ["subtitle", "subtitle"],
      ["updated", "updated"],
    ],
  },
});

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

function getHeader(headers, name, fallback = null) {
  return headers.get(name) ?? fallback;
}

function parseJsonFeed(body, feed) {
  const parsed = JSON.parse(body);
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  return items.map((item) =>
    normalizeItem(
      {
        guid: item.id,
        title: item.title,
        link: item.url ?? item.external_url,
        publishedAt: item.date_published ?? item.date_modified,
        author:
          item.author?.name ??
          item.authors?.map((author) => author.name).filter(Boolean).join(", "),
        content: item.content_html ?? item.content_text ?? item.summary,
      },
      feed,
    ),
  );
}

async function parseXmlFeed(body, feed) {
  const parsed = await parser.parseString(body);
  const items = Array.isArray(parsed.items) ? parsed.items : [];

  return items.map((item) =>
    normalizeItem(
      {
        guid: item.guid ?? item.id,
        title: item.title,
        link: item.link,
        publishedAt: item.isoDate ?? item.pubDate,
        author: item.creator ?? item.author ?? item.dcCreator,
        content:
          item.contentEncoded ??
          item["content:encoded"] ??
          item.content ??
          item.summary ??
          item.contentSnippet,
      },
      feed,
    ),
  );
}

async function parseFeedBody(body, feed, contentType) {
  const trimmed = body.trimStart();
  if (contentType.includes("json") || trimmed.startsWith("{")) {
    return parseJsonFeed(body, feed);
  }

  return parseXmlFeed(body, feed);
}

function staleItems(previous) {
  return Array.isArray(previous.items)
    ? previous.items.slice(0, CONFIG.maxItemsPerFeed).map((item) => normalizeItem(item, previous))
    : [];
}

function errorResult(feed, previous, error, status = "error") {
  const now = new Date().toISOString();
  return {
    feed,
    etag: previous.etag ?? null,
    lastModified: previous.lastModified ?? null,
    lastFetchedAt: now,
    lastSuccessAt: previous.lastSuccessAt ?? null,
    lastStatus: status,
    lastError: compactText(error.message ?? String(error)),
    failureCount: (previous.failureCount ?? 0) + 1,
    items: staleItems(previous),
  };
}

export async function crawlFeed(feed, previous = {}) {
  const now = new Date().toISOString();
  const headers = {
    accept:
      "application/rss+xml,application/atom+xml,application/feed+json,application/json,text/xml,application/xml;q=0.9,*/*;q=0.8",
    "user-agent": CONFIG.userAgent,
  };

  if (previous.etag) headers["if-none-match"] = previous.etag;
  if (previous.lastModified) headers["if-modified-since"] = previous.lastModified;

  const timeout = timeoutSignal(CONFIG.requestTimeoutMs);

  try {
    const response = await fetch(feed.feedUrl, {
      headers,
      redirect: "follow",
      signal: timeout.signal,
    });

    if (response.status === 304) {
      return {
        feed,
        etag: previous.etag ?? null,
        lastModified: previous.lastModified ?? null,
        lastFetchedAt: now,
        lastSuccessAt: previous.lastSuccessAt ?? now,
        lastStatus: "not-modified",
        lastError: null,
        failureCount: 0,
        items: staleItems(previous),
      };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = await response.text();
    const items = (await parseFeedBody(body, feed, getHeader(response.headers, "content-type", "")))
      .filter((item) => item.title || item.link)
      .slice(0, CONFIG.maxItemsPerFeed)
      .map((item) => ({
        ...item,
        title: truncate(item.title, 500),
        content: truncate(item.content, CONFIG.maxContentChars),
      }));

    return {
      feed,
      etag: getHeader(response.headers, "etag", previous.etag ?? null),
      lastModified: getHeader(response.headers, "last-modified", previous.lastModified ?? null),
      lastFetchedAt: now,
      lastSuccessAt: now,
      lastStatus: "ok",
      lastError: null,
      failureCount: 0,
      items,
    };
  } catch (error) {
    const status = error.name === "AbortError" ? "timeout" : "error";
    return errorResult(feed, previous, error, status);
  } finally {
    timeout.clear();
  }
}
