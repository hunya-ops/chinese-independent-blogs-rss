import test from "node:test";
import assert from "node:assert/strict";
import { analyzeItemQuality, summarizeFeedQuality } from "../src/quality.js";

test("analyzeItemQuality scores full content higher than title-only content", () => {
  const full = analyzeItemQuality({
    title: "完整文章",
    content:
      "<p>这是一篇完整文章的第一段，包含足够的信息和上下文。</p>" +
      "<p>第二段继续展开主题，提供更多细节、背景和解释。</p>" +
      "<p>第三段包含结论和进一步说明，让阅读者可以在 RSS 中完成阅读。</p>",
  });
  const titleOnly = analyzeItemQuality({
    title: "完整文章",
    content: "完整文章",
  });

  assert.ok(full.score > titleOnly.score);
  assert.equal(titleOnly.level, "low");
});

test("summarizeFeedQuality uses median item score", () => {
  const summary = summarizeFeedQuality([
    { contentQuality: { score: 10, stars: 1, level: "low", completeness: "title-only" } },
    { contentQuality: { score: 80, stars: 4, level: "high", completeness: "full" } },
    { contentQuality: { score: 50, stars: 3, level: "medium", completeness: "partial" } },
  ]);

  assert.equal(summary.score, 50);
  assert.equal(summary.level, "medium");
  assert.equal(summary.counts.low, 1);
});
