-- Demo auth users (password: shieldgate-demo)
-- Note: confirmation_token/recovery_token/email_change_token_new/email_change have no
-- column default in auth.users (unlike phone_change_token etc., which default to '').
-- Leaving them NULL makes GoTrue's Go driver fail to scan the row on password grant
-- ("converting NULL to string is unsupported") -> every login 500s. Set them to ''.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@shieldgate.demo', extensions.crypt('shieldgate-demo', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager@shieldgate.demo', extensions.crypt('shieldgate-demo', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','employee@shieldgate.demo', extensions.crypt('shieldgate-demo', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}','{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u where u.email like '%@shieldgate.demo';

insert into public.profiles (id, role, department, display_name) values
  ('00000000-0000-0000-0000-0000000000a1','admin','Engineering','Demo Admin'),
  ('00000000-0000-0000-0000-0000000000a2','manager','Engineering','Demo Manager'),
  ('00000000-0000-0000-0000-0000000000a3','employee','Engineering','Demo Employee');

-- Tool Registry (mock page is Tier 0 so the money path blocks on it)
insert into public.tools (name, vendor, domains, tier, capability_tags, dpa_status) values
  ('ChatGPT','OpenAI', array['chatgpt.com','chat.openai.com'], 1, array['chat','code','drafting'], 'partial'),
  ('Claude','Anthropic', array['claude.ai'], 2, array['chat','code','drafting','analysis'], 'signed'),
  ('Gemini','Google', array['gemini.google.com'], 1, array['chat','drafting'], 'partial'),
  ('Mock AI Chat','ShieldGate Demo', array['localhost:5175','127.0.0.1:5175'], 0, array['chat'], 'none'),
  -- Self-registration: ShieldGate's own local-inference classifier, registered in its own
  -- Tool Registry (governance applied to the product itself). Empty domains: it isn't a
  -- chat site, no adapter ever matches it. Tier 0 plus a capability tag distinct from
  -- chat/code/drafting/analysis keeps it out of "try this instead" twice over — suggest.py
  -- already filters tier >= 1.
  ('ShieldGate Classifier','Self-hosted', array[]::text[], 0, array['classification'], 'not applicable');

-- Story-30 fallback demo: if ChatGPT is continuity-suspended, direct users to the
-- tier-0 Mock AI Chat as a still-usable fallback (gives the fallback UI a data path).
update public.tools
   set fallback_tool_id = (select id from public.tools where name = 'Mock AI Chat')
 where name = 'ChatGPT';

-- Employee tokens (pseudonymized; first one is the extension default)
insert into public.employee_tokens (token, profile_id, pseudonym, department) values
  ('sg-emp-demo-001','00000000-0000-0000-0000-0000000000a3','EMP-D3A1','Engineering'),
  ('sg-emp-demo-002', null,'EMP-7C42','Engineering'),
  ('sg-emp-demo-003', null,'EMP-9B10','Finance'),
  ('sg-emp-demo-004', null,'EMP-2E8F','Finance'),
  ('sg-emp-demo-005', null,'EMP-5A67','HR'),
  ('sg-emp-demo-006', null,'EMP-C214','HR'),
  ('sg-emp-demo-007', null,'EMP-11FD','Marketing'),
  ('sg-emp-demo-008', null,'EMP-8E03','Marketing');

-- Policy Matrix seed — verbatim ShieldGate.md §4.3
insert into public.policy_matrix (data_category, tier, action) values
  ('public',0,'allow'), ('public',1,'allow'), ('public',2,'allow'),
  ('internal',0,'block'), ('internal',1,'allow'), ('internal',2,'allow'),
  ('confidential',0,'block'), ('confidential',1,'warn'), ('confidential',2,'allow'),
  ('restricted',0,'block'), ('restricted',1,'block'), ('restricted',2,'warn');

insert into public.policy_versions (reason) values ('initial seed');

-- Vendor signals: ~20 AI vendors with plausible public compliance signals
insert into public.vendor_signals (vendor, domain, soc2, iso27001, dpa_published, breach_history_count, consumer_free_tier, enterprise_offering) values
  ('OpenAI','openai.com', true, true, true, 1, true, true),
  ('Anthropic','anthropic.com', true, true, true, 0, true, true),
  -- Anthropic's product domain (claude.ai) differs from its corporate domain
  -- (anthropic.com); score_vendor matches by domain-substring or name-token, so
  -- approval requests naming "Claude" against https://claude.ai need their own row.
  ('Claude','claude.ai', true, true, true, 0, true, true),
  ('Google','google.com', true, true, true, 0, true, true),
  ('Perplexity','perplexity.ai', false, false, false, 0, true, false),
  ('Midjourney','midjourney.com', false, false, false, 0, true, false),
  ('Mistral','mistral.ai', false, true, true, 0, true, true),
  ('Cohere','cohere.com', true, true, true, 0, false, true),
  ('Hugging Face','huggingface.co', true, false, true, 1, true, true),
  ('Stability AI','stability.ai', false, false, false, 0, true, false),
  ('Character.AI','character.ai', false, false, false, 0, true, false),
  ('Meta','meta.com', true, true, true, 2, false, true),
  ('Microsoft','microsoft.com', true, true, true, 1, true, true),
  ('AWS','aws.amazon.com', true, true, true, 0, true, true),
  ('AI21','ai21.com', true, true, true, 0, true, true),
  ('Together AI','together.ai', true, true, true, 0, true, true),
  ('Replicate','replicate.com', true, false, true, 0, true, true),
  ('Runway','runwayml.com', false, false, false, 0, true, false),
  ('Synthesia','synthesia.io', false, true, true, 0, false, true),
  ('ElevenLabs','elevenlabs.io', false, false, false, 0, true, true),
  ('Jasper','jasper.ai', true, false, false, 0, true, true);

-- Cost model and risk weights settings
insert into public.app_settings (key, value) values
  ('cost_model', jsonb_build_object(
     'per_record_cost', 169,
     'records_at_risk', jsonb_build_object('restricted', 500, 'confidential', 100, 'internal', 10, 'public', 0),
     'action_multiplier', jsonb_build_object('block', 1.0, 'warn', 0.25, 'allow', 0.0))),
  ('risk_weights', jsonb_build_object(
     'soc2', 25, 'iso27001', 15, 'dpa_published', 30, 'clean_breach_history', 15, 'enterprise_offering', 15));

-- Sample historical approval requests for demo/testing
insert into public.approval_requests (id, tool_name, tool_url, requested_by_profile, requested_by_pseudonym, department, purpose, status, risk_score, risk_signals, recommended_tier, assigned_tier, manager_decision, manager_reviewer, manager_decided_at, admin_decision, admin_reviewer, admin_decided_at, sla_due_at, sla_state, created_at, updated_at) values
  (gen_random_uuid(), 'ChatGPT', 'https://chatgpt.com', '00000000-0000-0000-0000-0000000000a3', 'EMP-D3A1', 'Engineering', 'Code generation and debugging assistance', 'approved', 35, '{"soc2": true, "iso27001": true}'::jsonb, 0, 1, 'approve', '00000000-0000-0000-0000-0000000000a2', now() - interval '2 days', 'approve', '00000000-0000-0000-0000-0000000000a1', now() - interval '1 day', now() - interval '1 day', 'on_track', now() - interval '5 days', now() - interval '1 day'),
  (gen_random_uuid(), 'Midjourney', 'https://midjourney.com', null, 'EMP-9B10', 'Finance', 'Generate marketing materials and charts', 'rejected', 72, '{"consumer_free_tier": true, "enterprise_offering": false, "soc2": false}'::jsonb, 2, null, 'reject', '00000000-0000-0000-0000-0000000000a2', now() - interval '3 days', 'reject', '00000000-0000-0000-0000-0000000000a1', now() - interval '2 days', now() - interval '2 days', 'on_track', now() - interval '6 days', now() - interval '2 days'),
  (gen_random_uuid(), 'Claude', 'https://claude.ai', null, 'EMP-5A67', 'HR', 'Analyze employee survey feedback and generate insights', 'triaged', 28, '{"dpa_published": true, "iso27001": true}'::jsonb, 0, 2, null, null, null, null, null, null, now() + interval '2 days', 'on_track', now() - interval '1 day', now() - interval '1 day'),
  (gen_random_uuid(), 'Cohere', 'https://cohere.com', null, 'EMP-8E03', 'Marketing', 'Content generation and copywriting for campaigns', 'under_review', 45, '{"soc2": true, "iso27001": true, "enterprise_offering": true}'::jsonb, 1, null, 'approve', '00000000-0000-0000-0000-0000000000a2', now() - interval '1 day', null, null, null, now() + interval '3 days', 'on_track', now() - interval '3 hours', now() - interval '3 hours');

-- Regulatory watch feed sources
insert into public.app_settings (key, value) values
  ('watch_feeds', jsonb_build_object('feeds', jsonb_build_array(
     jsonb_build_object('source','eu_ai_act','url','https://artificialintelligenceact.eu/feed/'),
     jsonb_build_object('source','edpb','url','https://www.edpb.europa.eu/feed_en.xml'))));

insert into public.decision_registrations (public_ref, subject_ref, system_name, model_used, explanation_text) values
  ('DR-2026-000001','SUBJ-9F2A','Support Ticket Triage','llama-3.3-70b',
   'AI ranked this ticket as lower urgency based on the described issue matching known self-serve resolutions.');

insert into public.appeals (public_ref, decision_id, reason, status, resolution_note, resolved_at)
select 'AP-2026-000001', id, 'I believe my issue is urgent and was misclassified.', 'resolved',
       'Reviewed by a human agent; ticket re-prioritized to high.', now()
from public.decision_registrations where public_ref='DR-2026-000001';

insert into public.watch_items (source, title, url, published_at, matched_tags) values
  ('eu_ai_act','EU AI Act: transparency obligations guidance updated',
   'https://example.eu/ai-act/transparency-2026','2026-06-01T00:00:00Z', array['restricted','confidential']),
  ('pdpa','PDPA amendment consultation on automated decision-making',
   'https://example.my/pdpa/adm-2026','2026-05-15T00:00:00Z', array['restricted']);

insert into public.shadow_candidates (domain, source, first_seen, last_seen, user_count, status) values
  ('perplexity.ai','idp_log','2026-07-01','2026-07-14', 14, 'new'),
  ('midjourney.com','idp_log','2026-06-20','2026-07-10', 6, 'new');
