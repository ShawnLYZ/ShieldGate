create type public.request_status as enum
  ('submitted','triaged','under_review','info_requested','approved','rejected','auto_rejected');
create type public.sla_state as enum ('on_track','at_risk','breached');

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  tool_name text not null,
  tool_url text,
  requested_by_profile uuid references public.profiles(id),
  requested_by_pseudonym text,
  department text not null,
  purpose text not null,
  status public.request_status not null default 'submitted',
  risk_score smallint,
  risk_signals jsonb not null default '{}',
  recommended_tier smallint,
  assigned_tier smallint,
  manager_decision text,        -- approve | reject | info | null
  manager_reviewer uuid references public.profiles(id),
  manager_decided_at timestamptz,
  admin_decision text,
  admin_reviewer uuid references public.profiles(id),
  admin_decided_at timestamptz,
  info_request_note text,
  sla_due_at timestamptz not null,
  sla_state public.sla_state not null default 'on_track',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index approval_requests_dept_idx on public.approval_requests (department);
create index approval_requests_status_idx on public.approval_requests (status);

create table public.vendor_signals (
  vendor text primary key,
  domain text not null,
  soc2 boolean not null default false,
  iso27001 boolean not null default false,
  dpa_published boolean not null default false,
  breach_history_count smallint not null default 0,
  consumer_free_tier boolean not null default false,
  enterprise_offering boolean not null default false
);
