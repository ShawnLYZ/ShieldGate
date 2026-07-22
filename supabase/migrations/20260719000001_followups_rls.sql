-- Phase 3 review follow-up: managers view the regulatory watch list in the dashboard
-- alongside admins. Multiple permissive policies OR together, so this grants manager
-- read without altering the existing admin policy (migrations stay additive).
create policy watch_manager on public.watch_items for select to authenticated
  using (public.current_role() = 'manager');
