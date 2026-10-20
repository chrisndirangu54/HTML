# TeknTandao HTML — Hybrid ISP platform implementation

**Architecture:** Static HTML/CSS/JavaScript with Firebase Authentication and admin-authenticated Cloud Functions + Firestore. This implementation is independent from the **Flutter Workspace**. Repositories do not sync databases automatically. This is not a claim of live ISP licensing, installed equipment or merchant payment processing.

## Pages and entry points

| URL path | Audience | Purpose |
| --- | --- | --- |
| `/isp.html` | Public | Existing premises Wi-Fi page, hybrid ISP overview and navigation |
| `/isp-architecture.html` | Public | Hybrid topology and AI-supported operations concept |
| `/isp-equipment.html` | Public | Lower-cost ONT/CPE evaluation, 10 management requirements, supplier planning costs |
| `/isp-customer.html` | Signed-in verified-email customers | Consent-based fiber survey, wireless survey, Wi-Fi installation and support enquiries |
| `/isp-console.html` | Server-authorized admins | Full ISP administrative dashboard, modules, manual diagnostics, planning and records |
| `/admin.html` | Existing commerce admins | Links to the new ISP console and retains commerce operations |

## HTML feature coverage

The HTML administrator UI exposes every major business and engineering area discussed:

- **Network design** — editable sites, PoPs, splitters, PONs, Ethernet segments, wireless point-to-point links, topology reference diagram, VLAN profiles and route notes.
- **Equipment lifecycle** — model, manufacturer, hardware revision, firmware, PoE class, wired port speeds, management protocol, tracking and retirement approvals.
- **Low-cost customer routers** — separate procurement guidance for Huawei EG8145V5, TP-Link EC220-G5, MikroTik hAP series, VSOL, COMFAST; actual compatibility tests remain essential.
- **Network diagnostics** — manually entered latency, jitter, packet loss, utilization, optical readings and wireless RSSI. No synthetic uptime or pretend live readings.
- **Basic deterministic analytics** — severity scoring, possible shared-segment fault correlation, sample-based capacity assessment; supervised predictive AI is NOT trained.
- **Customer lifecycle** — planned subscriber profiles, service packages, installation planning, customer support classification and consent-based service enquiries.
- **Billing groundwork** — invoice drafts, issuing/voiding invoices and review of unverified payment references. No payment can be marked settled by a manual note or STK request.
- **Incident & field operations** — manual incident logging, acknowledgments/resolution, work orders and technician handover records.
- **Network change governance** — proposed PPPoE/RADIUS/OMCI/GenieACS changes, approved-for-manual-review states, security/VLAN/QoS proposals, firmware maintenance and rollback plans. None of these execute on equipment.
- **Service messaging** — draft outage notices, renewal notices and installation messages. WhatsApp Business templates/consent delivery integration is not live.
- **Procurement and expansion** — inventory sourcing, estimated Kenyan costs, KSh revenue/CAPEX calculator, CA approval and estates/coverage opportunity records.
- **Integration center** — explicitly displays MikroTik, VSOL, COMFAST, GenieACS, FreeRADIUS, M-Pesa Daraja, WhatsApp Business, monitoring and predictive AI as not connected.

## Backend API

`functions/isp_suite.js` exports two HTTP Firebase Functions (region `europe-west1`, codebase `commerce`):

1. `ispSuiteApi` — signed-in admin token with `role:admin`, validated module definitions, GET overview, GET module records, GET customer enquiries, POST create and POST allowed status transitions.
2. `ispCustomerRequest` — any signed-in user with verified email may submit a consent-based site survey or callback enquiry; transactionally rate-limited to three enquiries per user and UTC day.

The existing `adminIspOperations` legacy API is preserved for the earlier HTML management panel; collections for its four original entity types are reused.

No browser-to-Firestore privileged writes. Existing `firestore.rules` continue denying direct client access to the ISP collections. Mutations create auditable, server-attributed records. Strong validation rejects unrecognized properties and invalid enumeration / numeric values.

### Integrity rules

