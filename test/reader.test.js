import test from "node:test";
import assert from "node:assert/strict";
import { buildReaderHtml, buildReaderItems } from "../src/reader.js";

test("buildReaderItems sanitizes feed content", () => {
  const [item] = buildReaderItems([
    {
      title: "Post",
      link: "https://example.com/post",
      publishedAt: "2026-05-29T00:00:00.000Z",
      author: "Author",
      sourceTitle: "Source",
      sourceUrl: "https://example.com",
      feedUrl: "https://example.com/feed.xml",
      tags: ["编程"],
      content: '<p>Hello <strong>world</strong></p><script>alert("x")</script>',
    },
  ]);

  assert.match(item.contentHtml, /<strong>world<\/strong>/);
  assert.doesNotMatch(item.contentHtml, /script/);
  assert.equal(item.summary, "Hello world");
});

test("buildReaderItems drops unsafe links", () => {
  const [item] = buildReaderItems([
    {
      title: "Post",
      link: "javascript:alert(1)",
      sourceTitle: "Source",
      sourceUrl: "data:text/html,boom",
      feedUrl: "https://example.com/feed.xml",
      tags: [],
      content: "body",
    },
  ]);

  assert.equal(item.link, "");
  assert.equal(item.sourceUrl, "");
  assert.equal(item.feedUrl, "https://example.com/feed.xml");
});

test("buildReaderHtml embeds escaped JSON payload", () => {
  const html = buildReaderHtml(
    [
      {
        id: "x",
        title: "</script><script>alert(1)</script>",
        sourceTitle: "Source",
        tags: [],
        summary: "summary",
        contentHtml: "<p>body</p>",
      },
    ],
    {
      updatedAt: "2026-05-29T00:00:00.000Z",
      summary: { outputItemCount: 1 },
    },
  );

  assert.match(html, /id="reader-data"/);
  assert.doesNotMatch(html, /<\/script><script>alert/);
});
