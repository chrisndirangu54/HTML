# Three-tier monitoring policy (KES 2,500 per 30-day prepaid period)

1. **Daily passive monitoring:** HTTPS availability and security headers for one verified domain. Existing Firebase scheduled check stays disabled pending production staging tests and network egress firewall.
2. **Event-triggered code analysis:** authorized GitHub App repository push events, immutable commit SHA, allowlisted Semgrep/Trivy/Gitleaks/Checkov, debounced and rate-limited. Installation webhook handling must cryptographically verify payloads and establish selected repository scope. Read-only analysis; no arbitrary shell commands or automatic code changes. This stage is POLICY ONLY, not event-queue integration.
3. **Periodic deeper assessment:** at most one separately authorized and operator-approved deeper engagement in each 30-day subscription period. Scope/time limits and rules of engagement required. PentAGI, HexStrike, Strix and Shannon are advisory assessment agents; DefectDojo/Faraday consolidate findings and secureCodeBox coordinates supported jobs. They are NOT installed, configured or running. No automated exploitation or privileged actions from an ordinary subscription.

Pricing KES 2,500 is not a promise of unlimited computationally expensive assessments. Deeper assessments should be scope-limited with separate authorization and may require a separately disclosed charge if not included in the final plan. The existing KES 5,000 one-off assessment remains separately purchasable.

The implementation contains only a testable scheduling/authorization policy, not a live pipeline. It never generates scans or authorizes billing, and does not automatically expand GitHub permissions.
