import json

import asyncpg
import httpx
import pytest

from shieldgate.app import create_app
from shieldgate.config import Settings

TEST_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


def make_test_settings(**overrides) -> Settings:
    base = dict(supabase_db_url=TEST_DB_URL, classifier_provider="fake", _env_file=None)
    base.update(overrides)
    return Settings(**base)


@pytest.fixture
async def db():
    conn = await asyncpg.connect(TEST_DB_URL)
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await conn.execute("truncate public.approval_requests cascade")
    await conn.execute("truncate public.audit_events cascade")
    await conn.execute("truncate public.coaching_state cascade")
    await conn.execute("truncate public.policy_versions restart identity cascade")
    await conn.execute("insert into public.policy_versions (reason) values ('test seed')")
    for t in ("appeals", "decision_registrations", "provenance_records",
              "shadow_candidates", "watch_items"):
        await conn.execute(f"truncate public.{t} cascade")
    yield conn
    await conn.close()


@pytest.fixture
async def app_client(db):
    app = create_app(make_test_settings())
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
