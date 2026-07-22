-- Follow-ups Batch-2 commitment, review-2 Important #5a (design §2 RLS model):
-- employees read their OWN coaching_state; admins read all (governance table).
--
-- The pseudonym mapping lives in employee_tokens, which no client role may read
-- (pseudonymization: monitoring must not double as surveillance). A SECURITY
-- DEFINER set-returning helper exposes only the *caller's own* pseudonyms —
-- set-returning because one profile may hold several tokens.
create or replace function public.current_pseudonyms() returns setof text
language sql stable security definer set search_path = public as
$$ select pseudonym from public.employee_tokens where profile_id = auth.uid() $$;

create policy coaching_own on public.coaching_state for select to authenticated
  using (pseudonym in (select public.current_pseudonyms()));
create policy coaching_admin on public.coaching_state for select to authenticated
  using (public.current_role() = 'admin');

-- RLS policies gate rows, not table access — the base privilege must exist too
-- (see 20260716000002 for why Supabase's default privileges don't cover SELECT).
grant select on public.coaching_state to authenticated;
