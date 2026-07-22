alter table public.profiles enable row level security;
alter table public.tools enable row level security;
alter table public.employee_tokens enable row level security;
alter table public.policy_matrix enable row level security;
alter table public.policy_versions enable row level security;
alter table public.audit_events enable row level security;
alter table public.coaching_state enable row level security;
alter table public.app_settings enable row level security;

create or replace function public.current_role() returns public.user_role
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_department() returns text
language sql stable security definer set search_path = public as
$$ select department from public.profiles where id = auth.uid() $$;

-- profiles: user sees own row; admin sees all
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_role() = 'admin');

-- reference tables: any authenticated role may read
create policy tools_select on public.tools for select to authenticated using (true);
create policy matrix_select on public.policy_matrix for select to authenticated using (true);
create policy versions_select on public.policy_versions for select to authenticated using (true);

-- audit_events: admin all; manager own department; employees none (Phase 1)
create policy audit_select on public.audit_events for select to authenticated
  using (
    public.current_role() = 'admin'
    or (public.current_role() = 'manager' and department = public.current_department())
  );

-- employee_tokens, coaching_state, app_settings: no client policies (backend-only via direct connection)

-- Supabase's baseline default-privilege grant for new tables covers only
-- TRUNCATE/REFERENCES/TRIGGER/MAINTAIN for anon/authenticated/service_role, not
-- SELECT — RLS policies alone don't grant table access, the underlying
-- privilege must exist too. Without this, every PostgREST read 403s with
-- "permission denied for table ..." regardless of policy state. service_role
-- needs it too: Realtime's postgres_changes authorization does its own
-- internal row-visibility check as service_role before per-subscriber RLS is
-- applied, so without this grant EVERY subscriber (any role, any policy) gets
-- back an empty row + "Error 401: Unauthorized" on every change, not just
-- service_role clients.
grant select on public.profiles, public.tools, public.policy_matrix, public.policy_versions, public.audit_events
  to authenticated;
grant select on public.audit_events to service_role;

alter publication supabase_realtime add table public.audit_events;
