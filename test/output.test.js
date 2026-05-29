import test from "node:test";
import assert from "node:assert/strict";
import { buildOpml, dedupeAndSortItems } from "../src/output.js";

test("dedupeAndSortItems prefers the newest item for the same link", () => {
  const items = [
    {
      title: "old",
      link: "https://example.com/post?utm_source=x#comments",
      feedUrl: "https://example.com/feed.xml",
      publishedAtMs: 1,
    },
    {
      title: "new",
      link: "https://example.com/post",
      feedUrl: "https://example.com/feed.xml",
      publishedAtMs: 2,
    },
  ];

  assert.deepEqual(
    dedupeAndSortItems(items, 10).map((item) => item.title),
    ["new"],
  );
});

test("buildOpml escapes XML attributes", () => {
  const opml = buildOpml([
    {
      title: "A & B",
      siteUrl: "https://example.com/?a=1&b=2",
      feedUrl: "https://example.com/feed.xml",
      tags: ["编程", "生活"],
    },
  ]);

  assert.match(opml, /A &amp; B/);
  assert.match(opml, /https:\/\/example.com\/\?a=1&amp;b=2/);
  assert.match(opml, /category="编程,生活"/);
});
