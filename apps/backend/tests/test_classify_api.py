TOKEN = {"X-ShieldGate-Token": "sg-emp-demo-001"}


def req(text, domain="localhost:5175"):
    return {"direction": "prompt", "text": text, "tool_domain": domain,
            "client_matches": [], "policy_version": None}


async def test_requires_token(app_client):
    r = await app_client.post("/api/v1/classify", json=req("hello"))
    assert r.status_code == 401


async def test_degraded_regex_only_when_classifier_raises(app_client, db, monkeypatch):
    # When the context classifier is unreachable, classify falls back to regex-only and
    # flags the response as degraded rather than failing.
    import shieldgate.routes.classify as clsmod

    class Boom:
        async def classify_prompt(self, text):
            raise RuntimeError("classifier unreachable")

    monkeypatch.setattr(clsmod, "get_classifier", lambda settings, reachable: Boom())
    text = "[[ ambiguous document-shaped content with no regex-detectable PII in it at all ]]"
    r = await app_client.post("/api/v1/classify", headers=TOKEN, json=req(text))
    body = r.json()
    assert r.status_code == 200
    assert body["degraded"] is True
    assert body["category"] == "public"  # regex found nothing


async def test_document_shaped_clean_text_escalates_to_classifier(app_client, db, monkeypatch):
    # Story 12: ambiguous, document-shaped clean text must reach the context classifier
    # (so it can flag it), while short one-liners fast-path without escalation.
    import shieldgate.routes.classify as clsmod
    calls: list[str] = []

    class Spy:
        async def classify_prompt(self, text):
            calls.append(text)
            return None

    monkeypatch.setattr(clsmod, "get_classifier", lambda settings, reachable: Spy())

    await app_client.post("/api/v1/classify", headers=TOKEN, json=req("hello there friend"))
    assert calls == []  # short one-liner: not escalated

    doc = "Meeting notes\n- discussed the roadmap\n- reviewed the budget\n- next steps assigned"
    await app_client.post("/api/v1/classify", headers=TOKEN, json=req(doc))
    assert len(calls) == 1  # multi-line document-shaped clean text: escalated


async def test_suggestion_matches_blocked_tool_capability(app_client, db):
    # try-this-instead hardcoded the "chat" capability, so a block on a non-chat tool
    # suggested an unrelated chat tool. The suggestion must share the blocked tool's
    # capability.
    await db.execute(
        "insert into public.tools (name, vendor, domains, tier, capability_tags, continuity_status, dpa_status) "
        "values ('ImgBlocked','ImgBlocked',$1,0,'{image}','active','none'),"
        "       ('ImgAlt','ImgAlt',$2,2,'{image}','active','reviewed')",
        ["imgblocked.example"], ["imgalt.example"])
    try:
        r = await app_client.post("/api/v1/classify", headers=TOKEN,
            json=req("charge 4532-0151-1283-0366 now", domain="imgblocked.example"))
        body = r.json()
        assert body["action"] == "block"
        assert body["suggestion"] is not None, "expected a try-this-instead suggestion"
        assert body["suggestion"]["name"] == "ImgAlt"
    finally:
        # The block wrote an audit_event referencing ImgBlocked; clear it before the
        # tools (FK), so this insert into the un-truncated seed table leaves no residue.
        await db.execute(
            "delete from public.audit_events where tool_id in "
            "(select id from public.tools where name in ('ImgBlocked','ImgAlt'))")
        await db.execute("delete from public.tools where name in ('ImgBlocked','ImgAlt')")


async def test_card_on_tier0_blocks_with_plain_reason_and_audit(app_client, db):
    r = await app_client.post("/api/v1/classify", headers=TOKEN,
                              json=req("charge 4532-0151-1283-0366 now"))
    body = r.json()
    assert r.status_code == 200
    assert body["action"] == "block" and body["category"] == "restricted"
    assert body["matches"][0]["masked"] == "4532-****-****-0366"
    assert "payment card number" in body["reason_plain"]
    assert body["maskable"] is True
    ev = await db.fetchrow("select * from public.audit_events order by seq desc limit 1")
    assert ev["event_type"] == "block" and ev["employee_pseudonym"] == "EMP-D3A1"
    assert "4532-0151-1283-0366" not in (ev["masked_excerpt"] or "")


async def test_restricted_on_tier2_warns(app_client):
    r = await app_client.post("/api/v1/classify", headers=TOKEN,
                              json=req("card 4532-0151-1283-0366", domain="claude.ai"))
    assert r.json()["action"] == "warn"


