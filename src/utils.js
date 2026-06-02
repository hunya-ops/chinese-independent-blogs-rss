export function compactText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value, maxLength) {
  const text = String(value ?? "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

export function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function cdata(value) {
  return `<![CDATA[${String(value ?? "").replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function normalizeDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function normalizeUrlForKey(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  try {
    const url = new URL(text);
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return text.replace(/#.*$/, "").replace(/\/$/, "");
  }
}

export function itemKey(item) {
  const linkKey = normalizeUrlForKey(item.link);
  if (linkKey) return `link:${linkKey}`;

  const guid = compactText(item.guid);
  if (guid) return `guid:${item.feedUrl}:${guid}`;

  return `fallback:${item.feedUrl}:${compactText(item.title)}:${item.publishedAt ?? ""}`;
}

export function normalizeItem(raw, feed) {
  const publishedAt = normalizeDate(raw.publishedAt);
  return {
    guid: compactText(raw.guid),
    title: compactText(raw.title),
    link: String(raw.link ?? "").trim(),
    publishedAt,
    publishedAtMs: publishedAt ? Date.parse(publishedAt) : 0,
    author: compactText(raw.author),
    content: String(raw.content ?? "").trim(),
    sourceTitle: feed.title,
    sourceUrl: feed.siteUrl,
    feedUrl: feed.feedUrl,
    tags: Array.isArray(feed.tags) ? feed.tags : [],
    contentQuality: raw.contentQuality,
  };
}
