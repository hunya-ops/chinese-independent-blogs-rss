import sanitizeHtml from "sanitize-html";
import { compactText } from "./utils.js";

const READ_MORE_PATTERN =
  /(阅读全文|继续阅读|阅读更多|查看全文|Read\s*more|Continue\s*reading|more\s*\.{2,}|more\s*…)/i;
const ELLIPSIS_PATTERN = /(\.\.\.|…|……|\[\s*(?:…|\.\.\.)\s*\])\s*$/;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function countMatches(value, pattern) {
  return [...String(value ?? "").matchAll(pattern)].length;
}

function plainTextFromHtml(value) {
  return compactText(
    sanitizeHtml(String(value ?? ""), {
      allowedTags: [],
      allowedAttributes: {},
    }),
  );
}

function normalizedForSimilarity(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function bigrams(value) {
  const text = normalizedForSimilarity(value);
  if (text.length < 2) return text ? [text] : [];

  const result = [];
  for (let index = 0; index < text.length - 1; index += 1) {
    result.push(text.slice(index, index + 2));
  }
  return result;
}

function diceSimilarity(a, b) {
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  if (aBigrams.length === 0 || bBigrams.length === 0) return 0;

  const counts = new Map();
  for (const item of aBigrams) counts.set(item, (counts.get(item) ?? 0) + 1);

  let overlap = 0;
  for (const item of bBigrams) {
    const count = counts.get(item) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(item, count - 1);
    }
  }

  return (2 * overlap) / (aBigrams.length + bBigrams.length);
}

function lengthScore(textLength) {
  if (textLength >= 1500) return 65;
  if (textLength >= 800) return 58;
  if (textLength >= 500) return 48;
  if (textLength >= 300) return 38;
  if (textLength >= 120) return 22;
  if (textLength >= 40) return 10;
  if (textLength > 0) return 4;
  return 0;
}

function levelFromScore(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function completenessFromScore(score) {
  if (score >= 70) return "full";
  if (score >= 40) return "partial";
  if (score >= 15) return "summary";
  return "title-only";
}

function starsFromScore(score) {
  if (score <= 0) return 1;
  return clamp(Math.ceil(score / 20), 1, 5);
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function analyzeItemQuality(item) {
  const html = String(item.content ?? "");
  const text = plainTextFromHtml(html);
  const title = compactText(item.title);
  const textLength = text.length;
  const paragraphTagCount = countMatches(html, /<(p|li|blockquote|pre)(\s|>)/gi);
  const sentenceLikeCount = text
    .split(/(?:[。！？!?]\s*|[.]\s+|\n+)/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 24).length;
  const paragraphCount = Math.max(paragraphTagCount, Math.min(sentenceLikeCount, 12));
  const blockCount = countMatches(html, /<(p|div|section|article|li|blockquote|pre|h[1-6])(\s|>)/gi);
  const imageCount = countMatches(html, /<img(\s|>)/gi);
  const codeBlockCount = countMatches(html, /<(pre|code)(\s|>)/gi);
  const blockquoteCount = countMatches(html, /<blockquote(\s|>)/gi);
  const linkTextLength = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => plainTextFromHtml(match[1]).length)
    .reduce((sum, value) => sum + value, 0);
  const linkDensity = textLength > 0 ? linkTextLength / textLength : 0;
  const titleSimilarity = diceSimilarity(title, text.slice(0, Math.max(120, title.length * 3)));
  const hasReadMoreMarker = READ_MORE_PATTERN.test(text);
  const endsWithEllipsis = ELLIPSIS_PATTERN.test(text);
  const signals = [];

  let score = lengthScore(textLength);

  if (textLength >= 800) signals.push("long-text");
  if (textLength >= 1500) signals.push("very-long-text");
  if (paragraphCount >= 8) {
    score += 12;
    signals.push("many-paragraphs");
  } else if (paragraphCount >= 4) {
    score += 9;
    signals.push("multi-paragraph");
  } else if (paragraphCount >= 2) {
    score += 5;
    signals.push("two-paragraphs");
  }

  if (blockCount >= 4) {
    score += 8;
    signals.push("many-blocks");
  } else if (blockCount >= 2) {
    score += 5;
    signals.push("structured-html");
  }

  if (imageCount > 0) {
    score += 4;
    signals.push("has-images");
  }
  if (codeBlockCount > 0) {
    score += 5;
    signals.push("has-code");
  }
  if (blockquoteCount > 0) {
    score += 3;
    signals.push("has-blockquote");
  }
  if (textLength >= 1200 && !hasReadMoreMarker) {
    score += 5;
    signals.push("likely-complete");
  }

  if (hasReadMoreMarker) {
    score -= 20;
    signals.push("read-more-marker");
  }
  if (endsWithEllipsis && textLength < 800) {
    score -= 12;
    signals.push("ends-with-ellipsis");
  }
  if (title && titleSimilarity >= 0.82 && textLength <= title.length + 80) {
    score -= 30;
    signals.push("title-like-content");
  }
  if (linkDensity >= 0.45) {
    score -= 10;
    signals.push("link-heavy");
  }
  if (textLength < 20) {
    score -= 35;
    signals.push("near-empty");
  }
  if (!html.trim()) {
    score -= 40;
    signals.push("empty-content");
  }

  const normalizedScore = clamp(Math.round(score), 0, 100);

  return {
    score: normalizedScore,
    stars: starsFromScore(normalizedScore),
    level: levelFromScore(normalizedScore),
    completeness: completenessFromScore(normalizedScore),
    textLength,
    paragraphCount,
    blockCount,
    imageCount,
    codeBlockCount,
    linkDensity: Number(linkDensity.toFixed(3)),
    titleSimilarity: Number(titleSimilarity.toFixed(3)),
    signals,
  };
}

export function addQualityToItems(items) {
  return items.map((item) => ({
    ...item,
    contentQuality: item.contentQuality ?? analyzeItemQuality(item),
  }));
}

export function summarizeFeedQuality(items) {
  const sample = items.filter((item) => item.contentQuality).slice(0, 10);
  const scores = sample.map((item) => item.contentQuality.score);
  const score = median(scores);
  const counts = {
    high: 0,
    medium: 0,
    low: 0,
    full: 0,
    partial: 0,
    summary: 0,
    titleOnly: 0,
  };
  const stars = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const item of sample) {
    counts[item.contentQuality.level] += 1;
    stars[item.contentQuality.stars] += 1;
    if (item.contentQuality.completeness === "title-only") counts.titleOnly += 1;
    else counts[item.contentQuality.completeness] += 1;
  }

  return {
    score,
    stars: starsFromScore(score),
    level: levelFromScore(score),
    completeness: completenessFromScore(score),
    sampleSize: sample.length,
    counts,
    starsDistribution: stars,
  };
}

export function buildQualitySummary(registry, crawlResults) {
  const feedsByUrl = new Map(registry.feeds.map((feed) => [feed.feedUrl, feed]));
  const feeds = crawlResults
    .map((result) => {
      const feed = feedsByUrl.get(result.feed.feedUrl) ?? result.feed;
      const quality = result.feedQuality ?? summarizeFeedQuality(result.items);

      return {
        title: feed.title,
        siteUrl: feed.siteUrl,
        feedUrl: feed.feedUrl,
        tags: feed.tags,
        quality,
      };
    })
    .sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));

  return {
    version: 1,
    sourceCsvUrl: registry.sourceCsvUrl,
    totalFeeds: feeds.length,
    feeds,
  };
}
