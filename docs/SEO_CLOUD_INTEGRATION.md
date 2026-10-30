# SEO Cloud ↔ TeknTandao HTML

The HTML site has an SEO Cloud entry page at `/seo-cloud.html`. It is a **public launcher**, not a privileged API client.

Deployment:
1. Deploy SEO Cloud separately with HTTPS, tenant authentication, and verified domains.
2. Set `window.TEKNTANDAO_SEO_CLOUD_URL = "https://your-deployed-seo-cloud.example/dashboard";` before the launcher inline script (or replace with a server-injected public configuration value).
3. Do not put tenant API keys in HTML or JavaScript; issue short-lived backend-scoped tokens for authenticated operations.
4. For existing blogs in `blog.html` and `blog-post.html`, use SEO Cloud draft review and a server-side CMS adapter to publish approved content; preserve canonical server-rendered metadata.
5. Test redirect, CSP, CORS, sitemap, structured data and verified-domain behavior before enabling live publishing.

This integration does **not** automatically scrape or publish existing blogs, and it does not provide SSO by itself.
