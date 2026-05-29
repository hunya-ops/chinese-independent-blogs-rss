function numberFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const CONFIG = {
  sourceCsvUrl:
    process.env.SOURCE_CSV_URL ??
    "https://raw.githubusercontent.com/timqian/chinese-independent-blogs/master/blogs-original.csv",
  publicBaseUrl:
    process.env.PUBLIC_BASE_URL ??
    "https://hunya-ops.github.io/chinese-independent-blogs-rss",
  dataDir: process.env.DATA_DIR ?? "data",
  outDir: process.env.OUT_DIR ?? "public",
  maxOutputItems: numberFromEnv("MAX_OUTPUT_ITEMS", 1500),
  maxItemsPerFeed: numberFromEnv("MAX_ITEMS_PER_FEED", 10),
  concurrency: numberFromEnv("CONCURRENCY", 30),
  requestTimeoutMs: numberFromEnv("REQUEST_TIMEOUT_MS", 12_000),
  maxContentChars: numberFromEnv("MAX_CONTENT_CHARS", 4_000),
  maxStateContentChars: numberFromEnv("MAX_STATE_CONTENT_CHARS", 1_000),
  userAgent:
    process.env.USER_AGENT ??
    "hunya-ops/chinese-independent-blogs-rss (+https://github.com/hunya-ops/chinese-independent-blogs-rss)",
};
