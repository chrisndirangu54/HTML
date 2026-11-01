const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const routes = ['isp.html', 'isp-equipment.html', 'isp-customer.html', 'shop.html'];
test('ISP and shop all use the homepage visual shell and load shared navigation', () => {
  for (const page of routes) {
    const html = read(page);
    assert.match(html, /tt-home-aligned/, page);
    assert.match(html, /assets\/css\/isp-shop-pages\.css/, page);
    assert.match(html, /assets\/css\/home-theme-bridge\.css/, page);
    assert.match(html, /assets\/js\/home-theme-bridge\.js/, page);
    assert.match(html, /assets\/js\/nav-responsive\.js/, page);
    assert.ok(html.indexOf('assets/js/home-theme-bridge.js') < html.indexOf('assets/js/nav-responsive.js'), page + ' floating menu must exist before shared nav initialization');
    assert.doesNotMatch(html, /class="commerce-nav"/, page + ' should not create a second menu');
    assert.doesNotMatch(html, /class="tt-site-nav"/, page + ' should not create a second menu');
  }
});

test('floating homepage menu is accessible and backed by the shared link catalogue', () => {
  const js = read('assets/js/home-theme-bridge.js');
  const navigation = read('assets/js/nav-responsive.js');
  assert.match(js, /top-navbar tt-floating-header/);
  assert.match(js, /top-mobile-menu/);
  assert.match(js, /aria-expanded/);
  assert.match(js, /aria-controls="tt-floating-menu"/);
  assert.match(js, /event\.key !== 'Escape'/);
  assert.match(js, /closest\('a'\)/);
  assert.match(navigation, /fillList\(mobile\)/);
  assert.match(navigation, /decorateHomeMenu\(mobile\)/);
});

test('homepage background/video and palette are shared without loading homepage runtime', () => {
  const bridge = read('assets/js/home-theme-bridge.js');
  const styles = read('assets/css/home-theme-bridge.css');
  const home = read('assets/css/style.css');
  assert.match(home, /--primary-color: #28e98c/);
  assert.match(bridge, /videoThemeMode/);
  assert.match(bridge, /selectedTheme/);
  assert.match(bridge, /selectedColor/);
  assert.match(bridge, /prefers-reduced-motion: reduce/);
  assert.match(bridge, /navigator\.connection\?\.saveData/);
  assert.match(bridge, /video' \+ \(selectedVideo \+ 1\)/);
  assert.match(styles, /--site-panel:#1f1f1f/);
  assert.match(styles, /--site-border:#565656/);
  assert.match(styles, /--primary-gradient/);
  assert.match(styles, /body\.tt-home-aligned\.isp-request \.service/);
  assert.match(styles, /@media\(max-width:700px\)/);
});

test('shop and ISP forms retain all functional controls', () => {
  const shop = read('shop.html');
  const request = read('isp-customer.html');
  const services = read('isp.html');
  const directory = read('isp-equipment.html');
  assert.match(shop, /class="tt-commerce-utility"/);
  for (const id of ['cart-button', 'cart-count', 'auth-link', 'whatsapp', 'tt-commerce-store']) {
    assert.ok(shop.includes('id="' + id + '"'), 'shop lost ' + id);
  }
  for (const token of ['id="customer-request"', 'name="service"', 'name="site"', 'name="message"', 'name="consent"']) {
    assert.ok(request.includes(token), 'request lost ' + token);
  }
  assert.match(services, /id="isp-desk"/);
  assert.match(directory, /id="isp-products"/);
  assert.match(directory, /assets\/js\/isp-products\.js/);
});
