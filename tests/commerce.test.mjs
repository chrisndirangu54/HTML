import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const products = JSON.parse(await read('data/products.json'));
const commerce = await read('assets/js/commerce.js');
const shopPage = await read('shop.html');
const homepage = await read('index.html');
const homepageLoader = await read('assets/js/ajax-form.js');
const homepageTheme = await read('assets/js/color.js');
const functions = await read('functions-ict-commerce/index.js');
const seeder = await read('scripts/seed-products.mjs');
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

test('shop owns the catalogue while the homepage stays free of injected sections', () => {
  assert.match(shopPage, /id="tt-commerce-store"/);
  assert.match(shopPage, /assets\/js\/commerce\.js/);
  assert.match(commerce, /getElementById\('tt-commerce-store'\)/);
  assert.doesNotMatch(homepageLoader, /assets\/js\/commerce\.js|data-tt-commerce/);
  assert.doesNotMatch(homepage, /footer-robot\.js/);
  assert.doesNotMatch(commerce, /id="(blogs|gallery|awards|podcasts|training|events)"/);
  assert.match(homepageTheme, /!document\.body\.classList\.contains\('home1-page'\)/);
  assert.ok(config.includes("whatsappNumber: '254702258870'"));
});

test('checkout never accepts client prices or totals', () => {
  assert.match(functions, /buildServerCart\(request\.data\?\.items\)/);
  assert.match(functions, /db\.collection\('ictCommerceProducts'\)\.doc/);
  assert.match(functions, /priceKes = Number\(product\.priceKes\)/);
  assert.doesNotMatch(functions, /request\.data\?\.total/);
  assert.doesNotMatch(functions, /request\.data\?\.amount/);
});

test('isolated store uses a separate callable and collection namespace', () => {
  assert.match(commerce, /ictCommerceCatalog/);
  assert.match(commerce, /ictCommerceCreatePaystackCheckout/);
  assert.match(commerce, /ictCommerceCreateMpesaCheckout/);
  assert.match(functions, /ictCommerceOrders/);
  assert.match(functions, /ictCommercePaymentEvents/);
  assert.doesNotMatch(functions, /db\.collection\('(products|orders)'\)/);
});

test('catalogue seeding does not expose private stock', () => {
  assert.match(seeder, /ictCommerceCatalog/);
  assert.match(seeder, /ictCommerceProducts/);
  assert.doesNotMatch(seeder, /collection\('ictCommerceCatalog'\)[\s\S]{0,800}?referenceStock/);
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
  assert.match(functions, /ictCommerceReconcilePendingOrders/);
  assert.match(functions, /schedule: 'every 10 minutes'/);
  assert.match(functions, /verified\?\.ResultCode == null/);
});

test('Firestore exposes only active products to clients', () => {
  assert.match(rules, /match \/ictCommerceCatalog\/\{productId\}/);
  assert.match(rules, /resource\.data\.active == true/);
  assert.match(rules, /match \/ictCommerceOrders\/\{orderId\}/);
  assert.match(rules, /allow read, write: if false/);
});
