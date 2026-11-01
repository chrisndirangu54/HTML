const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
const html = read('web3-studio.html');
const js = read('assets/js/web3-studio.js');
const legacy = read('web3.html');
const menu = read('assets/js/nav-responsive.js');

test('Web3 service opens accessible, responsive multi-tool studio', () => {
  assert.match(legacy, /web3-studio\.html/);
  assert.match(legacy, /id="toolkit"/);
  assert.match(legacy, /id="blog-grid"/);
  assert.match(legacy, /id="nfts"/);
  assert.match(legacy, /id="guide"/);
  assert.match(menu, /label: 'Web3 Studio', href: 'web3-studio\.html'/);
  assert.match(html, /tt-home-aligned tt-service-page tt-web3-studio/);
  for (const asset of ['assets/css/home-theme-bridge.css','assets/css/service-home-ux.css',
      'assets/css/web3-studio.css','assets/js/web3-studio.js','assets/js/nav-responsive.js']) {
    assert.ok(html.includes(asset),asset+' missing');
  }
  assert.match(read('assets/css/web3-studio.css'), /@media\(max-width:600px\)/);
  const groups=['explorer','security','developer','compliance','proofs','enterprise','academy','research'];
  for (const group of groups) {
    assert.ok(html.includes('data-w3-view="'+group+'"'),group+' panel');
    assert.ok(html.includes('data-w3-tab="'+group+'"'),group+' navigation');
  }
  assert.match(html, /aria-label="Web3 tool selection"/);
});

test('on-chain explorer validates identifiers, fetches bounded public data and falls back to source records', () => {
  assert.match(js, /const validEvm=\/\^0x/);
  assert.match(js, /const validTx=\/\^0x/);
  assert.match(js, /const validBtc=/);
  assert.match(js, /explorerPath\(network,type,value\)/);
  assert.match(js, /\/api\/v2\//);
  assert.match(js, /new AbortController\(\)/);
  assert.match(js, /credentials:'omit'/);
  assert.match(js, /No values were fabricated/);
  assert.match(js, /https:\/\/eth\.blockscout\.com\/api\/v2\/stats/);
  assert.match(js, /units\*gwei\/1e9/);
  assert.match(html, /current gas price/);
  assert.doesNotMatch(js, /eth_sendTransaction|personal_sign|eth_signTypedData|sendRawTransaction/);
});

test('security review is explicitly preliminary, local and does not claim access to wallet approvals', () => {
  const sourceControls=['w3-solidity','w3-analyze','w3-audit-result','w3-wallet-address','w3-approval-link'];
  for (const id of sourceControls) assert.ok(html.includes('id="'+id+'"'),id);
  for (const pattern of ['delegatecall','selfdestruct','tx.origin','unchecked','onlyOwner']) {
    assert.ok(js.includes(pattern),pattern);
  }
  assert.match(js, /revoke\.cash/);
  assert.match(html, /We do not claim to inspect active approvals/);
  assert.match(html, /Pattern detection only/);
  assert.match(js, /source\.length>75000/);
  assert.match(js, /escapeHtml\(item\.why\)/);
});

test('official OpenZeppelin generator and Kenyan regulator sources are linked', () => {
  assert.match(html, /https:\/\/wizard\.openzeppelin\.com\/build\/embed\.js/);
  assert.match(html, /<oz-wizard data-tab="ERC721"><\/oz-wizard>/);
  assert.match(html, /https:\/\/github\.com\/crytic\/slither/);
  assert.match(html, /https:\/\/www\.cma\.or\.ke\/regulatory-framework\//);
  assert.match(html, /https:\/\/www\.centralbank\.go\.ke\/policy-procedures\/legislation-and-guidelines\//);
  assert.match(html, /1 November 2026/);
  for (const item of ['development','exchange','custody','payment','token','collectible','advice']) {
    assert.match(html, new RegExp('<option value="'+item+'">'));
  }
  assert.match(js, /obtain qualified Kenyan legal advice/i);
});

test('credential fingerprinting is SHA-256 browser-only and cannot fake title or chain certification', () => {
  assert.match(js, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(js, /file\.size>8\*1024\*1024/);
  assert.match(js, /sourceType:file\?'file':'text'/);
  assert.match(js, /algorithm:'SHA-256'/);
  assert.match(js, /transactionExecuted:false/);
  assert.match(html, /No blockchain transaction is made/);
  assert.match(html, /not the author's identity/i);
  assert.doesNotMatch(js, /FileReader.*fetch|fetch.*w3-proof-file/);
});

test('learning, AI-ready FAQ, enterprise planning and research are functional but appropriately bounded', () => {
  for (const name of ['credentials','provenance','membership','tokenization','payments']) assert.ok(js.includes(name));
  for (const id of ['w3-business-form','w3-business-result','w3-enterprise-export',
    'w3-lesson-options','w3-lesson-grade','w3-assistant-response','w3-assistant-ask']) {
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.match(js, /indicativePrice:null,deadline:null,transactionExecuted:false/);
  assert.match(js, /localStorage\.setItem\('tt-web3-lessons-v1'/);
  assert.match(js, /Reviewed knowledge-base answer \(not generative AI\)/);
  assert.match(js, /const knowledge=/);
  assert.match(html, /not automatically updated news headlines/);
  assert.match(html, /Enterprise blockchain project planner/);
  assert.match(html, /No wallet connection needed/);
});

test('no trading, wallet signing or invented contract deployment is enabled', () => {
  const code = js;
  assert.doesNotMatch(code, /window\.ethereum\.request|ethers\.Wallet|sendTransaction\(|signMessage\(|walletConnect/);
  assert.match(html, /No private-key collection, wallet signing, trading, smart-contract deployment/);
  assert.match(html, /not audits, licensing determinations or investment advice/);
  assert.match(legacy, /not an exchange and not a promise of profit/);
});
