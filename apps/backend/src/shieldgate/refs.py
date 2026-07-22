from datetime import UTC, datetime


from shieldgate.db import DbConn


async def next_ref(conn: DbConn, prefix: str, table: str, column: str = "public_ref") -> str:
    year = datetime.now(UTC).year
    # Serialize allocation per (prefix, year) scope. next_ref derives the number from the
    # table's current max, which is a read-then-insert race — two concurrent callers would
    # compute the same ref and collide on the unique index. Callers run next_ref + insert
    # inside a transaction, so this xact-level advisory lock is held across the insert,
    # forcing the loser to wait and re-read the (now-higher) max. Same pattern as the audit chain.
    await conn.execute("select pg_advisory_xact_lock(hashtext($1))", f"{prefix}-{year}")
    like = f"{prefix}-{year}-%"
    last = await conn.fetchval(
        f"select {column} from public.{table} where {column} like $1 order by {column} desc limit 1", like)
    n = (int(last.split("-")[-1]) + 1) if last else 1
    return f"{prefix}-{year}-{n:06d}"
