import hashlib

from shieldgate.audit.chain import (
    GENESIS_HASH,
    append_event,
    canonical,
    verify_chain,
)


def test_genesis_hash_constant():
    assert GENESIS_HASH == hashlib.sha256(b"shieldgate-genesis").hexdigest()


def test_canonical_is_sorted_and_compact():
    assert canonical({"b": 1, "a": [1, 2]}) == '{"a":[1,2],"b":1}'


async def _emit(db, n):
    rows = []
    for i in range(n):
        rows.append(await append_event(
            db, employee_pseudonym="EMP-D3A1", department="Engineering",
            tool_id=None, tool_domain="localhost:5175", direction="prompt",
            event_type="block", data_category="restricted", matrix_action="block",
            pattern_types=["card"], masked_excerpt=f"masked {i}",
        ))
    return rows


async def test_chain_links_and_verifies(db):
    rows = await _emit(db, 3)
    assert rows[0]["prev_hash"] == GENESIS_HASH
    assert rows[1]["prev_hash"] == rows[0]["row_hash"]
    assert rows[2]["prev_hash"] == rows[1]["row_hash"]
    ok, bad = await verify_chain(db)
    assert ok is True and bad is None


async def test_tamper_detected(db):
    rows = await _emit(db, 3)
    await db.execute(
        "update public.audit_events set masked_excerpt = 'forged' where seq = $1",
        rows[1]["seq"],
    )
    ok, bad = await verify_chain(db)
    assert ok is False and bad == rows[1]["seq"]


async def test_never_stores_raw_bodies(db):
    row = (await _emit(db, 1))[0]
    assert "text" not in row and "prompt" not in row


async def test_non_utc_offset_occurred_at_verifies(db):
    await _emit(db, 1)
    await append_event(
        db, employee_pseudonym="EMP-D3A1", department="Engineering",
        tool_id=None, tool_domain="localhost:5175", direction="prompt",
        event_type="block", data_category="restricted", matrix_action="block",
        pattern_types=["card"], masked_excerpt="masked backdated",
        occurred_at="2026-07-16T10:00:00+05:30",
    )
    ok, bad = await verify_chain(db)
    assert ok is True and bad is None
