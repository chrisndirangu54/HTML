# TeknTandao deployment split

The Vercel project should import GitHub `chrisndirangu54/HTML` with **root directory `.`**, Framework Preset **Other**, no framework build command, and static root assets. This does not magically deploy Firebase Cloud Functions. Do **not** move the Firebase security functions to Vercel without redesigning their authentication and triggers. Existing `/api/*` rewrite paths are Firebase Hosting configuration, not Vercel functions.

Deploy `cms/` as a **separate long-running Docker service** on Railway or another container host, with managed PostgreSQL and encrypted backups. Set environment variables from `cms/.env.example` in the hosting secret manager. Never commit keys. Set public read permission **only** for published Article find/findOne actions and keep draft/edit actions behind Strapi administrator accounts.

Important: Strapi 5 uses Blocks rich text and a different response shape from the current Firestore article schema. A content adapter and migration script are still required before switching production reads. Do not set the Strapi API as primary until existing articles and URLs are verified. Configure a suitable persistent media upload provider for production; local uploads in an ephemeral container are not durable.

The seven security platforms are **not deployed in this change**. PentAGI, HexStrike, Strix and Shannon require runtime installation and isolated policies; DefectDojo and Faraday require their own storage; secureCodeBox requires Kubernetes. Keep scan execution disabled until each is independently validated with owner-consented targets and payment authorization.

## Deployment checklist
- Connect Vercel account and import website repository.
- Connect Railway or another container host for Strapi and provision PostgreSQL.
- Store all CMS JWT/app keys and database credentials in environment secrets.
- Enable secure GitHub App configuration and Firebase Auth.
- Run Strapi schema migrations and editorial acceptance tests.
- Set up production HTTPS domain, CMS backups, logs and alerting.
- Implement and test blog API migration adapter before directing public traffic to Strapi.
- Deploy cybersecurity worker stack in separate secured container environment, validate each adapter.
- Validate paid scan access controls and verified provider payment callback reconciliation.
