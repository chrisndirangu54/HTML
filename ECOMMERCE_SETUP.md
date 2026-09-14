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

Create a Strapi `Article` content type with at least:

- `title`
- `slug`
- `excerpt` or `description`
- `cover` media
- normal Strapi `publishedAt`

Enable public `find` access for published Articles, configure Strapi CORS to allow `https://www.tekntandao.com`, then set `strapiBaseUrl` in `assets/js/site-config.js`.

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
