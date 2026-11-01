const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const products = JSON.parse(read('data/products.json'));

test('all historic ISP directory models have their own quote-only shop listings and photographs', () => {
  const ids = [
    'huawei-eg8145v5-gpon-ont', 'tp-link-ec220-g5',
    'mikrotik-hap-ac2', 'mikrotik-hap-ax2',
    'mikrotik-hap-lite', 'mikrotik-hap-ac-lite',
    'comfast-cf-e313ac-v2'
  ];
  for (const id of ids) {
    const item = products.find(p => p.id === id);
    assert.ok(item, id + ' missing');
    assert.equal(item.active, true, id);
    assert.equal(item.quoteOnly, true, id);
    assert.equal(item.ispDirectory, true, id);
    assert.equal(item.priceKes, null, id);
    assert.ok(item.imageUrl.startsWith('https://'), id + ' needs product photo');
    assert.ok(item.sourcePriceUrl.startsWith('https://'), id + ' needs product reference');
  }
  assert.equal(products.length, new Set(products.map(p => p.id)).size, 'duplicate product ids');
});

test('ISP product cards load the same catalogue as shop and deep-link by product id', () => {
  const directory = read('assets/js/isp-products.js');
  const listing = read('isp-equipment.html');
  const shop = read('assets/js/commerce.js');
  assert.match(directory, /fetch\('data\/products\.json'/);
  assert.match(shop, /fetch\('data\/products\.json'/);
  assert.match(directory, /'shop\.html\?product='/);
  assert.match(shop, /requestedProduct/);
  assert.match(shop, /product-\$\{safeText\(product\.id\)\}/);
  assert.match(listing, /id="isp-products"/);
  assert.match(listing, /assets\/js\/isp-products\.js/);
});

test('reference-only products never enter checkout and can be enquired about', () => {
  const shop = read('assets/js/commerce.js');
  assert.match(shop, /product\.quoteOnly === true/);
  assert.match(shop, /row\.product\.quoteOnly !== true/);
  assert.match(shop, /Request a quote/);
  assert.match(shop, /'Price on request'/);
  assert.match(shop, /getElementById\('cart-button'\)/);
  assert.match(shop, /getElementById\('cart-count'\)/);
});

test('public ISP routes are free of operational architecture tables or staff workspace links', () => {
  const landing = read('isp.html');
  const directory = read('isp-equipment.html');
  const request = read('isp-customer.html');
  const oldRoute = read('isp-architecture.html');
  for (const html of [landing, directory, request]) {
    assert.doesNotMatch(html, /href="isp-architecture\.html"/);
    assert.doesNotMatch(html, /staff workspace|50-customer planning budget|Ten critical acceptance requirements/i);
    assert.match(html, /assets\/css\/isp-shop-pages\.css/);
  }
  assert.match(oldRoute, /location\.replace\('isp\.html'\)/);
  assert.match(request, /id="customer-request"/);
  assert.match(request, /name="service"/);
  assert.match(request, /name="consent"/);
  assert.match(read('isp-console.html'), /Engineering equipment review/);
  assert.match(read('isp-staff.html'), /Engineering reference for technicians/);
});

test('customer ISP and shop use shared navigation and home-aligned visual language', () => {
  const styles = read('assets/css/isp-shop-pages.css');
  const shopPage = read('shop.html');
  for (const term of ['.isp-hero', '.isp-product', '.shop-intro', '@media(max-width:600px)']) {
    assert.ok(styles.includes(term), term + ' missing');
  }
  assert.match(styles, /#28e98c/);
  assert.match(shopPage, /class="shop-intro"/);
  assert.match(shopPage, /id="cart-button"/);
  assert.match(shopPage, /id="tt-commerce-store"/);
  assert.match(read('isp.html'), /assets\/js\/nav-responsive\.js/);
});
