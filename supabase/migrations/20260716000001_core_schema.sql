create type public.user_role as enum ('admin','manager','employee');
create type public.data_category as enum ('public','internal','confidential','restricted');
create type public.matrix_action as enum ('allow','warn','block');
create type public.continuity_status as enum ('active','advisory','suspended');
create type public.event_direction as enum ('prompt','response','system');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  department text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.tools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  vendor text not null,
  domains text[] not null,
  tier smallint not null check (tier in (0,1,2)),
  capability_tags text[] not null default '{}',
  dpa_status text not null default 'none',
  continuity_status public.continuity_status not null default 'active',
  continuity_note text,
  fallback_tool_id uuid references public.tools(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employee_tokens (
  token text primary key,
  profile_id uuid references public.profiles(id),
  pseudonym text not null unique,
  department text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.policy_matrix (
  data_category public.data_category not null,
  tier smallint not null check (tier in (0,1,2)),
  action public.matrix_action not null,
  updated_at timestamptz not null default now(),
  primary key (data_category, tier)
);

create table public.policy_versions (
  version bigint generated always as identity primary key,
  reason text not null,
  bumped_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  seq bigint not null unique,
  employee_pseudonym text,
  department text,
  tool_id uuid references public.tools(id),
  tool_domain text,
  direction public.event_direction not null,
  event_type text not null,
  data_category public.data_category,
  matrix_action public.matrix_action,
  pattern_types text[] not null default '{}',
  masked_excerpt text,
  degraded boolean not null default false,
  prev_hash text not null,
  row_hash text not null,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events (created_at desc);
create index audit_events_dept_idx on public.audit_events (department);

create table public.coaching_state (
  pseudonym text primary key,
  first_block_shown_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
