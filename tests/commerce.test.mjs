import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const products = JSON.parse(await read('data/products.json'));
const commerce = await read('assets/js/commerce.js');
const functions = await read('functions/index.js');
const rules = await read('firestore.rules');
const config = await read('assets/js/commerce-config.js');

test('catalogue has unique, sourced, sellable products', () => {
  assert.ok(products.length >= 10);
  const ids = new Set();
  for (const product of products) {
    assert.match(product.id, /^[a-z0-9_-]+$/);
    assert.equal(ids.has(product.id), false, `duplicate ${product.id}`);
    ids.add(product.id);
    assert.ok(product.name.length > 2);
    assert.ok(Number.isSafeInteger(product.priceKes) && product.priceKes > 0);
    assert.ok(Number.isSafeInteger(product.stock) && product.stock >= 0);
    assert.match(product.sourcePriceUrl, /^https:\/\//);
    assert.match(product.imageUrl, /^https:\/\//);
    assert.ok(product.sourceLabel);
    assert.ok(product.imageCredit);
  }
});

test('catalogue covers requested ICT categories', () => {
  const categories = new Set(products.map(product => product.category));
  for (const expected of ['Starlink', 'Networking', 'CCTV', 'Smart Home', 'Power', 'Accessories']) {
    assert.ok(categories.has(expected), `missing ${expected}`);
  }
});

test('frontend contains requested destinations and WhatsApp number', () => {
  for (const id of ['Shop', 'blogs', 'gallery', 'awards', 'podcasts', 'training', 'events']) {
    assert.ok(commerce.includes(`'${id}'`) || commerce.includes(`\"${id}\"`), `missing ${id}`);
  }
  assert.ok(config.includes("whatsappNumber: '254702258870'"));
  assert.ok(commerce.includes('DMX7tXoCWi2'));
  assert.ok(commerce.includes('DLsWD18CuJM'));
  assert.ok(commerce.includes('DLpor3UCHb2'));
  assert.match(commerce, /Podcasts coming soon/);
  assert.match(commerce, /Awards showcase coming soon/);
});

test('checkout never accepts client prices or totals', () => {
  assert.match(functions, /buildServerCart\(request\.data\?\.items\)/);
  assert.match(functions, /db\.collection\('products'\)\.doc/);
  assert.match(functions, /priceKes = Number\(product\.priceKes\)/);
  assert.doesNotMatch(functions, /request\.data\?\.total/);
  assert.doesNotMatch(functions, /request\.data\?\.amount/);
});

test('payment providers are verified server-side', () => {
  assert.match(functions, /x-paystack-signature/);
  assert.match(functions, /createHmac\('sha512'/);
  assert.match(functions, /transaction\/verify/);
  assert.match(functions, /mpesa\/stkpushquery\/v1\/query/);
  assert.match(functions, /callbackAmount !== Number\(order\.totalKes\)/);
  assert.match(functions, /MPESA_CALLBACK_TOKEN/);
});

test('payment event processing is bounded and reconciled', () => {
  assert.match(functions, /const current = await snapshot\.ref\.get\(\)/);
  assert.match(functions, /attempts > 12/);
  assert.match(functions, /retry: true/);
  assert.match(functions, /reconcilePendingCommerceOrders/);
  assert.match(functions, /schedule: 'every 10 minutes'/);
  assert.match(functions, /verified\?\.ResultCode == null/);
});

test('Firestore exposes only active products to clients', () => {
  assert.match(rules, /match \/products\/\{productId\}/);
  assert.match(rules, /resource\.data\.active == true/);
  assert.match(rules, /match \/orders\/\{orderId\}/);
  assert.match(rules, /allow read, write: if false/);
});
