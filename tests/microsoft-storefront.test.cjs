const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('Microsoft storefront is customer-facing and uses homepage theme',()=>{
 const html=read('microsoft-products.html');
 for(const asset of ['assets/css/home-theme-bridge.css','assets/css/service-home-ux.css',
 'assets/js/home-theme-bridge.js','assets/js/nav-responsive.js','assets/js/microsoft-store.js']){
  assert.ok(html.includes(asset),asset);
 }
 assert.match(html,/tt-home-aligned tt-service-page/);
 assert.match(html,/module=microsoft-marketplace/);
 assert.match(html,/id="ms-buy-form"/);
 assert.match(html,/id="ms-seat-count"/);
 assert.match(html,/id="ms-continue"/);
 assert.doesNotMatch(html,/id="ms-checklist"|Partner Center API token|Pay now/);
});
test('all Microsoft product families and guide inputs link to Workspace',()=>{
 const page=read('microsoft-products.html');
 const script=read('assets/js/microsoft-store.js');
 const families=['m365','azure','dynamics','power','security','windows365','server','education','marketplace'];
 for(const family of families) assert.match(page,new RegExp('name="family" value="'+family+'"'));
 assert.match(script,/const names=/);
 assert.match(script,/URLSearchParams\(\{module:'microsoft-marketplace'/);
 assert.match(script,/seller:'tekntandao'/);
 assert.match(script,/params.toString\(\)/);
 assert.doesNotMatch(script,/access_token|fetch\(|XMLHttpRequest|initializePayment|createCheckout/);
});
test('Cloud Automation, navigation, shop and old URL all point at customer sales',()=>{
 const cloud=read('cloud-automation.html'),nav=read('assets/js/nav-responsive.js');
 const home=read('index.html'),shop=read('shop.html'),old=read('microsoft-reseller-onboarding.html');
 assert.match(cloud,/id="microsoft-reseller-dashboard"[^>]*href="microsoft-products.html"/);
 assert.match(nav,/label: 'Microsoft Products', href: 'microsoft-products.html'/);
 assert.match(home,/partner-microsoft-link" href="microsoft-products.html"/);
 assert.match(shop,/href="microsoft-products.html"/);
 assert.match(old,/location.replace\('microsoft-products.html'\)/);
 assert.match(cloud,/module=microsoft-reseller-saas/);
});
test('site avoids fabricating Microsoft transactions',()=>{
 const page=read('microsoft-products.html');
 assert.match(page,/Automatic Microsoft ordering and customer payments remain disabled/);
 assert.match(page,/quote requests, self-service approvals and tracking/);
 assert.match(page,/eligible SKUs, pricing and applicable terms/);
 assert.match(page,/authorised|authorized|eligible/i);
});