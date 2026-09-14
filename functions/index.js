import {createHash, createHmac, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import {getApps, initializeApp} from 'firebase-admin/app';
import {FieldValue, Timestamp, getFirestore} from 'firebase-admin/firestore';
import {defineSecret} from 'firebase-functions/params';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';
import {HttpsError, onCall, onRequest} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
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
const MPESA_CALLBACK_TOKEN = defineSecret('MPESA_CALLBACK_TOKEN');

const allPaymentSecrets = [
  PAYSTACK_SECRET_KEY,
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
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
    const mergedQuantity = (merged.get(productId) || 0) + quantity;
    if (mergedQuantity > 20) throw new HttpsError('invalid-argument', 'A product quantity cannot exceed 20.');
    merged.set(productId, mergedQuantity);
  }
  return [...merged].map(([productId, quantity]) => ({productId, quantity}));
}

async function buildServerCart(rawItems) {
  const items = validateItems(rawItems);
  const refs = items.map(row => db.collection('products').doc(row.productId));
  const snapshots = await db.getAll(...refs);
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
  const orderId = `tt-${randomUUID()}`;
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
    signal: AbortSignal.timeout(options.timeoutMs || 12000),
  });
  let payload = null;
  try { payload = await response.json(); } catch (_) { payload = null; }
  if (!response.ok) {
    const detail = payload?.message || payload?.errorMessage || payload?.error?.message || `HTTP ${response.status}`;
    const error = new Error(detail);
    error.httpStatus = response.status;
    throw error;
  }
  return payload;
}

function paystackCallbackUrl(raw) {
  const configured = cleanString(process.env.PAYSTACK_CALLBACK_URL, 500);
  if (configured) return configured;
  try {
    const url = new URL(cleanString(raw, 500));
    if (url.protocol !== 'https:' || !['tekntandao.com', 'www.tekntandao.com'].includes(url.hostname)) throw new Error('invalid callback');
    return url.href;
  } catch (_) {
    return 'https://tekntandao.com/#Shop';
  }
}

async function paystack(path, secret, options = {}) {
  const payload = await jsonFetch(`https://api.paystack.co${path}`, {
    method: options.method || 'GET',
    headers: {Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json'},
    ...(options.body ? {body: JSON.stringify(options.body)} : {}),
  });
  if (payload?.status !== true) throw new Error(payload?.message || 'Paystack request failed.');
  return payload.data;
}

async function verifyPaystackReference(reference, secret) {
  return paystack(`/transaction/verify/${encodeURIComponent(reference)}`, secret);
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

function secretEquals(supplied, expected) {
  const left = Buffer.from(String(supplied || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
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
      tx.update(snapshot.ref, {
        stock: FieldValue.increment(-Number(order.items[index].quantity)),
        updatedAt: timestamp(),
      });
    });
    tx.update(orderRef, {status: 'paid', payment, paidAt, updatedAt: timestamp()});
    return {status: 'paid'};
  });
}

async function verifyAndSettlePaystackOrder(reference) {
  const orderSnapshot = await db.collection('orders').doc(reference).get();
  if (!orderSnapshot.exists) throw new Error('Unknown Paystack order.');
  const order = orderSnapshot.data();
  if (order.provider !== 'paystack') throw new Error('Order provider mismatch.');
  if (['paid', 'paid_stock_exception'].includes(order.status)) return {status: order.status};

  const verified = await verifyPaystackReference(reference, PAYSTACK_SECRET_KEY.value());
  const providerStatus = String(verified?.status || '').toLowerCase();
  if (providerStatus !== 'success') {
    if (['failed', 'abandoned', 'reversed'].includes(providerStatus)) {
      await orderSnapshot.ref.set({status: 'failed', providerStatus, updatedAt: timestamp()}, {merge: true});
    }
    return {status: providerStatus || 'pending'};
  }
  if (String(verified?.reference) !== reference) throw new Error('Paystack reference mismatch.');
  if (String(verified?.currency).toUpperCase() !== 'KES') throw new Error('Paystack currency mismatch.');
  if (Number(verified?.amount) !== Number(order.totalMinor)) throw new Error('Paystack amount mismatch.');

  return finalizePaidOrder(reference, {
    provider: 'paystack',
    reference,
    transactionId: verified.id != null ? String(verified.id) : null,
    amountMinor: Number(verified.amount),
    currency: 'KES',
    channel: cleanString(verified.channel, 40) || null,
    gatewayResponse: cleanString(verified.gateway_response, 160) || null,
    verifiedAt: new Date().toISOString(),
  });
}

