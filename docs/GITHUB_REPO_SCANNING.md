# GitHub source scanning integration — implementation stage

Purpose: charge **KES 5,000 per repository assessment**, limited to one selected repository at an immutable commit SHA. Public and private repositories require explicit permission.

## Security workflow
1. Customer signs in using Firebase Authentication.
2. Customer installs the TeknTandao GitHub App with only Contents:read and Metadata:read permissions on selected repositories. GitHub App credentials and installation tokens never reach the browser.
3. Server validates installation ownership and repository access using GitHub's App APIs, and checks that the chosen repository is included.
4. Customer selects repository and commit, confirms scope, submits the assessment, and pays KES 5,000 using a verified checkout.
5. Only when the payment provider confirms the transaction and the security administrator approves, a privileged scheduler stages the selected immutable commit in a temporary isolated volume.
6. Worker runs Semgrep, Trivy, Gitleaks and Checkov using pinned versions with resource limits, egress restrictions, data retention policy and no customer-provided shell commands.
7. Normalize scanner output, redact any leaked secrets, store tenant-isolated findings, and send approved findings to DefectDojo. AI analysis of private code requires separate consent.
8. Automatically delete temporary source trees and installation tokens after execution.

## Files
- `security-workers/repository-scan.mjs`: local-only scanner adapter; disabled without four explicit gates.
- `security-workers/repository-scan.Dockerfile`: non-root scaffold, does not install scanners and cannot scan without controlled provisioning.

## Still not built
GitHub App installation callback and cryptographic validation, installation token minting, private clone staging, scheduler, durable job ledger, server-enforced payment-to-commit association, secure secrets storage, worker egress policy, scanner artifact version pinning, ingestion, testing, and production deployment. Environment variables on a worker are *not* a trustworthy authorization boundary unless exclusively set by the privileged scheduler; never expose them to users.

## Production requirements
Keep all repositories private and temporary; use a dedicated server with isolated build/scan networks. Disable accidental uploads to AI/cloud services. No scan should begin from UI input alone.
