"""Behavioral RLS tests for coaching_state (design §2: employee reads own row).

Simulates PostgREST/Supabase clients on the raw connection: SET LOCAL ROLE
authenticated + request.jwt.claims carrying the profile id, exactly what
auth.uid() reads on the local stack.
"""

ADMIN = "00000000-0000-0000-0000-0000000000a1"
MANAGER = "00000000-0000-0000-0000-0000000000a2"
EMPLOYEE = "00000000-0000-0000-0000-0000000000a3"


async def _select_as(db, profile_id):
    async with db.transaction():
        await db.execute("set local role authenticated")
        await db.execute(
            "select set_config('request.jwt.claims', $1, true)",
            f'{{"sub":"{profile_id}"}}')
        return [r["pseudonym"] for r in
                await db.fetch("select pseudonym from public.coaching_state order by pseudonym")]


async def test_employee_reads_own_coaching_row_only(db):
    # EMP-D3A1 is the pseudonym mapped to the employee demo profile via
    # employee_tokens; EMP-9B10 belongs to an unlinked Finance token.
    await db.execute(
        "insert into public.coaching_state (pseudonym) values ('EMP-D3A1'), ('EMP-9B10')")
    assert await _select_as(db, EMPLOYEE) == ["EMP-D3A1"]


async def test_admin_reads_all_coaching_rows(db):
    await db.execute(
        "insert into public.coaching_state (pseudonym) values ('EMP-D3A1'), ('EMP-9B10')")
    assert await _select_as(db, ADMIN) == ["EMP-9B10", "EMP-D3A1"]


async def test_manager_reads_no_coaching_rows(db):
    # Spec §2 grants managers no coaching_state read — only employees (own) and admins.
    await db.execute(
        "insert into public.coaching_state (pseudonym) values ('EMP-D3A1'), ('EMP-9B10')")
    assert await _select_as(db, MANAGER) == []


async def test_employee_cannot_read_the_token_mapping_itself(db):
    # The pseudonym mapping stays backend-only: the security-definer helper exposes
    # the caller's own pseudonyms, never the employee_tokens table.
    import asyncpg
    try:
        async with db.transaction():
            await db.execute("set local role authenticated")
            await db.execute(
                "select set_config('request.jwt.claims', $1, true)", f'{{"sub":"{EMPLOYEE}"}}')
            await db.fetch("select * from public.employee_tokens")
        raise AssertionError("employee_tokens must not be client-readable")
    except asyncpg.exceptions.InsufficientPrivilegeError:
        pass
