# TeknTandao continuous security monitoring — KES 2,500 / 30 days

The existing KES 5,000 **one-time assessment** remains distinct from monitoring.

## Included product (proposed)
- One verified domain/asset per monitoring purchase
- Recurring authorized passive checks (TLS certificate expiry, DNS changes, HTTP availability and response-security headers)
- Dependency and code scans only for GitHub repositories separately linked by an authenticated GitHub App, using immutable commits and approved execution jobs
- Change-based alerts and monthly summary after processing
- No intrusive active exploitation, port scanning, password attacks or adversarial agents without additional explicit scoped authorization

## Billing semantics
- KES 2,500 prepaid per 30-day monitoring period for one verified asset.
- Initial implementation uses **manual renewal**, not Paystack automated recurring subscription billing.
- An independently signed Paystack payment success webhook establishes/extends a Firestore entitlement. Duplicate webhook retries are idempotent by payment reference.
- A stored `currentPeriodEnd` gates future monitoring, and no new jobs should run after the entitlement expires. Customers should be offered a renewal reminder and cancellation; there is no automatic rebilling.
- **Checkout is intentionally blocked** until the `SECURITY_MONITORING_CHECKOUT_ENABLED=true` deployment setting is configured following operational validation.
- `monitoringExecutionEnabled` remains false until a scheduler, scope verification, rate controls, data segregation, audit log and worker isolation are operational.

## APIs
Authenticated POST `/api/securityMonitoringCheckout`: `{assetId}`, creates a Paystack checkout only when the feature is enabled.
Signed Paystack POST `/api/securityMonitoringWebhook`: validates HMAC, amount, currency and payment reference and extends the prepaid 30-day entitlement.
Authenticated GET `/api/securityMonitoringStatus?assetId=...`: reflects active/expired entitlement; `monitoringOperational` stays false.

## Launch blockers
Implement safe scheduled monitors, customer notification preferences, billing reconciliation directly against Paystack, webhook event identification, retry/backoff, cancellation flow, monitoring data retention, renewal notices, tests, and the customer portal. Run end-to-end trials on owned or explicitly authorized test assets before enabling checkout.
