const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('shop product cards hide model reference, supplier notes and photo credit text', () => {
  const commerce = read('assets/js/commerce.js');
  const cardMarkup = commerce.slice(commerce.indexOf('function renderProducts()'), commerce.indexOf('function loadCart()'));
  assert.ok(cardMarkup.includes('tt-product-card'), 'shop product template is present');
  for (const fragment of ['Model reference:', 'sourceMarkup', 'sourceLabel', 'sourceNote', 'imageCredit', 'tt-source']) {
    assert.ok(!cardMarkup.includes(fragment), 'unexpected visible reference field ' + fragment);
  }
  assert.match(cardMarkup, /formatKes\(product\.priceKes\)/);
  assert.match(cardMarkup, /Request a quote/);
  assert.match(cardMarkup, /data-whatsapp-product/);
  assert.match(cardMarkup, /data-add-product/);
});

test('Microsoft customers are routed to self-service product discovery and secured Workspace', () => {
  const cloud = read('cloud-automation.html');
  const site = read('microsoft-products.html');
  assert.match(cloud, /id="microsoft-reseller"/);
  assert.match(cloud, /id="microsoft-reseller-dashboard"/);
  assert.match(cloud, /microsoft-products\.html/);
  assert.match(cloud, /module=microsoft-reseller-saas/);
  assert.match(site, /module=microsoft-marketplace/);
  assert.match(site, /id="ms-buy-form"/);
  assert.match(site, /Pricing, the Microsoft Customer Agreement/);
  assert.match(cloud, /id="migrate"/);
  assert.match(cloud, /mode:"planning-only"/);
});

test('Media Cloud is a service with a real route and accurate development status', () => {
  const page = read('media-cloud.html');
  const nav = read('assets/js/nav-responsive.js');
  const home = read('index.html');
  const contact = read('contact_page.html');
  for (const asset of ['assets/css/home-theme-bridge.css','assets/js/home-theme-bridge.js','assets/js/nav-responsive.js','assets/css/service-home-ux.css']) {
    assert.ok(page.includes(asset), asset);
  }
  assert.match(page, /tt-home-aligned tt-service-page/);
  assert.match(page, /media-cloud-dashboard\.html/);
  assert.doesNotMatch(page, /View development repository/);
  assert.match(page, /social publishing, AI model inference/i);
  assert.match(page, /contact_page\.html\?subject=media-cloud/);
  assert.match(nav, /label: 'Media Cloud', href: 'media-cloud\.html'/);
  assert.match(home, /href="media-cloud\.html"/);
  assert.match(contact, /option value="media-cloud"/);
});

test('new service does not claim live scheduling, publishing or Microsoft pricing', () => {
  const page = read('media-cloud.html');
  const cloud = read('cloud-automation.html');
  assert.match(page, /will require platform permissions and explicit customer approval/);
  assert.match(page, /planned/i);
  assert.match(cloud, /authorized|provider/i);
  assert.match(cloud, /reseller|pricing/i);
});
