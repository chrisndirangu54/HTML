# ISP administration — HTML site

This is the HTML edition of TeknTandao's ISP customer page and administration desks. The Flutter implementation remains in [TeknTandao-Workspace](https://github.com/chrisndirangu54/TeknTandao-Workspace) and is not replaced by this website.

## Who sees what

Everyone can open the customer ISP page. Signed-in people use the same [sign-in page](../login.html). An administrator promotes a customer to `staff` from the admin desk. There is no separate staff password form.

| Role | Own desk | Customer ISP page |
| --- | --- | --- |
| Customer | [account.html](../account.html) for shop orders | [isp.html](../isp.html) |
| ISP staff | [isp-staff.html](../isp-staff.html): incidents and technician work orders, plus read-only equipment and subscriber lists | [isp.html](../isp.html) |
| Administrator | [admin.html](../admin.html): commerce, newsletter, blogs, role promotion, and full ISP administration | [isp.html](../isp.html) |
| Shop attendant | [attendant.html](../attendant.html) | [isp.html](../isp.html) |
| Delivery | [delivery.html](../delivery.html) | [isp.html](../isp.html) |

`isp-architecture.html` only forwards old links. Customers, attendants, and delivery land on `isp.html`. Staff land on the staff desk. Administrators land on the ISP section of the admin desk. The architecture diagram is not shown.

## What each ISP desk can record

Administrators, on the admin page:

1. Register planned devices, vendor, model, site, and an optional serial number.
2. Add a planned subscriber with a unique account code and plan bandwidth.
3. Report, acknowledge, and resolve incident records.
4. Create, start, and complete technician work orders.
5. Promote a user to `staff`, `attendant`, `delivery`, or `admin`.

ISP staff, on the staff desk:

1. Read the same device, subscriber, incident, and work-order lists.
2. Report incidents and update incident status.
3. Create technician work orders and update their status.

ISP staff do not register devices, plan subscribers, change roles, or read shop orders. Shop order APIs stay limited to admin, attendant, and delivery.

The UI cannot provision ONTs, issue PPPoE credentials, execute router commands, receive device telemetry, settle M-Pesa subscription payments, or run automated remediation.

## Security

ISP writes go through the `adminIspOperations` HTTP function. It verifies Firebase ID tokens and allows `role: admin` or `role: staff`, then rejects device registration and subscriber planning for staff. The browser does not store administrative credentials. Firestore rules deny direct browser reads and writes of the ISP collections. Each create or status change writes an audit document.

Collections, separate from the Flutter Workspace project:

- `htmlIspDevices`
- `htmlIspSubscribers`
- `htmlIspIncidents`
- `htmlIspWorkOrders`
- `htmlIspAudit`

Role claims are `customer` (no role claim), `staff`, `attendant`, `delivery`, and `admin`. `adminSetStaffRole` is admin-only and refuses to demote the signed-in administrator.

## Files

- [isp.html](../isp.html) — customer premises Wi-Fi page.
- [isp-staff.html](../isp-staff.html) — staff desk.
- [admin.html](../admin.html) — full administration, including ISP control and role promotion.
- [assets/js/isp-admin.js](../assets/js/isp-admin.js) — ISP desk client.
- [assets/js/role-routes.js](../assets/js/role-routes.js) — which page each role may open after sign-in.
- [functions/isp_html.js](../functions/isp_html.js) and [functions/isp-access.js](../functions/isp-access.js) — `adminIspOperations`.

## Firebase hosting and deployment

A hosting rewrite for `/api/adminIspOperations` is included in `firebase.json`. `assets/js/site-config.js` must have working Firebase web settings. Leave `functionsBaseUrl` empty when hosting rewrites cover the APIs. If the site is served without that rewrite, set `functionsBaseUrl` to the approved Cloud Functions base URL.

**A GitHub pull request is not a deployment.**

## Testing checklist

- Open `isp.html` signed out and signed in as each role. The page stays the customer premises-Wi-Fi page, with no architecture diagram and no administration forms.
- Confirm sign-in is only `login.html`. After sign-in, a customer reaches `account.html`, staff reach `isp-staff.html`, and an admin reaches `admin.html`, unless `next` is a customer page or that role's own desk.
- Confirm a customer or staff member who opens `admin.html` is sent to their own desk, and the admin panels stay hidden.
- Confirm the admin role list includes `staff`, and saving it calls `adminSetStaffRole`.
- Confirm unauthenticated requests to `adminIspOperations` return 401, customers return 403, and staff receive 403 for `registerDevice` and `planSubscriber`.
- Confirm duplicate subscriber account codes fail, including different casing.
- Confirm only allowed incident and work-order transitions succeed.
- Confirm the page does not present these records as live network performance.

## Function deployment is currently blocked (2026-10-20)

GitHub Actions workflow `Deploy isolated ISP admin Cloud Function` reached Firebase project `tekntandao`, but Google Cloud returned:

```
Error: Permissions denied enabling cloudfunctions.googleapis.com.
```

The project is missing at least Cloud Functions, Cloud Build, and Artifact Registry service APIs, and the existing GitHub Actions service account lacks permission to enable them. **Hosting deployments are successful, but do not deploy the `adminIspOperations` backend. ISP management actions in the HTML admin and staff desks must not be described as live until this function successfully deploys.**

An authorized Google Cloud/Firebase project owner should:

1. Confirm the correct Firebase project and active billing plan support for second-generation Cloud Functions.
2. Enable `cloudfunctions.googleapis.com`, `cloudbuild.googleapis.com`, and `artifactregistry.googleapis.com` in the project.
3. Grant the deployment principal the minimum roles needed to deploy Cloud Functions, rather than broad project-owner access.
4. Run the manual workflow `Deploy isolated ISP admin Cloud Function` after those permissions are in place.
5. Test a signed-in administrator, a staff member, a rejected customer, planned device creation, duplicate account-code rejection, and audit history.

Do not paste service-account JSON, router credentials, or payment tokens into chat or GitHub issues.
