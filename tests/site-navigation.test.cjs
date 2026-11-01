// Run with: node --test tests/site-navigation.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const publicPages = [
  'index.html', 'cybersecurity.html', 'cloud-automation.html', 'seo-cloud.html',
  'security-monitoring.html', 'cybersecurity-portal.html',
  'isp-architecture.html', 'isp-customer.html', 'isp-equipment.html',
  'account.html', 'admin.html', 'attendant.html', 'awards.html', 'blog-post.html',
  'blog.html', 'contact_page.html', 'delivery.html', 'events.html', 'gallery.html',
  'isp.html', 'isp-staff.html', 'login.html', 'newsletter.html', 'podcasts.html',
  'shop.html', 'training.html', 'web3.html'
];

test('every public page loads the shared navigation catalogue', () => {
  publicPages.forEach(page => assert.match(
    read(page), /assets\/js\/nav-responsive\.js/, page + ' must load shared navigation'));
});

test('every local navigation destination resolves to an HTML file', () => {
  const code = read('assets/js/nav-responsive.js');
  const targets = [...code.matchAll(/href: '([^']+)'/g)].map(match => match[1]);
  assert.ok(targets.length > 10, 'canonical catalogue should contain public destinations');
  for (const target of targets) {
    if (/^https?:/.test(target)) continue;
    const filename = target.split('#')[0];
    assert.ok(fs.existsSync(path.join(root, filename)), target + ' is missing');
  }
  assert.match(code, /aria-current/);
  assert.match(code, /aria-expanded/);
  assert.match(code, /noopener noreferrer/);
});

test('homepage desktop and mobile fallbacks match and avoid old dead anchors', () => {
  const html = read('index.html');
  const groups = [...html.matchAll(/<ul class="top-(?:menu|mobile-menu)[^>]*>([\s\S]*?)<\/ul>/g)];
  assert.equal(groups.length, 2);
  assert.equal(groups[0][1].trim(), groups[1][1].trim());
  assert.doesNotMatch(groups[0][1], /href="#(?:blogs|gallery|awards|Shop|podcasts|training|events)"/);
  assert.match(html, /aria-controls="mobileMenu"/);
});

test('specialist pages retain operational controls and contextual navigation', () => {
  const shop = read('shop.html');
  for (const id of ['cart-button', 'auth-link', 'whatsapp']) assert.ok(shop.includes('id="' + id + '"'));
  for (const page of ['isp-architecture.html', 'isp-customer.html', 'isp-equipment.html']) {
    assert.match(read(page), /class="tt-site-nav"/);
    assert.match(read(page), /isp\.html/);
  }
  assert.match(read('cybersecurity.html'), /id="cyber-nav-toggle"/);
  assert.match(read('cybersecurity.html'), /class="nav-cta"/);
});

test('responsive navigation styles exist', () => {
  const css = read('assets/css/site-navigation.css');
  assert.match(css, /@media \(max-width:1100px\)/);
  assert.match(css, /\.tt-nav-panel/);
  assert.match(css, /:focus-visible/);
});
