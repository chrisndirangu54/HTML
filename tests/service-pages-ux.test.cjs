const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const pages = ['cloud-automation.html','seo-cloud.html','web3.html','training.html','contact_page.html'];

test('remaining public service pages match homepage shell and shared menu', () => {
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /tt-home-aligned tt-service-page|tt-service-page tt-web3-page/, page);
    assert.match(html, /assets\/css\/home-theme-bridge\.css/, page);
    assert.match(html, /assets\/css\/service-home-ux\.css/, page);
    assert.match(html, /assets\/js\/home-theme-bridge\.js/, page);
    assert.match(html, /assets\/js\/nav-responsive\.js/, page);
    assert.ok(html.indexOf('assets/js/home-theme-bridge.js') < html.indexOf('assets/js/nav-responsive.js'), page);
    assert.doesNotMatch(html, /<nav class="commerce-nav"|<nav class="tt-site-nav"/, page);
    assert.match(html, /tt-utility-head/, page);
  }
});

test('cloud planner keeps its approved non-executing workflow', () => {
  const html = read('cloud-automation.html');
  for (const id of ['app','repo','stack','provider','budget','approval','plan','output','migrate','migration-status']) {
    assert.ok(html.includes('id="' + id + '"'), id);
  }
  assert.match(html, /mode:"planning-only"/);
  assert.match(html, /authorization notice first/);
  assert.match(html, /tekntandao-migration-request\.json/);
  assert.match(html, /No project files or cloud accounts are accessed/);
});

test('SEO Cloud retains disabled dashboard until valid configuration', () => {
  const html = read('seo-cloud.html');
  assert.match(html, /id="launch"[^>]*hidden/);
  assert.match(html, /id="status"/);
  assert.match(html, /TEKNTANDAO_SEO_CLOUD_URL/);
  assert.match(html, /u\.protocol==='https:'\|\|u\.hostname==='localhost'/);
});

test('contact retains actual form destination and supports scoped subject links', () => {
  const html = read('contact_page.html');
  assert.match(html, /action="https:\/\/formcarry\.com\/s\/0DnrPCxY-H-"/);
  assert.match(html, /method="POST"/);
  for (const name of ['full-name','email','phone-number','subject','message','_gotcha']) {
    assert.ok(html.includes('name="' + name + '"'), name);
  }
  for (const subject of ['web3','training','seo','cloud-automation','networking']) {
    assert.match(html, new RegExp('value="' + subject + '"'));
  }
  assert.match(html, /new URLSearchParams\(location\.search\)/);
});

test('Web3 article is intact and training retains social evidence and enquiry links', () => {
  const web3 = read('web3.html');
  const training = read('training.html');
  assert.match(web3, /id="guide"/);
  assert.match(web3, /id="nfts"/);
  assert.match(web3, /data-blog-page="web3"/);
  assert.match(web3, /contact_page\.html\?subject=web3/);
  assert.match(training, /instagram-media/);
  assert.match(training, /instagram\.com\/embed\.js/);
  assert.match(training, /contact_page\.html\?subject=training/);
});

test('theme CSS is responsive and constrained to customer service pages', () => {
  const css = read('assets/css/service-home-ux.css');
  assert.match(css, /body\.tt-home-aligned\.tt-service-page/);
  assert.match(css, /\.tt-svc-form/);
  assert.match(css, /\.tt-svc-grid/);
  assert.match(css, /@media\(max-width:590px\)/);
  assert.doesNotMatch(css, /#main-nav|\.cyber-nav|#cyber-nav-links/);
});
