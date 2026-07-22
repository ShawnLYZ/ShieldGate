from shieldgate.policy.suggest import suggest_tool


async def test_suggests_highest_tier_with_capability(db):
    s = await suggest_tool(db, "code")
    assert s is not None and s["name"] == "Claude"  # tier 2, has 'code'


async def test_excludes_current_tool(db):
    # The tool the user was just warned/blocked on is never a valid "try this
    # instead" — excluding Claude leaves ChatGPT as the only other 'code' tool.
    claude = await db.fetchval("select id from public.tools where name='Claude'")
    s = await suggest_tool(db, "code", exclude_tool_id=claude)
    assert s is not None and s["name"] == "ChatGPT"


async def test_explicit_fallback_wins_when_usable(db):
    # Design §7: per-tool fallback override beats the capability search.
    gemini = await db.fetchval("select id from public.tools where name='Gemini'")
    s = await suggest_tool(db, "code", fallback_tool_id=gemini)
    assert s is not None and s["name"] == "Gemini"


async def test_tier0_fallback_is_skipped(db):
    # A Tier-0 fallback (e.g. the mock page) is not a usable suggestion; fall
    # through to the capability search.
    mock = await db.fetchval("select id from public.tools where name='Mock AI Chat'")
    s = await suggest_tool(db, "code", fallback_tool_id=mock)
    assert s is not None and s["name"] == "Claude"


async def test_none_when_no_match(db):
    assert await suggest_tool(db, "nonexistent-capability") is None


async def test_self_registered_classifier_never_suggested(db):
    # tier 0 (excluded by suggest_tool's tier >= 1 filter) plus a capability tag distinct
    # from chat/code/drafting/analysis keeps this out of "try this instead" twice over.
    s = await suggest_tool(db, "classification")
    assert s is None
