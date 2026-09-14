# TeknTandao Firebase Shop Setup

The public site remains compatible with GitHub Pages (`www.tekntandao.com`). Firebase provides product data, order storage and server-side payment Functions. Strapi provides blog content.

## 1. Firebase web configuration

Edit `assets/js/site-config.js` with the Firebase **web app** configuration and deployed Functions base URL. Firebase web configuration is public by design; never place M-Pesa, Paystack or Strapi admin secrets in this file.

The shop loads live active products from Firestore. If Firebase is not configured it falls back to `data/products.seed.json` so the page remains usable during setup.

Create a `products` collection using the seed JSON fields. Product prices are stored as whole Kenyan shillings in this standalone shop.

## 2. Deploy Firebase backend

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

The browser calls only `createMpesaCheckout` and `createPaystackCheckout`. Cart prices are treated as display values only; the Functions backend re-reads every product from Firestore and calculates the payable total itself.

## 3. Strapi blogs

Create a Strapi `Article` content type with at least:

- `title`
- `slug`
- `excerpt` or `description`
- `cover` media
- normal Strapi `publishedAt`

Enable public `find` access for published Articles, configure Strapi CORS to allow `https://www.tekntandao.com`, then set `strapiBaseUrl` in `assets/js/site-config.js`.

## 4. Shop content

Initial prices are market references captured in September 2026 and are intentionally editable in Firestore. Recheck supplier cost, VAT, delivery and margin before treating them as binding selling prices.

Initial references include Starlink Shop Kenya and Jumia Kenya listings for Starlink Standard Kit, TP-Link routers/switches/extenders, Hikvision CCTV kits, smart plugs and smart bulbs.

Images are free stock imagery from Unsplash and are credited in the product seed data; they are illustrative rather than seller catalogue photography.

## 5. Messaging and content routes

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
