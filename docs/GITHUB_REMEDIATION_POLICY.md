# Continuous monitoring and remediation policy

## Monitoring
Daily passive HTTPS observations are opt-in and require an active prepaid period, a verified DNS TXT ownership token, and two independent operator-controlled activation gates. Initial checks include HTTPS response, HSTS and CSP; no intrusive probing. Checks must stay disabled until worker SSRF hardening, deployment verification, and customer consent are tested. Daily processing is bounded to 50 subscriptions and records are tenant-owned. Current implementation does not email notifications or perform code scanning.

## Code recommendations
Dependabot opens dependency update pull requests for JavaScript packages and GitHub Actions. The dependency review workflow flags high-severity dependency changes. Human reviewers can compare the proposed code diff, impact, tests and authorization scope.

## Merge and permissions
NO automatic granting of GitHub App permissions, organization approval, GitHub Actions secret access, or merging arbitrary security fixes. Automated merging must be a separately configured policy for strictly identified low-risk changes after passing required status checks and branch protection. This repository does not enable automatic merging. A verified asset/domain does not authorize repository writes. GitHub App can remain read-only for scanning; use a separate, explicitly installed remediation App with Contents and PR permissions for submitting suggestions.

## Still required
Safe DNS pinning/redirect policy and SSRF testing; TLS expiry checks; webhook payment reconciliation; customer notifications and cancellation; protected deployment gates; one-per-period audit scheduling and run deduplication; full repository agent adapters; retention and consent policy; and tested remediation PR creation through a dedicated GitHub App.
