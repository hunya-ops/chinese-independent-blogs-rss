import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { CONFIG } from "../src/config.js";
import { buildReaderHtml } from "../src/reader.js";

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  const itemsPath = path.join(CONFIG.outDir, "items.json");
  const statusPath = path.join(CONFIG.outDir, "status.json");
  const indexPath = path.join(CONFIG.outDir, "index.html");

  const [readerItems, status] = await Promise.all([readJson(itemsPath), readJson(statusPath)]);
  await writeFile(indexPath, buildReaderHtml(readerItems, status));

  console.log(`Rendered reader from cached output: ${readerItems.length} items.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
