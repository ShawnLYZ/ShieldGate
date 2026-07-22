alter table public.approval_requests enable row level security;
alter table public.vendor_signals enable row level security;

create policy approvals_select on public.approval_requests for select to authenticated
  using (
    public.current_role() = 'admin'
    or (public.current_role() = 'manager' and department = public.current_department())
    or (public.current_role() = 'employee' and requested_by_profile = auth.uid())
  );

create policy vendor_signals_admin on public.vendor_signals for select to authenticated
  using (public.current_role() = 'admin');

grant select on public.vendor_signals to authenticated;
grant select on public.approval_requests to authenticated;
grant select on public.approval_requests to service_role;

alter publication supabase_realtime add table public.approval_requests;
