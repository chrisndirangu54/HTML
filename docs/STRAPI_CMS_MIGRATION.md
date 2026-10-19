# Strapi CMS deployment and blog migration

Strapi is **planned, not deployed**. The current live website reads seed articles from `data/blogs.json` and published Firebase `blogs`. Preserve both until migration is validated.

## Content model: Article
- title (string, required)
- slug (uid from title, unique)
- excerpt (text)
- body (rich text blocks)
- category (enumeration or relation: Cybersecurity, AI, Development, Business)
- cover (media)
- author (relation)
- publishedAt (Strapi draft/publish)

## Planned rollout
1. Deploy Strapi on a managed container or VPS with PostgreSQL and backups, HTTPS, private administrative access and independent CMS roles.
2. Restrict Strapi public API to published articles; store CMS API tokens only server side. Configure CORS and rate limits.
3. Export and deduplicate both `data/blogs.json` and Firestore `blogs` by slug; migrate copies into Strapi **without deleting the source**.
4. Add a server-side published-article proxy or read-only API client on `blog.html`, `blog-post.html`, and `cybersecurity.html`. Preserve the legacy feeds as migration fallback.
5. Point the existing administrator dashboard to Strapi's own authenticated Content Manager rather than cloning its editor. Do not embed CMS administrator tokens in browser code.
6. Verify content parity, images, drafts, access control and rollback, then retire the legacy publishing path.

## Existing PR correction
Removed the temporary Firestore editor UI from `admin.html`. The proof-of-concept `securityCommerce` API remains only as provisional code and must **not** be deployed for production editorial use; it will be retired after Strapi integration. No Strapi instance or CMS credentials are configured.

## Security / payment separation
CMS operations are independent of GitHub App installations, vulnerability assessment fees and scan worker execution. Never allow article content or CMS user roles to grant scan permissions.
