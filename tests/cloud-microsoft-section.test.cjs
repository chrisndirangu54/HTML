const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');

const cloud=read('cloud-automation.html');
const css=read('assets/css/microsoft-cloud-section.css');

test('Cloud Automation leads Microsoft buyers to the actual customer shop',()=>{
 assert.match(cloud,/id="microsoft-reseller"/);
 assert.match(cloud,/id="microsoft-reseller-dashboard"[^>]*href="microsoft-products\.html"/);
 assert.match(cloud,/Microsoft software for your business/);
 assert.match(cloud,/Explore Microsoft products/);
 assert.match(cloud,/My customer dashboard/);
 assert.match(cloud,/module=microsoft-marketplace&amp;seller=tekntandao/);
 assert.match(cloud,/contact_page\.html\?subject=cloud-automation/);
});

test('reseller SaaS is a separate audience without internal approval details',()=>{
 const section=cloud.slice(cloud.indexOf('id="microsoft-reseller"'),cloud.indexOf('id="migrate"'));
 assert.match(section,/For Microsoft resellers/);
 assert.match(section,/module=microsoft-reseller-saas/);
 assert.match(section,/Run your reseller business/);
 assert.doesNotMatch(section,/Two levels:|on-site checklist|Partner approval workflow|Partner Center|internal API|reseller account token/);
 assert.match(section,/Prices and licence eligibility are confirmed in your quotation/);
 assert.match(section,/Payment and Microsoft licence activation are not completed automatically/);
});

test('deployment planning and secure Workspace migration remain distinct and functional',()=>{
 assert.match(cloud,/Ready to discuss your deployment/);
 assert.match(cloud,/id="migrate"[^>]*type="button"[^>]*class="tt-svc-button primary"/);
 assert.match(cloud,/Download planning request/);
 assert.match(cloud,/id="migration-status"/);
 assert.match(cloud,/module=cloud-automation/);
 for(const id of ['app','repo','stack','provider','budget','approval','plan','output']){
  assert.ok(cloud.includes('id="'+id+'"'),id);
 }
 assert.match(cloud,/mode:"planning-only"/);
 assert.match(cloud,/tekntandao-migration-request\.json/);
 assert.match(cloud,/No project files or cloud accounts are accessed/);
});

test('Microsoft section is accessible and responsive in homepage theme',()=>{
 assert.match(cloud,/assets\/css\/home-theme-bridge\.css/);
 assert.match(cloud,/assets\/css\/service-home-ux\.css/);
 assert.match(cloud,/assets\/css\/microsoft-cloud-section\.css/);
 assert.match(cloud,/aria-labelledby="microsoft-reseller-title"/);
 assert.match(cloud,/aria-labelledby="tt-ms-reseller-saas-title"/);
 assert.match(cloud,/aria-labelledby="cloud-next-title"/);
 assert.match(css,/\.tt-ms-shop-actions/);
 assert.match(css,/\.tt-ms-reseller-panel/);
 assert.match(css,/@media\(max-width:590px\)/);
 assert.doesNotMatch(css,/\.cyber-nav|#cyber-nav-links/);
});