import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  zApprovalStatus, zClassifyMatch, zClassifyRequest, zClassifyResponse,
  zEventBatch, zEventIn, zMatrixCell, zPolicySnapshot, zSnapshotTool,
} from "./index";

const root = z.object({
  MatrixCell: zMatrixCell, SnapshotTool: zSnapshotTool, PolicySnapshot: zPolicySnapshot,
  ClassifyMatch: zClassifyMatch, ClassifyRequest: zClassifyRequest,
  ClassifyResponse: zClassifyResponse, EventIn: zEventIn, EventBatch: zEventBatch,
  ApprovalStatus: zApprovalStatus,
});
const schema = zodToJsonSchema(root, { name: "ShieldGatePolicy", $refStrategy: "none" });
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "schema", "policy.schema.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(schema, null, 2) + "\n");
console.log(`wrote ${out}`);
