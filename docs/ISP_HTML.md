# Hybrid ISP — HTML-site implementation

This is the **standalone HTML edition** of the TeknTandao hybrid ISP architecture and operations experience. The **Flutter implementation remains in [TeknTandao-Workspace](https://github.com/chrisndirangu54/TeknTandao-Workspace)** and is not replaced by this website.

## Pages

- [ISP service page](../isp.html): existing premises-Wi-Fi service copy, now with an architecture preview and link.
- [Standalone hybrid architecture](../isp-architecture.html): responsive technical overview.
- [Network topology SVG](../assets/isp/architecture.svg): self-contained, accessible vector diagram.
- [HTML admin dashboard](../admin.html): adds an ISP operations section to the existing commerce-admin experience, visible only after signed-in admin role confirmation.
- [HTML admin client](../assets/js/isp-admin.js): reads/writes the ISP management endpoint.
- [HTML backend](../functions/isp_html.js): `adminIspOperations` HTTP function via `/api/adminIspOperations`.

## Security and boundaries

All ISP **writes** run through the HTTP Cloud Function, which verifies Firebase ID tokens (with revocation checks) and requires the existing `role: admin` custom claim. The UI does not store administrative credentials. Firestore rules in this repository deny direct browser reads/writes of the ISP collections. Creation/status updates write an audit document alongside the record.

The HTML site's collections are **separate** from the Flutter Workspace project:
- `htmlIspDevices`
- `htmlIspSubscribers`
- `htmlIspIncidents`
- `htmlIspWorkOrders`
- `htmlIspAudit`

The UI **cannot** provision ONTs, issue PPPoE credentials, execute MikroTik commands, receive real device telemetry, settle M-Pesa subscription payments, or run AI network remediation. Those integrations remain outside scope.

### What the HTML admin page can do

1. Register planned devices, vendor/model/site and optional serial number.
2. Add a planned subscriber with unique account code and plan bandwidth.
3. Report, acknowledge, and resolve incident records.
4. Create, start, and complete technician work orders.
5. Review at most the first 100 documents per collection in this pilot view.

An admin role for this HTML commerce backend is not the same custom claim as the Flutter Workspace's super-admin policy; there is no shared authorization or database synchronization in this change.

## Firebase hosting and deployment

A hosting rewrite for `/api/adminIspOperations` is included in `firebase.json`. The website's `assets/js/site-config.js` must have working Firebase web settings. The existing commerce dashboard uses `functionsBaseUrl` for authentication and its other APIs; that configuration must also work for ISP requests (or leave `functionsBaseUrl` empty if hosting rewrites cover all required APIs).

The source includes a custom-domain `CNAME`. **A GitHub pull request is not a deployment.** If hosting is GitHub Pages rather than Firebase Hosting, the same-origin `/api/adminIspOperations` rewrite is unavailable; configure `functionsBaseUrl` with the approved Cloud Functions base URL and CORS origins appropriately.

Deploy only after checking that the intended Firebase project, custom domain, secrets and project-specific admin claims are correct, and after verifying that editing the HTML site will not alter unrelated commerce integrations.

## Testing checklist

- Load `isp.html`, open the full architecture and inspect the SVG at desktop/mobile sizes.
- Confirm that the site still describes itself as premises Wi-Fi installation when no separate ISP operating authorization has been established.
- Confirm unauthenticated and non-admin requests to `adminIspOperations` return 401/403.
- Confirm duplicate subscriber account codes fail, including different casing.
- Confirm only allowed incident/work-order state transitions succeed.
- Confirm audit entries are written with each administrative mutation.
- Confirm the HTML admin and Flutter Workspace use distinct Firebase projects or document the configuration intentionally before linking production records.
- Confirm the HTML admin page does not display simulated pilot values as live network performance.
