create type public.appeal_status as enum ('open','in_review','resolved');
create type public.shadow_status as enum ('new','under_review','promoted','dismissed');
create type public.watch_status as enum ('new','reviewed','dismissed');

create table public.decision_registrations (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique,           -- DR-YYYY-NNNNNN
  subject_ref text not null,                 -- pseudonymized, caller-supplied
  system_name text not null,
  model_used text not null,
  explanation_text text not null check (length(explanation_text) >= 20),
  decided_at timestamptz not null default now()
);

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique,           -- AP-YYYY-NNNNNN
  decision_id uuid not null references public.decision_registrations(id),
  reason text not null,
  status public.appeal_status not null default 'open',
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.shadow_candidates (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  source text not null default 'idp_log',
  first_seen date not null,
  last_seen date not null,
  user_count integer not null default 0,
  status public.shadow_status not null default 'new',
  promoted_request_id uuid references public.approval_requests(id),
  created_at timestamptz not null default now()
);

create table public.provenance_records (
  id uuid primary key default gen_random_uuid(),
  public_ref text not null unique,           -- PV-YYYY-NNNNNN
  content_hash text not null,
  tool_id uuid references public.tools(id),
  tool_label text,
  employee_pseudonym text,
  created_at timestamptz not null default now()
);
create index provenance_hash_idx on public.provenance_records (content_hash);

create table public.watch_items (
  id uuid primary key default gen_random_uuid(),
  source text not null,                      -- eu_ai_act | edpb | pdpa
  title text not null,
  url text not null unique,
  published_at timestamptz,
  matched_tags text[] not null default '{}',
  status public.watch_status not null default 'new',
  created_at timestamptz not null default now()
);
