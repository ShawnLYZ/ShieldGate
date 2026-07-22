#!/usr/bin/env bash
set -euo pipefail
curl -s -X POST http://127.0.0.1:8000/api/v1/decisions \
  -H "X-Internal-Key: ${DECISION_API_KEY:-test-internal-key}" -H "content-type: application/json" \
  -d '{"subject_ref":"SUBJ-DEMO","system_name":"AI Ticket Triage","model_used":"llama-3.3-70b","explanation_text":"Ticket ranked lower urgency because its description matched known self-serve resolutions."}'
