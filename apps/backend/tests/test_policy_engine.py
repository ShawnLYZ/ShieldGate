from shieldgate.classify.patterns import scan
from shieldgate.policy.engine import (
    current_policy_version,
    load_matrix,
    matrix_action,
    resolve_category,
    resolve_tool,
)

ALL_CELLS = [
    ("public", 0, "allow"), ("public", 1, "allow"), ("public", 2, "allow"),
    ("internal", 0, "block"), ("internal", 1, "allow"), ("internal", 2, "allow"),
    ("confidential", 0, "block"), ("confidential", 1, "warn"), ("confidential", 2, "allow"),
    ("restricted", 0, "block"), ("restricted", 1, "block"), ("restricted", 2, "warn"),
]


async def test_matrix_seed_has_all_twelve_cells(db):
    matrix = await load_matrix(db)
    for category, tier, action in ALL_CELLS:
        assert matrix_action(matrix, category, tier) == action


def test_resolve_category_no_matches_is_public():
    assert resolve_category([]) == "public"


def test_resolve_category_pattern_hit_is_restricted():
    assert resolve_category(scan("card 4532-0151-1283-0366")) == "restricted"


def test_resolve_category_llm_beats_public_but_not_patterns():
    assert resolve_category([], llm_category="confidential") == "confidential"
    ms = scan("card 4532-0151-1283-0366")
    assert resolve_category(ms, llm_category="internal") == "restricted"


async def test_resolve_tool_known_and_unknown(db):
    chatgpt = await resolve_tool(db, "chatgpt.com")
    assert chatgpt is not None and chatgpt.tier == 1
    mock = await resolve_tool(db, "localhost:5175")
    assert mock is not None and mock.tier == 0
    unknown = await resolve_tool(db, "totally-new-ai.example")
    assert unknown.id is None and unknown.tier == 0


async def test_policy_version_reads_seed(db):
    assert await current_policy_version(db) >= 1
