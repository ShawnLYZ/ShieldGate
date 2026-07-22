from shieldgate.horizon import match_tags, parse_feed, refresh_watch

FEED = """<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>EU AI Act: new transparency rules for restricted data</title>
<link>https://example.eu/item-1</link>
<pubDate>Mon, 01 Jun 2026 00:00:00 GMT</pubDate>
<description>Guidance affecting confidential and restricted categories.</description></item>
</channel></rss>"""


def test_match_tags():
    tags = match_tags("transparency rules for restricted data",
                      "affects confidential category", ["restricted", "confidential", "public"])
    assert set(tags) == {"restricted", "confidential"}


def test_parse_feed():
    entries = parse_feed(FEED)
    assert entries[0].url == "https://example.eu/item-1"
    assert "transparency" in entries[0].title.lower()


async def test_refresh_upserts(db):
    async def fake_get(url):
        return FEED
    n = await refresh_watch(db, fake_get)
    assert n >= 1
    row = await db.fetchrow("select * from public.watch_items where url='https://example.eu/item-1'")
    assert "restricted" in row["matched_tags"]
    # Idempotent: same URL not duplicated.
    await refresh_watch(db, fake_get)
    cnt = await db.fetchval("select count(*) from public.watch_items where url='https://example.eu/item-1'")
    assert cnt == 1
