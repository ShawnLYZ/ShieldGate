export interface IncidentRow {
  id: string; seq: number; employee_pseudonym: string | null; department: string | null;
  tool_id: string | null; tool_domain: string | null; direction: string; event_type: string;
  data_category: string | null; matrix_action: string | null;
  pattern_types: string[]; masked_excerpt: string | null; degraded: boolean; created_at: string;
}

// Matches public.approval_requests (supabase/migrations/20260717000001_approvals_and_settings.sql).
export interface ApprovalRequestRow {
  id: string;
  tool_name: string;
  tool_url: string | null;
  requested_by_profile: string | null;
  requested_by_pseudonym: string | null;
  department: string;
  purpose: string;
  status: "submitted" | "triaged" | "under_review" | "info_requested" | "approved" | "rejected" | "auto_rejected";
  risk_score: number | null;
  risk_signals: Record<string, unknown>;
  recommended_tier: number | null;
  assigned_tier: number | null;
  manager_decision: string | null;
  manager_reviewer: string | null;
  manager_decided_at: string | null;
  admin_decision: string | null;
  admin_reviewer: string | null;
  admin_decided_at: string | null;
  // Joined by the backend list/export (GET /api/v1/approvals), not table columns —
  // RLS hides other users' profile rows, so clients can't resolve names themselves.
  manager_reviewer_name?: string | null;
  admin_reviewer_name?: string | null;
  info_request_note: string | null;
  sla_due_at: string;
  sla_state: "on_track" | "at_risk" | "breached";
  created_at: string;
  updated_at: string;
}

// Matches public.shadow_candidates (RLS admin-readable).
export interface ShadowCandidateRow {
  id: string;
  domain: string;
  source: string;
  first_seen: string;
  last_seen: string;
  user_count: number;
  status: "new" | "under_review" | "promoted" | "dismissed";
  promoted_request_id: string | null;
  created_at: string;
}

// Matches public.watch_items (RLS admin-readable).
export interface WatchItemRow {
  id: string;
  source: string;
  title: string;
  url: string;
  published_at: string | null;
  matched_tags: string[];
  status: "new" | "reviewed" | "dismissed";
  created_at: string;
}

// Matches public.tools (RLS: any authenticated may read).
export interface ToolRow {
  id: string;
  name: string;
  vendor: string;
  domains: string[];
  tier: number;
  capability_tags: string[];
  dpa_status: string;
  continuity_status: "active" | "advisory" | "suspended";
  continuity_note: string | null;
  fallback_tool_id: string | null;
  created_at: string;
  updated_at: string;
}

// Matches public.policy_matrix (RLS: any authenticated may read).
export interface PolicyMatrixCell {
  data_category: "public" | "internal" | "confidential" | "restricted";
  tier: number;
  action: "allow" | "warn" | "block";
  updated_at: string;
}

export interface DecisionRegistrationRow {
  public_ref: string;
  system_name: string;
  model_used: string;
  decided_at: string;
}

export interface AppealRow {
  id: string;
  public_ref: string;
  decision_ref: string;
  reason: string;
  status: "open" | "in_review" | "resolved";
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}
