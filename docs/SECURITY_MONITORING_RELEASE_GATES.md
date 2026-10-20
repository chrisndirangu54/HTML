# Production validation gates for KES 2,500 security monitoring

## Implemented in this PR
- Per-asset prepaid entitlement checks, Paystack signed webhook and provider transaction verification
- User pause/cancel and email notification opt-in/out
- DNS ownership TXT revalidation and DNS-pinned passive TLS checks
- Bounded daily job IDs; persisted observations and change-alert records
- Scheduled email dispatcher using Resend, API-key Secret Manager binding, capped retries, stale-lease recovery and per-alert idempotency keys
- Dependabot security-update PR proposals and dependency-review CI; no automatic authorization changes

## Before enabling real payments or scheduled network requests
1. Set `SECURITY_ALERT_EMAIL_API_KEY` in Firebase Secret Manager; set `SECURITY_ALERT_FROM_EMAIL` to a verified domain sender. Leave `SECURITY_EMAIL_DELIVERY_ENABLED` false until delivery is tested.
2. Test Paystack transaction initialization, signed webhook and verify API in sandbox, including replay, amount mismatch, customer mismatch, expired subscriptions and refunds/chargebacks.
3. Deploy on an **isolated VPC/worker** with enforced egress allowlist and no access to metadata endpoints, internal networks, Kubernetes control plane or Firestore admin endpoints. Application-level IP checks alone are not a substitute for a network-level firewall.
4. Test DNS A/AAAA changes, malicious redirects, valid/expired TLS, IPv6 embedded IPv4 addresses, strict parser limits, response errors, timeouts and rate limiting on controlled infrastructure.
5. Configure logs, billing alerts, retry and alert-delivery observability; ensure monitoring stops after cancellation and expiration.
6. Run Firebase Emulator tests for Firestore transactions, ID tokens and security rules; run actual staging runs on a domain the account holder controls.
7. Build a billing and cancellation UI and export/delete flow, plus a customer-facing security monitoring status dashboard.
8. Only then set `SECURITY_MONITOR_EXECUTION_ENABLED=true`, activate reviewed entitlements and enable `SECURITY_MONITORING_CHECKOUT_ENABLED=true`.

This is not a production readiness certification or proof that end-to-end tests passed. GitHub permission grants and auto-merging security-sensitive fixes always require administrator approval.
