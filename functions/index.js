import {createHash, createHmac, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import {getApps, initializeApp} from 'firebase-admin/app';
import {FieldValue, Timestamp, getFirestore} from 'firebase-admin/firestore';
import {defineSecret} from 'firebase-functions/params';
import {HttpsError, onCall, onRequest} from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

if (!getApps().length) initializeApp();

const db = getFirestore();
const region = 'europe-west1';

const PAYSTACK_SECRET_KEY = defineSecret('PAYSTACK_SECRET_KEY');
const MPESA_CONSUMER_KEY = defineSecret('MPESA_CONSUMER_KEY');
const MPESA_CONSUMER_SECRET = defineSecret('MPESA_CONSUMER_SECRET');
const MPESA_SHORTCODE = defineSecret('MPESA_SHORTCODE');
const MPESA_PASSKEY = defineSecret('MPESA_PASSKEY');
const MPESA_CALLBACK_URL = defineSecret('MPESA_CALLBACK_URL');

const checkoutSecrets = [
  PAYSTACK_SECRET_KEY,
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
];

const timestamp = () => FieldValue.serverTimestamp();
const sha256 = value => createHash('sha256').update(String(value)).digest('hex');
const cleanString = (value, max = 240) => String(value ?? '').trim().slice(0, max);

function assertEmail(value) {
  const email = cleanString(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  return email;
}

function normalizeKenyanPhone(value) {
  let phone = String(value ?? '').replace(/[^0-9+]/g, '').replace(/^\+/, '');
  if (/^0[17]\d{8}$/.test(phone)) phone = `254${phone.slice(1)}`;
  else if (/^[17]\d{8}$/.test(phone)) phone = `254${phone}`;
  if (!/^254[17]\d{8}$/.test(phone)) {
    throw new HttpsError('invalid-argument', 'Use a valid Kenyan mobile number, e.g. 0702258870.');
  }
  return phone;
}

function validateCustomer(input = {}) {
  const name = cleanString(input.name, 120);
  if (name.length < 2) throw new HttpsError('invalid-argument', 'Enter your full name.');
  return {
    name,
    email: assertEmail(input.email),
    phone: normalizeKenyanPhone(input.phone),
  };
}

function validateItems(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) {
    throw new HttpsError('invalid-argument', 'Cart must contain 1–30 products.');
  }
  const merged = new Map();
  for (const row of input) {
    const productId = cleanString(row?.productId, 120);
    const quantity = Number(row?.quantity);
    if (!/^[a-zA-Z0-9_-]{2,120}$/.test(productId)) {
      throw new HttpsError('invalid-argument', 'Invalid product in cart.');
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new HttpsError('invalid-argument', 'Product quantity must be between 1 and 20.');
    }
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }
  return [...merged].map(([productId, quantity]) => ({productId, quantity}));
}

async function buildServerCart(rawItems) {
  const items = validateItems(rawItems);
  const productRefs = items.map(row => db.collection('products').doc(row.productId));
  const snapshots = await db.getAll(...productRefs);
  const priced = [];
  let totalKes = 0;

  snapshots.forEach((snapshot, index) => {
    const requested = items[index];
    if (!snapshot.exists) throw new HttpsError('failed-precondition', `Product ${requested.productId} is unavailable.`);
    const product = snapshot.data();
    if (product.active === false) throw new HttpsError('failed-precondition', `${product.name || requested.productId} is unavailable.`);
    const priceKes = Number(product.priceKes);
    const stock = Number(product.stock ?? 0);
    if (!Number.isSafeInteger(priceKes) || priceKes < 1) throw new HttpsError('failed-precondition', 'A product has an invalid server price.');
    if (!Number.isSafeInteger(stock) || stock < requested.quantity) throw new HttpsError('failed-precondition', `${product.name || requested.productId} does not have enough stock.`);
    const lineTotalKes = priceKes * requested.quantity;
    if (!Number.isSafeInteger(lineTotalKes)) throw new HttpsError('failed-precondition', 'Cart total is too large.');
    totalKes += lineTotalKes;
    priced.push({
      productId: snapshot.id,
      name: cleanString(product.name || snapshot.id, 160),
      sku: cleanString(product.sku || '', 80) || null,
      quantity: requested.quantity,
      priceKes,
      lineTotalKes,
    });
  });

  if (!Number.isSafeInteger(totalKes) || totalKes < 1 || totalKes > 10_000_000) {
    throw new HttpsError('failed-precondition', 'Cart total is outside the supported checkout range.');
  }
  return {items: priced, totalKes, totalMinor: totalKes * 100};
}

function requesterIp(request) {
  return cleanString(
    request.rawRequest?.headers?.['x-forwarded-for']?.split(',')?.[0] || request.rawRequest?.ip || 'unknown',
    120,
  );
}

async function consumeCheckoutRateLimit(request) {
  const bucket = Math.floor(Date.now() / 600000);
  const ipHash = sha256(`tekntandao-shop:${requesterIp(request)}`).slice(0, 32);
  const ref = db.collection('commerceRateLimits').doc(`${bucket}_${ipHash}`);
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const count = Number(snapshot.data()?.count || 0) + 1;
    if (count > 12) throw new HttpsError('resource-exhausted', 'Too many checkout attempts. Try again shortly or use WhatsApp.');
    tx.set(ref, {
      count,
      bucket,
      expiresAt: Timestamp.fromMillis((bucket + 2) * 600000),
      updatedAt: timestamp(),
    }, {merge: true});
  });
}

