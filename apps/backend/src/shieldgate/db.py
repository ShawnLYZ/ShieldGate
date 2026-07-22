import json

import asyncpg
from asyncpg.pool import PoolConnectionProxy
from fastapi import Request

# `pool.acquire()` hands back a PoolConnectionProxy, which forwards the whole
# Connection interface but is not a subclass of it. Repository helpers are
# called with both (a proxy from a request handler, a real Connection from
# tests and scripts), so they annotate `conn: DbConn`.
DbConn = asyncpg.Connection | PoolConnectionProxy


async def _init(conn: DbConn) -> None:
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await conn.set_type_codec("json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def create_pool(dsn: str) -> asyncpg.Pool:
    return await asyncpg.create_pool(dsn, min_size=1, max_size=10, init=_init)


def get_pool(request: Request) -> asyncpg.Pool:
    return request.app.state.pool
