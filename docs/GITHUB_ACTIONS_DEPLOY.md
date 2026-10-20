# Controlled container releases

**Frontend:** remains Firebase Hosting, unchanged. Neither workflow deploys the frontend.

**CMS:** `.github/workflows/cms-container.yml` builds a Strapi container into GHCR on pushes to master, with an immutable SHA tag. A manual `workflow_dispatch` on master, after the `strapi-production` GitHub Environment approval, calls the configured Render deploy hook. Render must be independently configured to pull the source from GitHub or an appropriate container image. A deploy hook is **not** a GHCR image reference: make sure the Render service source and branch are set correctly before running. The workflow does not inject Strapi database secrets into the build.

Set GitHub environment `strapi-production` with required reviewers and the secret `RENDER_STRAPI_DEPLOY_HOOK`. Configure PostgreSQL and CMS runtime secrets on Render. The Render account currently requires payment verification before creating a free PostgreSQL instance, so no live deploy is possible yet.

**Worker:** `.github/workflows/security-worker-image.yml` only builds and publishes a disabled scaffold image to GHCR. It cannot execute vulnerability scanners or provision a cluster. Before authorizing live assessments, implement hardened workers with installed/pinned scanner binaries, signed/verified job instructions, confirmed ownership, strict tenant isolation, limited egress, payment reconciliation, audit logs, storage cleanup and integration tests. Do not attach the scaffold to a production deployment.

**Security:** never add container registry tokens or cloud keys to source control. GitHub Actions uses scoped `GITHUB_TOKEN` for GHCR publishing. Pinning actions to immutable commits and enabling artifact provenance are recommended before production release. Require code reviews and protect master.
