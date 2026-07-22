from dataclasses import dataclass
from datetime import UTC, datetime

import feedparser


@dataclass
class FeedEntry:
    title: str
    url: str
    published_at: datetime | None
    summary: str


def match_tags(title: str, summary: str, policy_tags: list[str]) -> list[str]:
    blob = f"{title} {summary}".lower()
    return sorted({t for t in policy_tags if t.lower() in blob})


def parse_feed(xml: str) -> list[FeedEntry]:
    parsed = feedparser.parse(xml)
    out = []
    for e in parsed.entries:
        published = None
        if getattr(e, "published_parsed", None):
            published = datetime(*e.published_parsed[:6], tzinfo=UTC)
        out.append(FeedEntry(title=e.get("title", ""), url=e.get("link", ""),
                             published_at=published, summary=e.get("summary", "")))
    return out


async def refresh_watch(conn, http_get) -> int:
    feeds_setting = await conn.fetchval("select value from public.app_settings where key='watch_feeds'")
    feeds = feeds_setting.get("feeds", []) if feeds_setting else []
    # Policy tag vocabulary: category names + capability tags in the registry.
    cats = ["public", "internal", "confidential", "restricted"]
    tag_rows = await conn.fetch("select distinct unnest(capability_tags) as t from public.tools")
    vocab = cats + [r["t"] for r in tag_rows]
    new_count = 0
    for feed in feeds:
        try:
            xml = await http_get(feed["url"])
        except Exception:
            continue
        for entry in parse_feed(xml):
            if not entry.url:
                continue
            tags = match_tags(entry.title, entry.summary, vocab)
            if not tags:
                continue
            existing = await conn.fetchval("select 1 from public.watch_items where url=$1", entry.url)
            if existing:
                continue
            await conn.execute(
                """insert into public.watch_items (source, title, url, published_at, matched_tags)
                   values ($1,$2,$3,$4,$5) on conflict (url) do nothing""",
                feed.get("source", "unknown"), entry.title, entry.url, entry.published_at, tags)
            new_count += 1
    return new_count
