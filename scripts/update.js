import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";
import { CONFIG } from "../src/config.js";
import { crawlFeed } from "../src/crawler.js";
import { fetchRegistry } from "../src/registry.js";
import {
  buildOpml,
  buildRss,
  buildStatus,
  dedupeAndSortItems,
  writeJson,
} from "../src/output.js";
import { buildReaderHtml, buildReaderItems } from "../src/reader.js";
import { truncate } from "../src/utils.js";

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function main() {
  await mkdir(CONFIG.dataDir, { recursive: true });
  await mkdir(CONFIG.outDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const statePath = path.join(CONFIG.dataDir, "state.json");
  const registryPath = path.join(CONFIG.dataDir, "registry.json");
  const previousState = await readJson(statePath, { version: 1, feeds: {} });

  console.log(`Fetching source registry: ${CONFIG.sourceCsvUrl}`);
  let registry;
  try {
    registry = await fetchRegistry(CONFIG.sourceCsvUrl, {
      timeoutMs: CONFIG.requestTimeoutMs,
      userAgent: CONFIG.userAgent,
    });
  } catch (error) {
    const cachedRegistry = await readJson(registryPath, null);
    if (!cachedRegistry?.feeds?.length) throw error;
    console.warn(`Failed to fetch source registry, using cached registry: ${error.message}`);
    registry = {
      ...cachedRegistry,
      sourceCsvUrl: CONFIG.sourceCsvUrl,
      fetchedAt: cachedRegistry.fetchedAt ?? startedAt,
    };
  }
  console.log(
    `Registry loaded: ${registry.feeds.length} feeds, ${registry.missing.length} blogs without feed URLs.`,
  );

  await writeJson(registryPath, registry);
  await writeJson(path.join(CONFIG.outDir, "feeds.json"), registry.feeds);
  await writeJson(path.join(CONFIG.outDir, "missing.json"), registry.missing);
  await writeFile(
    path.join(CONFIG.outDir, "feeds.txt"),
    `${registry.feeds.map((feed) => feed.feedUrl).join("\n")}\n`,
  );
  await writeFile(path.join(CONFIG.outDir, "feeds.opml"), buildOpml(registry.feeds));

  const limit = pLimit(CONFIG.concurrency);
  let completed = 0;

  const crawlResults = await Promise.all(
    registry.feeds.map((feed) =>
      limit(async () => {
        const previous = previousState.feeds?.[feed.feedUrl] ?? {};
        const result = await crawlFeed(feed, previous);
        completed += 1;
        if (completed % 50 === 0 || completed === registry.feeds.length) {
          console.log(`Crawled ${completed}/${registry.feeds.length} feeds.`);
        }
        return result;
      }),
    ),
  );

  const allItems = dedupeAndSortItems(
    crawlResults.flatMap((result) => result.items),
    CONFIG.maxOutputItems,
  );
  const updatedAt = new Date().toISOString();

  const nextState = {
    version: 1,
    sourceCsvUrl: CONFIG.sourceCsvUrl,
    startedAt,
    updatedAt,
    feeds: Object.fromEntries(
      crawlResults.map((result) => [
        result.feed.feedUrl,
        {
          title: result.feed.title,
          siteUrl: result.feed.siteUrl,
          feedUrl: result.feed.feedUrl,
          tags: result.feed.tags,
          etag: result.etag ?? null,
          lastModified: result.lastModified ?? null,
          lastFetchedAt: result.lastFetchedAt,
          lastSuccessAt: result.lastSuccessAt ?? null,
          lastStatus: result.lastStatus,
          lastError: result.lastError ?? null,
          failureCount: result.failureCount,
          items: result.items.slice(0, CONFIG.maxItemsPerFeed).map((item) => ({
            ...item,
            content: truncate(item.content, CONFIG.maxStateContentChars),
          })),
        },
      ]),
    ),
  };

  const status = buildStatus({
    registry,
    crawlResults,
    outputItemCount: allItems.length,
    startedAt,
    updatedAt,
  });

  await writeJson(statePath, nextState);
  await writeJson(path.join(CONFIG.outDir, "status.json"), status);
  await writeFile(path.join(CONFIG.outDir, "all.xml"), buildRss(allItems, status));
  const readerItems = buildReaderItems(allItems);
  await writeJson(path.join(CONFIG.outDir, "items.json"), readerItems);
  await writeFile(path.join(CONFIG.outDir, "index.html"), buildReaderHtml(readerItems, status));

  console.log(
    `Done: ${allItems.length} items, ${status.summary.ok} ok, ${status.summary.notModified} not modified, ${status.summary.timeout} timeouts, ${status.summary.error} errors.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