async function verifyAndSettleMpesaOrder(orderDoc, callback = null) {
  const order = orderDoc.data();
  if (order.provider !== 'mpesa') throw new Error('Order provider mismatch.');
  if (['paid', 'paid_stock_exception'].includes(order.status)) return {status: order.status};
  const checkoutRequestId = cleanString(order.mpesaCheckoutRequestId || callback?.CheckoutRequestID, 160);
  if (!checkoutRequestId) throw new Error('M-Pesa CheckoutRequestID is missing.');

  if (callback && Number(callback.ResultCode) !== 0) {
    await orderDoc.ref.set({
      status: 'failed',
      mpesaResultCode: Number(callback.ResultCode),
      mpesaResultDescription: cleanString(callback.ResultDesc, 240),
      updatedAt: timestamp(),
    }, {merge: true});
    return {status: 'failed'};
  }

  const accessToken = await mpesaAccessToken(MPESA_CONSUMER_KEY.value(), MPESA_CONSUMER_SECRET.value());
  const verified = await mpesaStkQuery({
    shortcode: MPESA_SHORTCODE.value(),
    passkey: MPESA_PASSKEY.value(),
    accessToken,
    checkoutRequestId,
  });
  if (verified?.ResultCode == null || verified?.ResultCode === '') {
    await orderDoc.ref.set({providerStatus: cleanString(verified?.ResponseDescription || verified?.ResultDesc, 240) || 'pending', updatedAt: timestamp()}, {merge: true});
    return {status: 'processing'};
  }
  const resultCode = Number(verified.ResultCode);
  if (resultCode !== 0) {
    await orderDoc.ref.set({status: 'failed', mpesaResultCode: resultCode, mpesaResultDescription: cleanString(verified?.ResultDesc, 240), updatedAt: timestamp()}, {merge: true});
    return {status: 'failed'};
  }

  const callbackAmount = callback ? Number(metadataValue(callback, 'Amount')) : Number(order.totalKes);
  const callbackPhone = callback ? String(metadataValue(callback, 'PhoneNumber') || '') : String(order.customer?.phone || '');
  if (callback && callbackAmount !== Number(order.totalKes)) throw new Error('M-Pesa callback amount mismatch.');
  if (callbackPhone && callbackPhone !== String(order.customer?.phone || '')) throw new Error('M-Pesa callback phone mismatch.');

  return finalizePaidOrder(orderDoc.id, {
    provider: 'mpesa',
    checkoutRequestId,
    merchantRequestId: cleanString(callback?.MerchantRequestID || order.mpesaMerchantRequestId, 160) || null,
    receiptNumber: callback ? (cleanString(metadataValue(callback, 'MpesaReceiptNumber'), 80) || null) : null,
    amountKes: Number(order.totalKes),
    phone: callbackPhone || order.customer?.phone || null,
    transactionDate: callback ? (metadataValue(callback, 'TransactionDate') || null) : null,
    verifiedBy: 'daraja_stk_query',
    verifiedAt: new Date().toISOString(),
  });
}

async function queuePaymentEvent(eventId, data) {
  const ref = db.collection('commercePaymentEvents').doc(eventId);
  await ref.set({
    ...data,
    state: 'queued',
    receivedAt: timestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86400000),
  }, {merge: true});
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
        amount: String(cart.totalMinor),
        currency: 'KES',
        reference: orderId,
        callback_url: paystackCallbackUrl(request.data?.callbackUrl),
        metadata: JSON.stringify({
          order_id: orderId,
          customer_name: customer.name,
          phone: customer.phone,
          source: 'tekntandao.com',
        }),
      },
    });
    if (!data?.authorization_url) throw new Error('Paystack did not return a checkout URL.');
    await db.collection('orders').doc(orderId).update({paystackAccessCode: data.access_code || null, updatedAt: timestamp()});
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
  if (!secretEquals(signature, expected)) return res.status(401).send('Invalid signature');

  const eventType = cleanString(req.body?.event, 80);
  const reference = cleanString(req.body?.data?.reference, 120);
  if (eventType === 'charge.success' && /^tt-[a-f0-9-]{36}$/.test(reference)) {
    await queuePaymentEvent(`paystack_${reference}`, {provider: 'paystack', eventType, reference});
  }
  return res.status(200).send('ok');
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
    if (!result?.CheckoutRequestID || String(result?.ResponseCode) !== '0') throw new Error(result?.ResponseDescription || 'M-Pesa STK request was rejected.');
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

