from shieldgate.approvals.scoring import band_to_tier, compute_score, score_vendor

WEIGHTS = {"soc2": 25, "iso27001": 15, "dpa_published": 30,
           "clean_breach_history": 15, "enterprise_offering": 15}


def test_full_marks_caps_at_100():
    s = compute_score({"soc2": True, "iso27001": True, "dpa_published": True,
                       "breach_history_count": 0, "enterprise_offering": True}, WEIGHTS)
    assert s == 100


def test_breach_history_denies_clean_bonus():
    s = compute_score({"soc2": True, "iso27001": False, "dpa_published": False,
                       "breach_history_count": 2, "enterprise_offering": False}, WEIGHTS)
    assert s == 25  # only soc2


def test_bands():
    assert band_to_tier(85) == 2
    assert band_to_tier(55) == 1
    assert band_to_tier(20) == 0


async def test_score_known_vendor(db):
    r = await score_vendor(db, "Anthropic Claude", "https://claude.ai")
    assert r.score >= 70 and r.recommended_tier == 2


async def test_score_unknown_vendor_conservative(db):
    r = await score_vendor(db, "Random New AI", "https://random-new-ai.example")
    assert r.score < 40 and r.recommended_tier == 0


async def test_unknown_vendor_scores_zero(db):
    # An unknown vendor is no evidence of trustworthiness. It must NOT collect the
    # clean-breach-history bonus merely because the default breach count is 0.
    r = await score_vendor(db, "Totally Unknown Vendor", "https://totally-unknown-vendor.example")
    assert r.score == 0 and r.recommended_tier == 0


async def test_score_matches_by_domain_when_name_does_not(db):
    # tool_name has no vendor-name token match, but tool_url contains a seeded
    # vendor's domain ("anthropic.com") — this must resolve via the
    # domain-substring branch, not the name-token fallback.
    r = await score_vendor(db, "Some Rebrand Tool", "https://api.anthropic.com/v1/messages")
    assert r.score >= 70 and r.recommended_tier == 2
    assert r.signals["soc2"] is True