async def test_clean_text_allows_without_audit(app_client, db):
    before = await db.fetchval("select count(*) from public.audit_events")
    r = await app_client.post("/api/v1/classify", headers=TOKEN,
                              json=req("draft a friendly meeting agenda"))
    assert r.json()["action"] == "allow" and r.json()["category"] == "public"
    after = await db.fetchval("select count(*) from public.audit_events")
    assert after == before


async def test_fake_llm_context_finding_not_maskable(app_client, db):
    r = await app_client.post("/api/v1/classify", headers=TOKEN,
                              json=req("[[CONFIDENTIAL]] our client term sheet says...",
                                       domain="chatgpt.com"))
    body = r.json()
    assert body["category"] == "confidential"
    assert body["action"] == "warn"  # confidential × tier 1
    assert body["maskable"] is False and body["matches"] == []
    ev = await db.fetchrow("select * from public.audit_events order by seq desc limit 1")
    # The audit trail must never persist raw prompt text for context-only (LLM) findings —
    # a leakage-prevention tool must not become the leak.
    assert "our client term sheet" not in (ev["masked_excerpt"] or "")


async def test_context_finding_reason_names_actual_category(app_client, db):
    # The LLM-context branch of build_reason hardcoded "looks Confidential" even when
    # the classifier returned internal/restricted; the plain-language reason must name
    # the category actually found (story 2: learn the rule, not a wrong rule).
    r = await app_client.post("/api/v1/classify", headers=TOKEN,
                              json=req("[[INTERNAL]] leadership offsite planning notes..."))
    body = r.json()
    assert body["category"] == "internal"
    assert "looks Internal" in body["reason_plain"]
    assert "Confidential" not in body["reason_plain"]


async def test_suggestion_never_suggests_the_current_tool(app_client, db):
    # restricted × tier2 warns on Claude; the old capability query returned the
    # highest-tier 'chat' tool — Claude itself. Try-this-instead must steer elsewhere.
    r = await app_client.post("/api/v1/classify", headers=TOKEN,
                              json=req("card 4532-0151-1283-0366", domain="claude.ai"))
    body = r.json()
    assert body["action"] == "warn"
    assert body["suggestion"] is not None
    assert body["suggestion"]["name"] != "Claude"


async def test_suggestion_honors_explicit_fallback_override(app_client, db):
    # Design §7: try-this-instead resolves via capability tags "with an optional
    # explicit fallback override per tool". A usable (tier>=1, active) fallback wins
    # over a higher-tier capability match.
    gemini = await db.fetchval("select id from public.tools where name='Gemini'")
    await db.execute(
        "insert into public.tools (name, vendor, domains, tier, capability_tags, dpa_status, fallback_tool_id) "
        "values ('FbSrc','FbSrc','{fbsrc.example}',0,'{chat}','none',$1)", gemini)
    try:
        r = await app_client.post("/api/v1/classify", headers=TOKEN,
                                  json=req("card 4532-0151-1283-0366", domain="fbsrc.example"))
        body = r.json()
        assert body["action"] == "block"
        assert body["suggestion"] is not None
        assert body["suggestion"]["name"] == "Gemini"  # not Claude (tier-2 'chat')
    finally:
        await db.execute(
            "delete from public.audit_events where tool_id in "
            "(select id from public.tools where name='FbSrc')")
        await db.execute("delete from public.tools where name='FbSrc'")


async def test_suggestion_skips_unusable_tier0_fallback(app_client, db):
    # Pinned invariant (guards the fallback-override feature): ChatGPT's seeded
    # continuity fallback is the Tier-0 mock page — fine for a suspension redirect,
    # but try-this-instead must not steer users to a Tier-0 tool. It falls through
    # to the capability search, excluding ChatGPT itself.
    r = await app_client.post("/api/v1/classify", headers=TOKEN,
                              json=req("card 4532-0151-1283-0366", domain="chatgpt.com"))
    body = r.json()
    assert body["action"] == "block"  # restricted × tier1
    assert body["suggestion"] is not None
    assert body["suggestion"]["name"] == "Claude"


async def test_coaching_flag_only_first_block(app_client):
    r1 = await app_client.post("/api/v1/classify", headers=TOKEN,
                               json=req("ic 020626-10-1234"))
    r2 = await app_client.post("/api/v1/classify", headers=TOKEN,
                               json=req("ic 020626-10-1234"))
    assert r1.json()["coaching"]["show"] is True
    assert r2.json()["coaching"]["show"] is False


async def test_coaching_shown_audited_exactly_once(app_client, db):
    # §2's event list includes coaching_shown; it is appended server-side at the
    # moment coaching_state first flips, so the trail exists even if the tab dies.
    await app_client.post("/api/v1/classify", headers=TOKEN, json=req("ic 020626-10-1234"))
    await app_client.post("/api/v1/classify", headers=TOKEN, json=req("ic 020626-10-1234"))
    n = await db.fetchval(
        "select count(*) from public.audit_events "
        "where event_type='coaching_shown' and employee_pseudonym='EMP-D3A1'")
    assert n == 1