- Subscriber codes are normalized uppercase document IDs.
- Invoice codes and provider/reference pairs use deterministic IDs to prevent accidental duplicates.
- All telemetry and device control records reference an existing registered device.
- Support cases, invoice drafts and provisioning requests refer to registered subscriber codes.
- Claimed payment references require an existing invoice, stay `verified=false`, and can only move through review/rejection states.
- Changes can be `approved_for_manual_review` only, never `executed`.
- Missing telemetry cannot be called healthy; high loss/latency is flagged for human review.
- CSV exports neutralize formula-like content.

## Automated checks

```bash
node --check functions/isp_suite.js
node --check functions/isp_suite_core.js
node --check assets/js/isp-console.js
node --check assets/js/isp-customer.js
node --test functions/isp_suite_core.test.js
```

The commerce CI workflow includes these checks. These tests cover validation and deterministic algorithms, **not** remote hardware compatibility, authenticated Firestore workflows, browser end-to-end tests, M-Pesa callbacks or field deployment.

## Deployment blocker — Google Cloud Functions

Existing HTML Firebase Hosting workflows have deployed static pages, but previous attempts to deploy `adminIspOperations` failed because the service account could not enable `cloudfunctions.googleapis.com` (Cloud Build and Artifact Registry APIs were also missing). This may also block deployment of the two new APIs.

An authorized owner must:

1. Confirm `tekntandao` is the intended Firebase project and that billing/Functions prerequisites are met.
2. Enable the required Cloud Functions, Cloud Build and Artifact Registry APIs, confirm deployment service account's least-privilege roles.
3. Review functions for security and data-protection compliance.
4. Deploy only the intended named-codebase targets after approval:
   `firebase deploy --only functions:commerce:adminIspOperations,functions:commerce:ispSuiteApi,functions:commerce:ispCustomerRequest --project tekntandao`
5. Verify admin authorization, non-admin rejection, rate limits, Firestore collection access, duplicate payment-reference handling, service requests, and audit logging.
6. Configure the HTML site's valid Firebase web settings and verified sign-in method. Existing `assets/js/site-config.js` may need deployment-specific configuration.

Do **not** store Google Cloud service-account keys, RouterOS administrator passwords, M-Pesa production secrets or customer payment PINs in Git.

## External integrations that are NOT commissioned

| System | Blocking input | Safe next stage |
| --- | --- | --- |
| MikroTik | RouterOS version, least-privileged management access, SNMP/API authorization | Isolated read-only collector and topology mapping |
| VSOL GPON / ONT | Exact model, firmware, OMCI profile, optical power budgets | Staging OLT/ONT registration test |
| COMFAST | Model revision, verified MIB/API, transparent VLAN, RF and PoE tests | Field radio link and interoperability pilot |
| GenieACS | Compatible TR-069 parameter model, device credentials and TLS | Provisioning templates and lab firmware recovery |
| FreeRADIUS | AAA policy, PPPoE gateway topology, credentials and accounting plan | Idempotent staging subscriber activation, rollback |
| M-Pesa Daraja | Merchant/shortcode authorization, environment keys, callback configuration | Verified C2B/STK reconciliation and append-only ledger |
| WhatsApp Business | Opt-in, verified account, templates, sender and handoff | Human-reviewed status and renewal notifications |
| Zabbix / Grafana | SNMP/syslog collectors, history retention and device network | Grounded monitoring dashboards and anomaly baselines |
| Predictive ML | Verified timestamped operational data and ground-truth incidents | Backtested forecasting, churn analysis, bias and precision reports |

Hardware procurement must confirm Communications Authority of Kenya requirements, site rights-of-way and applicable radio-frequency regulations.

## Acceptance before calling the suite production ready

- Deployed Cloud Functions and verified role/identity enforcement, with no public unguarded write endpoints.
- Equipment monitoring collectors and customer records independently validated.
- Hosted customer form can submit and rate-limit enquiries.
- ISP operator can create a device, plan subscriber, record sample, acknowledge an incident, prepare invoice, request manual provisioning review and export an authorized report.
- Real network actions, payment settlement, firmware pushes and WhatsApp outbound messages cannot fire without their separately commissioned adapters, operator approval and complete audit.
- This static HTML edition does not silently import customers from Flutter Workspace.

**The initial 50-subscriber topology and KSh 1,029,687 CAPEX are illustrative scenario assumptions, not deployed counts or binding quotations.**
