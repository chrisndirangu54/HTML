# HTML site → TV / ISP / Workspace shared-account handoff

The public website is an acquisition entry point, not an independent subscription authority. Visitors may enquire about ISP and TV independently, choose a bundle, and later launch Workspace with the *same verified identity* when the common Auth project is configured.

Production requirements:
- Select one Firebase Auth issuer or a real token-exchange service; do not silently create duplicated accounts.
- Use server-provided signed sessions, never URL-query customer IDs or access tokens.
- Existing HTML ISP console stays under its current server-authorized access controls until staged migration.
- TV and ISP services remain individually purchasable. Workspace activation adds management tools, never unexpectedly migrates or erases subscriptions.
- Payment confirmation requires verified provider callbacks; enquiry forms alone do not activate services.
- Network device passwords, administrative logs and raw viewing history must not be forwarded to the HTML client.
- All three products must share an explicit consent policy before audience targeting.

See `chrisndirangu54/TeknTandao-Workspace/docs/TV_ISP_WORKSPACE_BRIDGE.md` and `chrisndirangu54/TeknTandao-TV/docs/CROSS_PRODUCT_INTEGRATION.md`.

**Not enabled:** unified identity, cross-project real-time sync, streaming rights, live customer ISP provisioning, TV content distribution.