async def _set_continuity(db, status):
    """Set claude.ai's continuity_status, returning (tool_id, original) to restore.
    `tools` is a seed table conftest.py deliberately does not truncate."""
    tool_id = await db.fetchval("select id from public.tools where 'claude.ai' = any(domains)")
    original = await db.fetchval("select continuity_status from public.tools where id=$1", tool_id)
    await db.execute("update public.tools set continuity_status=$2 where id=$1", tool_id, status)
    return tool_id, original


async def _restore_continuity(db, tool_id, original):
    await db.execute(
        "update public.tools set continuity_status=$2, continuity_note=null where id=$1",
        tool_id, original)


async def test_suspended_tool_blocks_confidential(app_client, db):
    # The backend is the single policy brain: a suspended tool must override its
    # effective tier to blocked (design §1, PRD). confidential × tier2 is normally
    # 'allow'; under suspension it must become 'block'.
    tool_id, original = await _set_continuity(db, "suspended")
    try:
        r = await app_client.post("/api/v1/classify", headers=TOKEN,
            json=req("[[CONFIDENTIAL]] our client term sheet says...", domain="claude.ai"))
        body = r.json()
        assert body["category"] == "confidential"
        assert body["action"] == "block"
    finally:
        await _restore_continuity(db, tool_id, original)


async def test_suspended_tool_blocks_on_redact_confirm(app_client, db):
    # /redact/confirm shares the enforcement path and must also honor suspension.
    # restricted × tier2 is normally 'warn'; under suspension it must become 'block'.
    tool_id, original = await _set_continuity(db, "suspended")
    try:
        r = await app_client.post("/api/v1/redact/confirm", headers=TOKEN,
            json={"text": "card 4532-0151-1283-0366", "tool_domain": "claude.ai"})
        assert r.json()["action"] == "block"
    finally:
        await _restore_continuity(db, tool_id, original)


async def test_advisory_tool_is_not_forced_to_block(app_client, db):
    # Only 'suspended' overrides the effective tier; 'advisory' keeps the tool's tier.
    tool_id, original = await _set_continuity(db, "advisory")
    try:
        r = await app_client.post("/api/v1/classify", headers=TOKEN,
            json=req("card 4532-0151-1283-0366", domain="claude.ai"))
        assert r.json()["action"] == "warn"  # restricted × tier2, unchanged
    finally:
        await _restore_continuity(db, tool_id, original)


async def test_unrecognized_category_is_loud_and_audited(app_client, db, monkeypatch):
    # Closes the fail-open: an out-of-enum category must not silently resolve to public
    # with no trace anywhere. Story 12/33 — schema constrains sampling, this is the
    # defense-in-depth path for whatever gets through anyway.
    import shieldgate.routes.classify as clsmod

    class Weird:
        async def classify_prompt(self, text):
            return ("Sensitive", "unexpected category shape")

    monkeypatch.setattr(clsmod, "get_classifier", lambda settings, reachable: Weird())
    text = "a long ambiguous document " * 20
    r = await app_client.post("/api/v1/classify", headers=TOKEN, json=req(text))
    body = r.json()
    assert r.status_code == 200
    assert body["degraded"] is True
    assert body["category"] == "public"  # unrecognized category treated as absent
    assert body["action"] == "allow"
    ev = await db.fetchrow(
        "select * from public.audit_events where event_type='unrecognized_category' "
        "order by seq desc limit 1")
    assert ev is not None
    assert ev["degraded"] is True
    assert "Sensitive" in ev["masked_excerpt"]


async def test_unrecognized_category_none_label_is_loud_and_audited(app_client, db, monkeypatch):
    # Regression: a malformed classifier returning a None category label must not collide
    # with the "nothing unrecognized" sentinel and silently skip the audit write.
    import shieldgate.routes.classify as clsmod

    class WeirdNone:
        async def classify_prompt(self, text):
            return (None, "some reason")

    monkeypatch.setattr(clsmod, "get_classifier", lambda settings, reachable: WeirdNone())
    text = "a long ambiguous document " * 20
    r = await app_client.post("/api/v1/classify", headers=TOKEN, json=req(text))
    body = r.json()
    assert r.status_code == 200
    assert body["degraded"] is True
    assert body["category"] == "public"  # unrecognized category treated as absent
    assert body["action"] == "allow"
    ev = await db.fetchrow(
        "select * from public.audit_events where event_type='unrecognized_category' "
        "order by seq desc limit 1")
    assert ev is not None
    assert ev["degraded"] is True
    assert "None" in ev["masked_excerpt"]