export const mpesaCallback = onRequest({region, secrets: [MPESA_CALLBACK_TOKEN]}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  if (!secretEquals(req.query?.token, MPESA_CALLBACK_TOKEN.value())) return res.status(401).send('Invalid callback token');

  const callback = req.body?.Body?.stkCallback;
  const checkoutRequestId = cleanString(callback?.CheckoutRequestID, 160);
  if (checkoutRequestId) {
    await queuePaymentEvent(`mpesa_${sha256(checkoutRequestId).slice(0, 40)}`, {
      provider: 'mpesa',
      checkoutRequestId,
      callback,
    });
  }
  return res.status(200).json({ResultCode: 0, ResultDesc: 'Accepted'});
});

export const processCommercePaymentEvent = onDocumentCreated({
  document: 'commercePaymentEvents/{eventId}',
  region,
  retry: true,
  secrets: allPaymentSecrets,
}, async event => {
  const snapshot = event.data;
  if (!snapshot?.exists) return;
  const current = await snapshot.ref.get();
  const data = current.data() || snapshot.data();
  if (data.state === 'processed' || data.state === 'manual_review') return;
  const attempts = Number(data.attempts || 0) + 1;
  if (attempts > 12) {
    await snapshot.ref.set({attempts, state: 'manual_review', updatedAt: timestamp()}, {merge: true});
    return;
  }
  await snapshot.ref.set({attempts, state: 'processing', updatedAt: timestamp()}, {merge: true});

  try {
    if (data.provider === 'paystack') {
      await verifyAndSettlePaystackOrder(cleanString(data.reference, 120));
    } else if (data.provider === 'mpesa') {
      const query = await db.collection('orders').where('mpesaCheckoutRequestId', '==', cleanString(data.checkoutRequestId, 160)).limit(1).get();
      if (query.empty) throw new Error('Unknown M-Pesa checkout.');
      await verifyAndSettleMpesaOrder(query.docs[0], data.callback || null);
    } else {
      await snapshot.ref.set({state: 'rejected', error: 'Unknown provider', updatedAt: timestamp()}, {merge: true});
      return;
    }
    await snapshot.ref.set({state: 'processed', processedAt: timestamp(), error: null, updatedAt: timestamp()}, {merge: true});
  } catch (error) {
    await snapshot.ref.set({state: 'error', error: cleanString(error?.message || error, 500), updatedAt: timestamp()}, {merge: true});
    logger.error('Payment event processing failed', {eventId: event.params.eventId, provider: data.provider, attempts, error: String(error)});
    throw error;
  }
});

export const reconcilePendingCommerceOrders = onSchedule({
  schedule: 'every 10 minutes',
  region,
  secrets: allPaymentSecrets,
}, async () => {
  const snapshots = await db.collection('orders').where('status', 'in', ['pending_payment', 'processing']).limit(50).get();
  for (const orderDoc of snapshots.docs) {
    const order = orderDoc.data();
    try {
      if (order.provider === 'paystack' && order.paystackAccessCode) {
        await verifyAndSettlePaystackOrder(orderDoc.id);
      } else if (order.provider === 'mpesa' && order.mpesaCheckoutRequestId) {
        await verifyAndSettleMpesaOrder(orderDoc);
      }
    } catch (error) {
      logger.warn('Pending order reconciliation deferred', {orderId: orderDoc.id, provider: order.provider, error: String(error)});
    }
  }
});

export const getOrderStatus = onCall({region}, async request => {
  const orderId = cleanString(request.data?.orderId, 120);
  const statusToken = cleanString(request.data?.statusToken, 128);
  if (!/^tt-[a-f0-9-]{36}$/.test(orderId) || !/^[a-f0-9]{64}$/.test(statusToken)) {
    throw new HttpsError('permission-denied', 'Invalid order status credentials.');
  }
  const snapshot = await db.collection('orders').doc(orderId).get();
  if (!snapshot.exists) throw new HttpsError('not-found', 'Order not found.');
  const order = snapshot.data();
  if (!secretEquals(sha256(statusToken), order.statusTokenHash)) {
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

export const __commerce = Object.freeze({normalizeKenyanPhone, validateItems, nairobiTimestamp, sha256});
