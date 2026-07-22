alter table public.decision_registrations enable row level security;
alter table public.appeals enable row level security;
alter table public.shadow_candidates enable row level security;
alter table public.provenance_records enable row level security;
alter table public.watch_items enable row level security;

-- decisions/appeals/provenance: NO client policies (FastAPI-only).
-- shadow + watch: admin-readable for dashboard panels.
create policy shadow_admin on public.shadow_candidates for select to authenticated
  using (public.current_role() = 'admin');
create policy watch_admin on public.watch_items for select to authenticated
  using (public.current_role() = 'admin');

-- Supabase's baseline default-privilege grant for new tables does not include
-- SELECT (see 20260716000002_rls_and_realtime.sql) — RLS policies alone don't
-- grant table access, so PostgREST reads 403 and Realtime subscribers get a
-- 401 without this. decision_registrations/appeals/provenance_records have no
-- client policies and stay ungranted (FastAPI-only, direct DB connection).
grant select on public.shadow_candidates, public.watch_items to authenticated;
grant select on public.shadow_candidates, public.watch_items to service_role;

alter publication supabase_realtime add table public.shadow_candidates;
alter publication supabase_realtime add table public.watch_items;
