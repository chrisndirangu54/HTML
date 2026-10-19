# TeknTandao Security Assessment Integration

Status: UI onboarding only. No live security scanners are connected, and this PR intentionally does not expose an unauthenticated remote execution endpoint.

## Existing application
- Firebase Hosting public directory is repository root; Firebase project: `tekntandao`.
- Main site: `cybersecurity.html`; new assessment entry point: `cybersecurity-portal.html`.
- Existing Firebase Functions codebase: `commerce`, `/api/siteAssistant` in `europe-west1`.

## Next backend deployment
1. Set up server-side Firebase ID-token verification, organizational tenant controls, and administrator approvals.
2. Register target assets and verify DNS TXT / HTTP challenge for public domains; require written authorization and authenticated private-agent enrollment for internal networks.
3. Implement `POST /api/security/assessments` (request only; no execution), `GET /api/security/assessments/:id`, and an admin approval endpoint. Enforce tenant ownership, schema validation, idempotency and quotas.
4. Put approved jobs on a private queue. Run scanner workers in isolated containers with explicitly permitted destination ranges, time windows, rate limits, egress rules, non-root identities, short-lived credentials, and logs.
5. Integrate supported scanners (Nuclei, Nmap, Trivy, ZAP) incrementally, then AI agents (PentAGI/HexStrike/Strix) with human approval for intrusive tests. Treat tool output as untrusted input.
6. Normalize findings into DefectDojo and expose filtered per-tenant findings, remediation tickets and exports.
7. Add Firebase App Check, monitoring, retention and deletion controls. Do not expose DefectDojo/PentAGI or scanner admin services directly to public clients.

## Acceptance checks
- HTML form generates a WhatsApp assessment *request*, never executes a scan.
- Copy contains no claims that scanners are running.
- Mobile responsive and accessible labels.
- Existing `cybersecurity.html` design remains unchanged except for a portal link.
- No secrets committed, no live Firebase deployment performed.

## Production release
Run code review, authorization testing, abuse-case testing, billing controls, and a limited trial on assets you own before enabling real scanners.
