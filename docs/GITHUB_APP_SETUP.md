# Setup — TeknTandao GitHub App

**Not deployed / not yet configured.** The connector code requires an actual GitHub App, Firebase auth config, and deployment privileges. It grants no scan execution capability.

1. In GitHub Developer Settings → GitHub Apps → New GitHub App, register a dedicated `tekntandao-security` app (choose a unique slug). Homepage: `https://tekntandao.web.app/cybersecurity-portal.html`. Setup URL: `https://tekntandao.web.app/github-connect.html`; enable Redirect on update. Select install on any account only if intended.
2. Permissions: Repository **Metadata: read** (mandatory); **Contents: read**. No write permissions, no organization permissions. Prefer installation-level **Only select repositories**.
3. Obtain the App ID and download a private key. Configure Firebase Functions `GITHUB_SECURITY_APP_ID` and `GITHUB_SECURITY_APP_SLUG` string params; store the PEM privately as Secret Manager `GITHUB_SECURITY_APP_PRIVATE_KEY`. Never commit or return keys.
4. Update Firebase public web configuration in `assets/js/site-config.js` with correct public Firebase project credentials; current values are placeholders. Enable a supported Firebase Authentication sign-in method. This is unrelated to the GitHub App secret.
5. Deploy `securityGithubApp` and Hosting only after security review, tests, and confirming IAM permissions; the function is HTTP-public but every operation verifies the user's Firebase ID token.
6. Verify installation flows, replay resistance, ownership, permissions and private repository selection with test GitHub accounts. Confirm expiry of 10-minute state tokens.
7. Add installation webhook signature verification and uninstallation revocation processing before releasing to customers. GitHub App callbacks require a signed-in session for matching the state.

## API
- POST `/api/security-github/start`: creates random per-user one-time state and returns GitHub installation URL.
- POST `/api/security-github/complete`: atomically consumes state and checks installation via GitHub App APIs.
- GET `/api/security-github/repositories?installationId=...`: lists repositories through a short-lived installation access token. First page (100) only.

This is a **connector authorization milestone**. No repository cloning, secret scanning, paid scan scheduling, or PentAGI deployment is activated. Authorization to read repositories is not authorization to run active security tests.

## Current authentication constraint (October 2026)
Only **personal** GitHub installations are supported by the completion endpoint. The signed-in Firebase user must possess a `github.com` Firebase identity whose GitHub numeric user ID matches the installation owner. Organization installations are intentionally rejected pending secure organization-admin verification. The GitHub App must also have an `installation` webhook set to `https://tekntandao.web.app/api/securityGithubWebhook` with the `GITHUB_SECURITY_WEBHOOK_SECRET` secret. Any deleted/suspended installation is marked revoked in Firestore.

## No live deployment
The repository connector, webhook and scanner adapter remain untested in a running environment. A functioning deployment still requires registered GitHub App credentials, configured Firebase Auth with GitHub login, webhook setup, Firebase deployment authority, worker infrastructure, comprehensive tests, and payment reconciliation. Do not treat this PR as a launched service.
