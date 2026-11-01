const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const briefing = read('web3.html');
const studio = read('web3-studio.html');
const css = read('assets/css/web3-visuals.css');
const js = read('assets/js/web3-visuals.js');
const artwork = [
  'blockchain-hero',
  'chain-explorer',
  'contract-security',
  'developer-studio',
  'kenya-regulation',
  'credential-proof',
  'enterprise-blockchain',
  'web3-learning',
  'web3-research'
];

test('nine distinctive original SVG illustrations are self-hosted and well-formed', () => {
  const illustrations = new Set();
  for (const name of artwork) {
    const file='assets/images/web3/'+name+'.svg';
    assert.ok(fs.existsSync(path.join(root,file)),file);
    const svg=read(file);
    assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg,/viewBox="0 0 1200 720"/);
    assert.match(svg,/<\/svg>$/);
    assert.ok(svg.length>1200,name+' should have meaningful artwork');
    assert.doesNotMatch(svg,/<script|<foreignObject|<image|onload=|xlink:href|<use\s/i,name+' must be self-contained vector artwork');
    assert.ok(!illustrations.has(svg),name+' image duplicated');
    illustrations.add(svg);
  }
});

test('Web3 Studio has a high-priority visual hero with animated but decorative network', () => {
  assert.match(studio,/class="tt-svc-hero-aside tt-w3-hero-aside"/);
  assert.match(studio,/assets\/images\/web3\/blockchain-hero\.svg/);
  assert.match(studio,/fetchpriority="high"/);
  assert.match(studio,/class="tt-w3-network-motion" aria-hidden="true"/);
  assert.equal((studio.match(/class="tt-w3-particle p\d+"/g)||[]).length,5);
  assert.equal((studio.match(/class="tt-w3-network-line l\d+"/g)||[]).length,4);
  assert.match(studio,/Read-only by design/);
  assert.match(studio,/No private-key collection, wallet signing, trading/);
});

test('every functional Web3 tool has an illustration, alt text and lazy loading', () => {
  const covers={
    explorer:'chain-explorer',security:'contract-security',developer:'developer-studio',
    compliance:'kenya-regulation',proofs:'credential-proof',enterprise:'enterprise-blockchain',
    academy:'web3-learning',research:'web3-research'
  };
  for (const [panel,image] of Object.entries(covers)) {
    const marker='data-w3-view="'+panel+'"';
    const section=studio.slice(studio.indexOf(marker),studio.indexOf(marker)+650);
    assert.ok(section.includes('assets/images/web3/'+image+'.svg'),panel+' artwork missing');
    assert.match(section,/class="tt-w3-feature-banner tt-w3-reveal"/);
    assert.match(section,/loading="lazy" decoding="async"/);
    assert.match(section,/<img [^>]*alt="[^"]+"/);
  }
  assert.equal((studio.match(/class="tt-w3-feature-banner tt-w3-reveal"/g)||[]).length,8);
});

test('Web3 briefing preserves learning content with original illustrations', () => {
  assert.match(briefing,/class="orbit tt-w3-topic-hero"/);
  assert.match(briefing,/class="tt-w3-briefing-hero-picture"/);
  assert.equal((briefing.match(/class="card content-card tt-w3-briefing-card tt-w3-reveal"/g)||[]).length,6);
  assert.match(briefing,/id="nfts"/);
  assert.match(briefing,/id="guide"/);
  assert.match(briefing,/data-blog-page="web3"/);
  assert.match(briefing,/not an exchange and not a promise of profit/);
});

test('visual styling is scoped, responsive and reduced motion safe', () => {
  for (const page of [briefing,studio]) {
    assert.match(page,/assets\/css\/web3-visuals\.css/);
    assert.match(page,/assets\/js\/web3-visuals\.js/);
    assert.match(page,/assets\/js\/home-theme-bridge\.js/);
  }
  for (const name of ['tt-w3-hero-art','tt-w3-feature-banner','tt-w3-briefing-card','tt-w3-network-line','tt-w3-particle']){
    assert.ok(css.includes(name),name);
  }
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/animation:none!important/);
  assert.match(css,/body\.tt-w3-motion-off/);
  assert.doesNotMatch(css,/#cyber-nav-links|\.cyber-nav/);
});

test('progressive reveal avoids invisible content without JavaScript', () => {
  assert.match(js,/prefers-reduced-motion: reduce/);
  assert.match(js,/navigator\.connection && navigator\.connection\.saveData/);
  assert.match(js,/IntersectionObserver/);
  assert.match(js,/document\.visibilityState === 'hidden'/);
  assert.match(js,/observer\.unobserve/);
  assert.match(js,/tt-w3-motion-ready/);
  assert.match(css,/body\.tt-w3-motion-ready \.tt-w3-reveal/);
  assert.doesNotMatch(css,/(^|\n)\.tt-w3-reveal\s*\{/);
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|localStorage|addEventListener\('scroll'/);
});
