# TeknTandao Firebase Shop Setup

The public site remains compatible with GitHub Pages (`www.tekntandao.com`). Firebase provides Authentication, product data, order storage and server-side payment Functions. Strapi provides blog content.

## 1. Firebase web configuration

Edit `assets/js/site-config.js` with the Firebase **web app** configuration and deployed Functions base URL. Firebase web configuration is public by design; never place M-Pesa, Paystack, Firebase Admin or Strapi admin secrets in this file.

The shop loads live active products from Firestore. If Firebase is not configured it falls back to `data/products.seed.json` so the page remains browseable during setup. Checkout, order history and staff dashboards require Firebase Authentication and deployed Functions.

Create a `products` collection using the seed JSON fields. Product prices are stored as whole Kenyan shillings in this standalone shop.

## 2. Enable Firebase Authentication

In Firebase Authentication enable:

- Email/Password
- Google

Add `www.tekntandao.com`, `tekntandao.com` and any approved development hostname to Firebase Authentication authorized domains.

New Email/Password accounts receive an email-verification message. Customers can browse without signing in, but checkout requires a real authenticated account. Every order stores the authenticated Firebase UID and appears in `account.html`.

Roles are enforced with Firebase Auth custom claims:

- `customer` — default authenticated user; can checkout and view only their order history through the authenticated API.
- `attendant` — sees paid/processing orders, can claim a paid order by starting processing, and can mark it ready for delivery.
- `delivery` — sees only orders assigned to their UID and can move them from ready → out for delivery → delivered.
- `admin` — sees all orders, can change order status, assign attendants/delivery users, edit products and manage staff roles.

The browser never decides authorization. Firebase Functions verifies the ID token and role for every protected action.

## 3. Bootstrap the first administrator

Configure the deployment parameter `ADMIN_EMAILS` as a comma-separated allowlist of trusted administrator email addresses. Example:

```bash
firebase functions:config:set ADMIN_EMAILS="admin@example.com"
```

If your Firebase CLI uses parameter prompts for `defineString`, provide the same value when deploying. The administrator must sign in with a **verified** matching email. Open `admin.html` and use **Activate configured admin**. The server checks the allowlist before setting the `admin` custom claim.

After the first admin is active, use the Admin dashboard to promote existing Firebase users to `attendant` or `delivery`. Customers cannot self-promote. An administrator cannot demote their own currently authenticated admin session through the dashboard.

## 4. Deploy Firebase backend

From the repository root after selecting your Firebase project:

```bash
cd functions
npm install
cd ..
firebase deploy --only firestore:rules,functions
```

Set payment secrets before deployment:

```bash
firebase functions:secrets:set MPESA_CONSUMER_KEY
firebase functions:secrets:set MPESA_CONSUMER_SECRET
firebase functions:secrets:set MPESA_PASSKEY
firebase functions:secrets:set MPESA_SHORTCODE
firebase functions:secrets:set MPESA_CALLBACK_URL
firebase functions:secrets:set PAYSTACK_SECRET_KEY
```

`MPESA_CALLBACK_URL` should be the deployed `mpesaCallback` HTTPS endpoint. Configure the deployed `paystackWebhook` endpoint in the Paystack dashboard.

The browser calls only authenticated commerce Functions for checkout and staff actions. Cart prices are display values only; the Functions backend re-reads every product from Firestore and calculates the payable total itself. Payment webhooks—not the browser—mark successful payments as paid.

## 5. Operational dashboards

Routes:

- `account.html` — customer order history and staff-dashboard routing
- `admin.html` — orders, assignment, users/roles and product management
- `attendant.html` — order preparation queue
- `delivery.html` — assigned delivery queue

Recommended operating flow:

`Customer checkout → payment webhook marks paid → attendant processes → attendant marks ready → admin assigns delivery → delivery marks out for delivery → delivery marks delivered`

Order workflow writes include status history and actor UID. Staff assignment and role changes are server-side operations.

## 6. Strapi blogs

The Blogs, ISP and Web3 article grids and `blog-post.html` all read the existing Strapi Article REST API. Set `strapiBaseUrl`, `strapiApiVersion` (`4` or `5`) and `strapiArticleCollection` (normally `articles`) in `assets/js/site-config.js`. The client supports Strapi 4 attributes and Strapi 5 document IDs. Enable public Article `find`, media population and CORS for the website origin.

