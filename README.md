# Chinese Independent Blogs RSS

Aggregate recent posts from [timqian/chinese-independent-blogs](https://github.com/timqian/chinese-independent-blogs) into a single RSS feed.

## Outputs

The scheduled job writes static files under `public/`:

- `all.xml` - aggregated RSS feed.
- `index.html` - Google Reader-inspired web reader for the aggregated posts.
- `items.json` - sanitized article data used by the web reader.
- `feeds.opml` - source feed list for RSS readers.
- `feeds.json` - normalized source feed metadata.
- `feeds.txt` - one feed URL per line.
- `missing.json` - blogs without a feed URL in the upstream list.
- `status.json` - crawl health for each source feed.
- `quality-summary.json` - feed-level quality summary.

State is stored in `data/state.json` so scheduled runs can reuse `ETag`, `Last-Modified`, and recent items from feeds that return `304 Not Modified` or temporarily fail. The GitHub Actions workflow keeps `data/` in Actions cache and publishes `public/` through a Pages artifact, so generated files are not committed back into Git history.

Feed-level quality summaries are also written to `data/quality-summary.json` and committed by the scheduled workflow. This keeps the long-term quality baseline durable without committing large article caches or generated reader payloads.

## Local Usage

```sh
npm install
npm run update
```

Useful environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SOURCE_CSV_URL` | upstream `blogs-original.csv` | Source registry URL |
| `PUBLIC_BASE_URL` | `https://hunya-ops.github.io/chinese-independent-blogs-rss` | Base URL used in generated RSS |
| `MAX_OUTPUT_ITEMS` | `1500` | Maximum items in `all.xml` |
| `MAX_ITEMS_PER_FEED` | `10` | Items kept per source feed in state |
| `CONCURRENCY` | `30` | Parallel feed fetches |
| `REQUEST_TIMEOUT_MS` | `12000` | Timeout per feed request |
| `MAX_CONTENT_CHARS` | `4000` | Maximum item description length |
| `MAX_STATE_CONTENT_CHARS` | `1000` | Maximum item description length persisted in `data/state.json` |

## GitHub Pages

Enable GitHub Pages for the repository and publish from the `public/` directory using the included workflow. The feed will be available at:

```text
https://hunya-ops.github.io/chinese-independent-blogs-rss/
https://hunya-ops.github.io/chinese-independent-blogs-rss/all.xml
```
