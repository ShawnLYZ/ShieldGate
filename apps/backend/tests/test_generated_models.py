from shieldgate.generated.models import ClassifyResponse, EventBatch, PolicySnapshot


def test_classify_response_roundtrip():
    r = ClassifyResponse.model_validate({
        "category": "restricted", "action": "block",
        "matches": [{"type": "card", "span": [10, 29], "masked": "4532-****-****-1234"}],
        "maskable": True, "reason_plain": "A payment card number was detected.",
        "coaching": {"show": True}, "suggestion": None,
        "policy_version": 1, "degraded": False,
    })
    assert r.action == "block"
    assert r.matches[0].masked.endswith("1234")


async def test_approval_status_matches_db_enum(db):
    # The shared policy package is the source of truth for approval statuses
    # (design §4); the generated enum must stay label-for-label identical to the
    # SQL request_status enum the workflow actually persists.
    from shieldgate.generated.models import ApprovalStatus
    # schema-qualified: Supabase's pg_net extension ships its own request_status
    labels = [r["l"] for r in await db.fetch(
        "select enumlabel as l from pg_enum "
        "join pg_type on pg_type.oid = enumtypid "
        "join pg_namespace n on n.oid = pg_type.typnamespace "
        "where typname='request_status' and n.nspname='public' order by enumsortorder")]
    assert [s.value for s in ApprovalStatus] == labels


def test_snapshot_and_batch_validate():
    PolicySnapshot.model_validate({
        "version": 1, "generated_at": "2026-07-16T00:00:00Z",
        "matrix": [{"data_category": "public", "tier": 0, "action": "allow"}],
        "tools": [],
    })
    EventBatch.model_validate({"events": [{"event_type": "allow_usage", "direction": "prompt"}]})
