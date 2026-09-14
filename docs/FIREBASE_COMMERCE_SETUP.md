# TeknTandao Firebase ICT Commerce Setup

The existing `index.html` remains the public site. `assets/js/ajax-form.js` loads the commerce layer, which injects the Shop, Blog, Gallery, Awards, Podcasts, Training and Events sections into the existing one-page layout.

## What works before provider setup

The storefront can render immediately from `data/products.json`, including search, category filters, cart state and WhatsApp ordering to **0702258870** (`254702258870` in `wa.me` format).

Online payment is intentionally disabled until Firebase and merchant credentials are configured. The frontend falls back to WhatsApp instead of pretending a payment was accepted.

## 1. Create/configure Firebase

Create a Firebase project and enable Firestore, Hosting and Cloud Functions. Create a Web app in Firebase Console and copy the public Web configuration into `assets/js/commerce-config.js`:

```js
firebase: {
  apiKey: '...',
  authDomain: 'PROJECT.firebaseapp.com',
  projectId: 'PROJECT',
  storageBucket: 'PROJECT.firebasestorage.app',
  messagingSenderId: '...',
  appId: '...'
}
```

Firebase Web API keys identify the Firebase project; they are not merchant secrets. Payment secrets must never be placed in browser JavaScript.

Install dependencies:

```bash
npm install
npm --prefix functions install
```

Login/select the intended Firebase project before deploying:

```bash
npx firebase login
npx firebase use --add
```

## 2. Seed the sourced product catalogue

The seed script reads `data/products.json` and writes `products/{id}` using the Firebase Admin SDK and Application Default Credentials:

```bash
npm run seed:products
```

Run this from an authenticated environment with access to the intended Firebase project. The public site only reads products whose Firestore `active` field is `true`; all product writes remain server/admin-only.

### Price and imagery policy

The initial catalogue contains September 2026 market-reference prices from seller/manufacturer pages and openly licensed/free stock or reference imagery. **Refresh price references and confirm stock before production launch.** The displayed image can be representative rather than exact SKU photography; image/source credits are retained in each product record.

TeknTandao's live selling price should be maintained in Firestore `priceKes`. The checkout backend ignores browser-supplied totals and rereads current Firestore prices and stock before initiating payment.

## 3. Paystack

Set the live/test Paystack secret only in Firebase Functions Secrets:

```bash
npx firebase functions:secrets:set PAYSTACK_SECRET_KEY
```

In the Paystack dashboard, configure the webhook URL to the deployed `paystackWebhook` HTTPS function, for example:

```text
https://europe-west1-PROJECT_ID.cloudfunctions.net/paystackWebhook
```

Paystack transactions are initialized server-side. The secret key never reaches the browser. Successful `charge.success` events are checked using the `x-paystack-signature` HMAC and independently verified through `GET /transaction/verify/:reference`. The amount and currency must match the server-created order before fulfilment.

Optional non-secret callback setting for the customer's browser can be placed in `functions/.env`:

```text
PAYSTACK_CALLBACK_URL=https://tekntandao.com/#Shop
```

## 4. Safaricom M-Pesa Daraja

Create a Daraja application and configure these Firebase Functions Secrets:

```bash
npx firebase functions:secrets:set MPESA_CONSUMER_KEY
npx firebase functions:secrets:set MPESA_CONSUMER_SECRET
npx firebase functions:secrets:set MPESA_SHORTCODE
npx firebase functions:secrets:set MPESA_PASSKEY
npx firebase functions:secrets:set MPESA_CALLBACK_URL
npx firebase functions:secrets:set MPESA_CALLBACK_TOKEN
```

Use a long random `MPESA_CALLBACK_TOKEN`. Set `MPESA_CALLBACK_URL` to the deployed callback URL including that token, for example:

```text
https://europe-west1-PROJECT_ID.cloudfunctions.net/mpesaCallback?token=LONG_RANDOM_VALUE
```

For sandbox testing, `functions/.env` can contain:

```text
MPESA_ENV=sandbox
```

For live Daraja:

```text
MPESA_ENV=production
```

The default transaction type is `CustomerPayBillOnline`. If the approved merchant configuration requires a different Daraja transaction type, set `MPESA_TRANSACTION_TYPE` in the Functions environment after confirming it against the merchant's Safaricom setup.

An STK callback alone is not treated as proof of payment. The server performs an STK Query using the returned `CheckoutRequestID`; it also checks the callback amount against the server-created order before fulfilment.

## 5. Strapi blog

Deploy Strapi separately and create a collection type such as `Article` / API ID `articles` with these fields:

- `title` — text, required
- `slug` — UID/text
- `excerpt` or `description` — text
- `cover` — media
- `publishedAt` — supplied by Draft & Publish

Set the public Strapi origin in `assets/js/commerce-config.js`:

```js
strapiUrl: 'https://cms.example.com'
```

The frontend requests:

```text
/api/articles?populate=*&sort=publishedAt:desc&pagination[limit]=6
```

Allow `https://tekntandao.com` and the `www` hostname in Strapi CORS. Do not expose a Strapi admin token in the browser; only published public articles should be readable from this endpoint.

## 6. Instagram content

The site uses Instagram's official embed script for the supplied posts:

- Gallery: `DMX7tXoCWi2`
- Events: `DLsWD18CuJM`
- Training: `DLpor3UCHb2`

The embeds require the posts to remain public/embeddable on Instagram. Podcasts and Awards intentionally display **Coming soon**.

## 7. Deploy

Validate first:

```bash
npm run check
npm test
```

Then deploy Firestore rules/indexes, Functions and Hosting:

```bash
npm run deploy
```

## Security/operations boundaries

- Never commit Paystack or Daraja secrets.
- Browser prices are presentation only; Firestore/server prices are authoritative at checkout.
- Order documents are never publicly readable from Firestore. `getOrderStatus` requires a random per-order status token.
- Checkout attempts are rate-limited and ephemeral rate-limit buckets are configured for Firestore TTL cleanup.
- Successful payments decrement Firestore stock transactionally and idempotently. If payment succeeds after stock became insufficient, the order is flagged `paid_stock_exception` for manual fulfilment/refund handling rather than silently overselling.
- Refunds, M-Pesa reversals, delivery pricing, eTIMS fiscalization and courier integrations are not implied by this implementation and should be added as explicit production workflows.
