import { parse } from "csv-parse/sync";

function normalizeUrl(value) {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "none") return "";
  return text;
}

function parseTags(value) {
  return String(value ?? "")
    .split(";")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function fetchRegistry(sourceCsvUrl, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);

  const response = await fetch(sourceCsvUrl, {
    signal: controller.signal,
    headers: {
      accept: "text/csv,*/*;q=0.8",
      "user-agent": options.userAgent ?? "hunya-ops/chinese-independent-blogs-rss",
    },
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`Failed to fetch source CSV: HTTP ${response.status}`);
  }

  const csvText = await response.text();
  const rows = parse(csvText, {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });

  const feeds = [];
  const missing = [];
  const seen = new Set();

  for (const row of rows) {
    const title = String(row.Introduction ?? "").trim();
    const siteUrl = normalizeUrl(row.Address);
    const feedUrl = normalizeUrl(row["RSS feed"]);
    const tags = parseTags(row.tags);
    const record = { title, siteUrl, feedUrl, tags };

    if (!feedUrl) {
      missing.push({ title, siteUrl, tags });
      continue;
    }

    if (seen.has(feedUrl)) continue;
    seen.add(feedUrl);
    feeds.push(record);
  }

  return {
    sourceCsvUrl,
    fetchedAt: new Date().toISOString(),
    feeds,
    missing,
  };
}
