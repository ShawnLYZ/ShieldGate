async def test_managers_can_read_watch_items_policy_exists(db):
    # Review delta: managers (not only admins) need a SELECT policy on watch_items for
    # the dashboard manager view. Multiple permissive policies OR together.
    exists = await db.fetchval(
        "select exists(select 1 from pg_policies where schemaname='public' "
        "and tablename='watch_items' and cmd='SELECT' and qual ilike '%manager%')")
    assert exists


async def test_seed_defines_a_fallback_tool(db):
    # Story-30 fallback demo needs a data path: at least one tool must point at a
    # tier-0 fallback tool.
    row = await db.fetchrow(
        "select t.name as tool, f.name as fallback, f.tier as fallback_tier "
        "from public.tools t join public.tools f on f.id = t.fallback_tool_id "
        "where t.fallback_tool_id is not null limit 1")
    assert row is not None
    assert row["fallback_tier"] == 0