When a CMS URL is configured, the CMS is authoritative: local seeds are not merged back into its feed. Without a CMS URL, `data/blogs.json` provides the static preview. Existing external cards in that preview now link directly to their publishers.

Extend your existing Article content type with these fields (preserve any existing fields and data):

| Field | Strapi type | Use |
| --- | --- | --- |
| title | Text, required | Card and article heading |
| slug | UID or unique text | Site article route |
| excerpt | Text | Card summary |
| category | Text | Label, e.g. ISP or Web3 |
| body | Rich text (Markdown) or long text | Site article text |
| cover | Existing media field | Existing images remain supported |
| coverUrl | Text | Optional HTTP image URL or local assets path |
| pages | JSON array | Any combination of `blogs`, `isp`, `web3` |
| postType | Enumeration: `internal`, `external` | Site article or external blog |
| externalUrl | Text | Required for external blogs |
| visible | Boolean, default true | Show or hide the article on the website |

Keep Strapi Draft & Publish enabled. Articles without `pages` fall back to ISP/Web3 placement based on their category, or Blogs for other categories. Site articles use `blog-post.html`; external cards open the publisher directly. No external article text is copied into the site.

The site Admin panel has a shared editor for all three pages. Existing Firebase administrator authentication protects two forwarding Functions; article storage and editing stay in Strapi. Configure these server parameters in `functions/.env.<project-id>`:

```
STRAPI_BASE_URL=https://your-existing-cms.example.com
STRAPI_API_VERSION=5
STRAPI_ARTICLE_COLLECTION=articles
```

Create a Strapi Content API token limited to Article find/create/update, and store it only as a Firebase secret:

```
firebase functions:secrets:set STRAPI_API_TOKEN
firebase deploy --only functions:adminListBlogs,functions:adminSaveBlog
```

Never put this token in `site-config.js`. The client and server must target the same Strapi instance, version and collection. The editor sends POST/PUT to the existing Article API, using `documentId` on Strapi 5 and numeric IDs on Strapi 4. Saving publishes the update; clearing `visible` hides it from the site's listings and article route. This visibility control is not Strapi's native unpublish operation: use the Strapi Content Manager for unpublished drafts or native unpublishing. The public Strapi API can still expose a published article whose website visibility is off.

Use the Admin panel's **Import starter blogs into Strapi** button to copy the initial entries from `data/blogs.json`. The import skips slugs that already exist and reports partial failures, so retrying preserves existing CMS entries. This is an explicit action; visiting the dashboard does not upload seeds. Existing generated Firestore posts are not mixed into the CMS feed.

## 7. Shop content

Initial prices are market references captured in September 2026 and are intentionally editable from the Admin dashboard / Firestore. Recheck supplier cost, VAT, delivery and margin before treating them as binding selling prices.

Initial references include Starlink Shop Kenya and Jumia Kenya listings for Starlink Standard Kit, TP-Link routers/switches/extenders, Hikvision CCTV kits, smart plugs and smart bulbs.

Images are free stock imagery from Unsplash and are credited in the product seed data; they are illustrative rather than seller catalogue photography.

## 8. Messaging and content routes

Customer WhatsApp: `+254 702 258 870` (`254702258870` in wa.me links).

The home-page top/mobile menu is routed at runtime to:

- `shop.html`
- `blog.html`
- `gallery.html`
- `events.html`
- `training.html`
- `podcasts.html`
- `awards.html`

Gallery, Events and Training use the Instagram embeds supplied for the site. Podcasts and Awards intentionally display **Coming soon**.

### Local Strapi connection

The website now targets `http://127.0.0.1:1337` (Strapi 5). The running CMS source is `C:/Users/Admin/Music/TechRuptors/cms`. A separate `TeknTandao Article` collection (`/api/articles`) was added there, preserving the existing Community Blog collection. Public read permissions are added during CMS startup; write permissions remain restricted. The collection starts empty: import starter cards using the site admin once the write proxy is configured, or create posts in Strapi's own admin.

For development, use the same URL in `STRAPI_BASE_URL` when running the Functions emulator, and set the website's `functionsBaseUrl` to the emulator URL. For production, use a reachable HTTPS CMS address: deployed Functions cannot access `127.0.0.1` on your computer, and visitors' browsers resolve that address to their own machines.
