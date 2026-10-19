# Private GitHub repositories — secure installation workflow

Use a GitHub App (not a user personal access token) with **read-only** repository Contents and Metadata permissions. The customer installs the app via its official GitHub installation page and selects individual repositories. The installation callback must be bound to a nonce-bearing authenticated Firebase session and verify `GET /app/installations/:installation_id` with a signed GitHub App JWT (GitHub App ID and PEM private key held in a secrets manager), **plus** `GET /installation/repositories` using a short-lived installation token. Never trust an installation ID submitted by the browser as proof of ownership.

The `POST /api/security-commerce/github-installations` API only records a connection *request*; it does not certify ownership or fetch private repositories. Until the GitHub App ID, PEM secret and callback are configured, show `Not connected` in the interface.

## Deployment prerequisites
- Register a dedicated TeknTandao Security GitHub App with install URL and callback.
- Approve minimum permissions (Contents:read, Metadata:read) and explicit repo selection; never request write permissions for scans.
- Store App ID / PEM securely, rotate credentials, and verify webhook signatures.
- Implement and test nonce + installation-owner verification and fetch **only** selected repositories; never return installation tokens to clients.
- Create isolated repository checkouts with secrets redaction and tenant-scoped storage; delete temporary clones after assessment.
- Charge KES 5000 for each separately approved scan; payments do not bypass authorization or run jobs automatically.
