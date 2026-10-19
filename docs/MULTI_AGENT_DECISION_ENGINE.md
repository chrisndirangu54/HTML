# TeknTandao multi-engine security evaluation

Seven framework integrations are **registered, not deployed**. PentAGI, HexStrike AI, Strix and Shannon are modeled as assessment engines; DefectDojo and Faraday are **management platforms**; OWASP secureCodeBox is an orchestration layer. They do not all independently discover vulnerabilities.

## Normalized findings contract
Every adapter must return bounded JSON records with `engine`, `asset`, `ruleId` (CVE/CWE/tool rule), `location`, `title`, `severity`, `confidence`, `validated`, `evidenceRef`, and `sourceRunId`. Never include secrets, exploit payloads, raw private source code, credentials or customer PII in outputs.

## Decision policy
Group identical asset + rule + location. Corroboration requires at least two distinct *observation* engines, excluding DefectDojo, Faraday and secureCodeBox, since management re-imports are not independent discoveries. Evidence-validated findings need independent verifiable proof, not a self-asserted agent answer. Disagreeing severity assessments are flagged for analyst review. AI-reported confidence is contextual, **not** a probability of truth. Do not automatically launch remediation, exploitation or escalation based on consensus.

## Seven connector interfaces
- PentAGI: structured assessment results; sandboxed and explicitly authorized API access
- HexStrike AI: MCP security-tool orchestrator; least privilege and approved tool allowlist
- Strix: application vulnerability analysis and validation; strict approved web targets
- Shannon: source-aware web/API assessment; explicit consent before analyzing private code
- DefectDojo: create/update engagements and ingest normalized findings; do not count imported duplicates as independent evidence
- Faraday: vulnerability management synchronization; prevent loops and duplicates
- OWASP secureCodeBox: Kubernetes scanner jobs; validate manifests and isolate per tenant

Each integration should be implemented using supported, pinned upstream APIs and reviewed independently. Credentials belong in server-side Secret Manager, never Firebase Hosting or client-side JavaScript.

## Blocking work
No working engine API integrations, deployed models, API credentials, scanning containers, queue workers, provider-side consent or real cross-engine benchmark results exist yet. In addition to unit tests, production requires integration tests, robust multi-tenant storage, engine failure handling, cost limits, audit logs and human confirmation. This module compares supplied normalized results; it does **not** evaluate real agent outputs or scan customer targets.