async function createOrder({provider, cart, customer}) {
  const orderId = `tt_${randomUUID()}`;
  const statusToken = randomBytes(32).toString('hex');
  await db.collection('orders').doc(orderId).create({
    orderId,
    provider,
    status: 'pending_payment',
    customer,
    items: cart.items,
    totalKes: cart.totalKes,
    totalMinor: cart.totalMinor,
    currency: 'KES',
    statusTokenHash: sha256(statusToken),
    createdAt: timestamp(),
    updatedAt: timestamp(),
  });
  return {orderId, statusToken};
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs || 20000),
  });
  let payload = null;
  try { payload = await response.json(); } catch (_) { payload = null; }
  if (!response.ok) {
    const detail = payload?.message || payload?.errorMessage || payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return payload;
}

function paystackCallbackUrl(raw) {
  const configured = cleanString(process.env.PAYSTACK_CALLBACK_URL, 500);
  if (configured) return configured;
  try {
    const url = new URL(cleanString(raw, 500));
    if (url.protocol !== 'https:' || !['tekntandao.com', 'www.tekntandao.com'].includes(url.hostname)) {
      throw new Error('invalid callback');
    }
    return url.href;
  } catch (_) {
    return 'https://tekntandao.com/#Shop';
  }
}

async function paystack(path, secret, options = {}) {
  const payload = await jsonFetch(`https://api.paystack.co${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    ...(options.body ? {body: JSON.stringify(options.body)} : {}),
  });
  if (payload?.status !== true) throw new Error(payload?.message || 'Paystack request failed.');
  return payload.data;
}

async function verifyPaystackReference(reference, secret) {
  const data = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`, secret);
  return data;
}

function mpesaBaseUrl() {
  return String(process.env.MPESA_ENV || 'sandbox').toLowerCase() === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

function nairobiTimestamp(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

async function mpesaAccessToken(key, secret) {
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64');
  const payload = await jsonFetch(`${mpesaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {Authorization: `Basic ${credentials}`},
  });
  if (!payload?.access_token) throw new Error('M-Pesa did not return an access token.');
  return payload.access_token;
}

function mpesaPassword(shortcode, passkey, stamp) {
  return Buffer.from(`${shortcode}${passkey}${stamp}`).toString('base64');
}

async function mpesaStkPush({shortcode, passkey, accessToken, phone, amount, callbackUrl, orderId}) {
  const stamp = nairobiTimestamp();
  return jsonFetch(`${mpesaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: mpesaPassword(shortcode, passkey, stamp),
      Timestamp: stamp,
      TransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: orderId.slice(0, 12),
      TransactionDesc: 'TeknTandao ICT equipment',
    }),
  });
}

