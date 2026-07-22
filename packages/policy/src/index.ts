import { z } from "zod";
export { PATTERN_DEFS, type PatternDef } from "./patterns";

export const zDataCategory = z.enum(["public", "internal", "confidential", "restricted"]);
export const zToolTier = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export const zMatrixAction = z.enum(["allow", "warn", "block"]);

export const CATEGORY_SEVERITY: Record<z.infer<typeof zDataCategory>, number> =
  { public: 0, internal: 1, confidential: 2, restricted: 3 };

export const zMatrixCell = z.object({
  data_category: zDataCategory, tier: zToolTier, action: zMatrixAction,
});

export const zSnapshotTool = z.object({
  id: z.string(), name: z.string(), domains: z.array(z.string()),
  tier: zToolTier, capability_tags: z.array(z.string()),
  continuity_status: z.enum(["active", "advisory", "suspended"]),
  fallback_tool_id: z.string().nullable(),
});

export const zPolicySnapshot = z.object({
  version: z.number().int(), generated_at: z.string(),
  matrix: z.array(zMatrixCell), tools: z.array(zSnapshotTool),
});

export const zClassifyMatch = z.object({
  type: z.string(), span: z.tuple([z.number().int(), z.number().int()]),
  masked: z.string(),
});

export const zClassifyRequest = z.object({
  direction: z.enum(["prompt", "response"]),
  text: z.string().min(1),
  tool_domain: z.string(),
  url: z.string().optional(),
  client_matches: z.array(z.string()).default([]),
  policy_version: z.number().int().nullable().default(null),
});

export const zClassifyResponse = z.object({
  category: zDataCategory,
  action: zMatrixAction,
  matches: z.array(zClassifyMatch),
  maskable: z.boolean(),
  reason_plain: z.string(),
  coaching: z.object({ show: z.boolean() }),
  suggestion: z.object({ tool_id: z.string(), name: z.string(), domain: z.string() }).nullable(),
  policy_version: z.number().int(),
  degraded: z.boolean(),
});

// Approval workflow FSM states (design §4 lists these among the package's
// contents; §7 defines the machine). Kept label-for-label identical to the SQL
// request_status enum — the backend consistency test pins that.
export const zApprovalStatus = z.enum([
  "submitted", "triaged", "under_review", "info_requested",
  "approved", "rejected", "auto_rejected",
]);

export const zEventIn = z.object({
  event_type: z.string(),
  direction: z.enum(["prompt", "response", "system"]),
  tool_domain: z.string().nullable().default(null),
  data_category: zDataCategory.nullable().default(null),
  matrix_action: zMatrixAction.nullable().default(null),
  pattern_types: z.array(z.string()).default([]),
  masked_excerpt: z.string().nullable().default(null),
  degraded: z.boolean().default(false),
  occurred_at: z.string().nullable().default(null),
});
export const zEventBatch = z.object({ events: z.array(zEventIn).min(1).max(200) });

export type ApprovalStatus = z.infer<typeof zApprovalStatus>;
export type DataCategory = z.infer<typeof zDataCategory>;
export type ToolTier = z.infer<typeof zToolTier>;
export type MatrixAction = z.infer<typeof zMatrixAction>;
export type MatrixCell = z.infer<typeof zMatrixCell>;
export type SnapshotTool = z.infer<typeof zSnapshotTool>;
export type PolicySnapshot = z.infer<typeof zPolicySnapshot>;
export type ClassifyMatch = z.infer<typeof zClassifyMatch>;
export type ClassifyRequest = z.infer<typeof zClassifyRequest>;
export type ClassifyResponse = z.infer<typeof zClassifyResponse>;
export type EventIn = z.infer<typeof zEventIn>;
export type EventBatch = z.infer<typeof zEventBatch>;