async function mpesaStkQuery({shortcode, passkey, accessToken, checkoutRequestId}) {
  const stamp = nairobiTimestamp();
  return jsonFetch(`${mpesaBaseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: mpesaPassword(shortcode, passkey, stamp),
      Timestamp: stamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
}

function metadataValue(callback, name) {
  const rows = callback?.CallbackMetadata?.Item;
  if (!Array.isArray(rows)) return null;
  return rows.find(item => item?.Name === name)?.Value ?? null;
}

async function finalizePaidOrder(orderId, payment) {
  const orderRef = db.collection('orders').doc(orderId);
  return db.runTransaction(async tx => {
    const orderSnapshot = await tx.get(orderRef);
    if (!orderSnapshot.exists) throw new Error('Order not found.');
    const order = orderSnapshot.data();
    if (['paid', 'paid_stock_exception'].includes(order.status)) return {status: order.status};

    const productRefs = (order.items || []).map(item => db.collection('products').doc(item.productId));
    const products = [];
    for (const ref of productRefs) products.push(await tx.get(ref));
    const insufficient = [];
    products.forEach((snapshot, index) => {
      const requested = order.items[index];
      const stock = Number(snapshot.data()?.stock ?? 0);
      if (!snapshot.exists || stock < Number(requested.quantity || 0)) insufficient.push(requested.productId);
    });

    const paidAt = timestamp();
    if (insufficient.length) {
      tx.update(orderRef, {
        status: 'paid_stock_exception',
        payment,
        stockExceptionProductIds: insufficient,
        paidAt,
        updatedAt: timestamp(),
      });
      return {status: 'paid_stock_exception'};
    }

    products.forEach((snapshot, index) => {
      const requested = order.items[index];
      tx.update(snapshot.ref, {
        stock: FieldValue.increment(-Number(requested.quantity)),
        updatedAt: timestamp(),
      });
    });
    tx.update(orderRef, {
      status: 'paid',
      payment,
      paidAt,
      updatedAt: timestamp(),
    });
    return {status: 'paid'};
  });
}

export const createPaystackCheckout = onCall({region, secrets: [PAYSTACK_SECRET_KEY]}, async request => {
  await consumeCheckoutRateLimit(request);
  const customer = validateCustomer(request.data?.customer);
  const cart = await buildServerCart(request.data?.items);
  const {orderId, statusToken} = await createOrder({provider: 'paystack', cart, customer});
  try {
    const data = await paystack('/transaction/initialize', PAYSTACK_SECRET_KEY.value(), {
      method: 'POST',
      body: {
        email: customer.email,
        amount: cart.totalMinor,
        currency: 'KES',
        reference: orderId,
        callback_url: paystackCallbackUrl(request.data?.callbackUrl),
        metadata: {
          order_id: orderId,
          customer_name: customer.name,
          phone: customer.phone,
          source: 'tekntandao.com',
        },
      },
    });
    if (!data?.authorization_url) throw new Error('Paystack did not return a checkout URL.');
    await db.collection('orders').doc(orderId).update({
      paystackAccessCode: data.access_code || null,
      updatedAt: timestamp(),
    });
    return {orderId, statusToken, authorizationUrl: data.authorization_url};
  } catch (error) {
    await db.collection('orders').doc(orderId).update({status: 'initialization_failed', updatedAt: timestamp()});
    logger.error('Paystack initialization failed', {orderId, error: String(error)});
    throw new HttpsError('unavailable', 'Paystack checkout could not be initialized.');
  }
});

export const paystackWebhook = onRequest({region, secrets: [PAYSTACK_SECRET_KEY]}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const signature = cleanString(req.headers['x-paystack-signature'], 256);
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expected = createHmac('sha512', PAYSTACK_SECRET_KEY.value()).update(raw).digest('hex');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (!signature || signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return res.status(401).send('Invalid signature');
  }

  res.status(200).send('ok');
  if (req.body?.event !== 'charge.success') return;
  const reference = cleanString(req.body?.data?.reference, 120);
  try {
    const orderSnapshot = await db.collection('orders').doc(reference).get();
    if (!orderSnapshot.exists) return logger.warn('Unknown Paystack order', {reference});
    const order = orderSnapshot.data();
    const verified = await verifyPaystackReference(reference, PAYSTACK_SECRET_KEY.value());
    if (String(verified?.status).toLowerCase() !== 'success') throw new Error('Paystack transaction is not successful.');
    if (String(verified?.currency).toUpperCase() !== 'KES') throw new Error('Paystack currency mismatch.');
    if (Number(verified?.amount) !== Number(order.totalMinor)) throw new Error('Paystack amount mismatch.');
    await finalizePaidOrder(reference, {
      provider: 'paystack',
      reference,
      amountMinor: Number(verified.amount),
      currency: 'KES',
      channel: cleanString(verified.channel, 40) || null,
      gatewayResponse: cleanString(verified.gateway_response, 160) || null,
    });
  } catch (error) {
    logger.error('Paystack webhook verification failed', {reference, error: String(error)});
  }
});

export const createMpesaCheckout = onCall({
  region,
  secrets: [MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL],
}, async request => {
  await consumeCheckoutRateLimit(request);
  const customer = validateCustomer(request.data?.customer);
  const cart = await buildServerCart(request.data?.items);
  const {orderId, statusToken} = await createOrder({provider: 'mpesa', cart, customer});

  try {
    const accessToken = await mpesaAccessToken(MPESA_CONSUMER_KEY.value(), MPESA_CONSUMER_SECRET.value());
    const result = await mpesaStkPush({
      shortcode: MPESA_SHORTCODE.value(),
      passkey: MPESA_PASSKEY.value(),
      accessToken,
      phone: customer.phone,
      amount: cart.totalKes,
      callbackUrl: MPESA_CALLBACK_URL.value(),
      orderId,
    });
    if (!result?.CheckoutRequestID || String(result?.ResponseCode) !== '0') {
      throw new Error(result?.ResponseDescription || 'M-Pesa STK request was rejected.');
    }
    await db.collection('orders').doc(orderId).update({
      status: 'processing',
      mpesaCheckoutRequestId: result.CheckoutRequestID,
      mpesaMerchantRequestId: result.MerchantRequestID || null,
      updatedAt: timestamp(),
    });
    return {orderId, statusToken, checkoutRequestId: result.CheckoutRequestID};
  } catch (error) {
    await db.collection('orders').doc(orderId).update({status: 'initialization_failed', updatedAt: timestamp()});
    logger.error('M-Pesa initialization failed', {orderId, error: String(error)});
    throw new HttpsError('unavailable', 'M-Pesa checkout could not be initialized.');
  }
});

export const mpesaCallback = onRequest({
  region,
  secrets: [MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY],
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  res.status(200).json({ResultCode: 0, ResultDesc: 'Accepted'});

  const callback = req.body?.Body?.stkCallback;
  const checkoutRequestId = cleanString(callback?.CheckoutRequestID, 160);
  if (!checkoutRequestId) return;
  try {
    const query = await db.collection('orders').where('mpesaCheckoutRequestId', '==', checkoutRequestId).limit(1).get();
    if (query.empty) return logger.warn('Unknown M-Pesa checkout', {checkoutRequestId});
    const orderDoc = query.docs[0];
    const order = orderDoc.data();

    if (Number(callback.ResultCode) !== 0) {
      await orderDoc.ref.set({
        status: 'failed',
        mpesaResultCode: Number(callback.ResultCode),
        mpesaResultDescription: cleanString(callback.ResultDesc, 240),
        updatedAt: timestamp(),
      }, {merge: true});
      return;
    }

    const accessToken = await mpesaAccessToken(MPESA_CONSUMER_KEY.value(), MPESA_CONSUMER_SECRET.value());
    const verified = await mpesaStkQuery({
      shortcode: MPESA_SHORTCODE.value(),
      passkey: MPESA_PASSKEY.value(),
      accessToken,
      checkoutRequestId,
    });
    if (Number(verified?.ResultCode) !== 0) throw new Error('Daraja STK query did not verify successful payment.');

    const callbackAmount = Number(metadataValue(callback, 'Amount'));
    const callbackPhone = String(metadataValue(callback, 'PhoneNumber') || '');
    if (callbackAmount !== Number(order.totalKes)) throw new Error('M-Pesa callback amount mismatch.');
    if (callbackPhone && callbackPhone !== String(order.customer?.phone || '')) throw new Error('M-Pesa callback phone mismatch.');

    await finalizePaidOrder(orderDoc.id, {
      provider: 'mpesa',
      checkoutRequestId,
      merchantRequestId: cleanString(callback.MerchantRequestID, 160) || null,
      receiptNumber: cleanString(metadataValue(callback, 'MpesaReceiptNumber'), 80) || null,
      amountKes: callbackAmount,
      phone: callbackPhone || order.customer?.phone || null,
      transactionDate: metadataValue(callback, 'TransactionDate') || null,
    });
  } catch (error) {
    logger.error('M-Pesa callback verification failed', {checkoutRequestId, error: String(error)});
  }
});

export const getOrderStatus = onCall({region}, async request => {
  const orderId = cleanString(request.data?.orderId, 120);
  const statusToken = cleanString(request.data?.statusToken, 128);
  if (!/^tt_[a-f0-9-]{36}$/.test(orderId) || !/^[a-f0-9]{64}$/.test(statusToken)) {
    throw new HttpsError('permission-denied', 'Invalid order status credentials.');
  }
  const snapshot = await db.collection('orders').doc(orderId).get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'Order not found.');
  const order = snapshot.data();
  const supplied = Buffer.from(sha256(statusToken));
  const expected = Buffer.from(String(order.statusTokenHash || ''));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new HttpsError('permission-denied', 'Invalid order status credentials.');
  }
  return {
    orderId,
    status: order.status,
    totalKes: order.totalKes,
    currency: order.currency,
    provider: order.provider,
    paidAt: order.paidAt?.toDate?.()?.toISOString?.() || null,
  };
});

// Exported only for local/unit validation; not a Cloud Function.
export const __commerce = Object.freeze({
  normalizeKenyanPhone,
  validateItems,
  nairobiTimestamp,
  sha256,
});
