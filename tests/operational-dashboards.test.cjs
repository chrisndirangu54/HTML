const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');

test('Media Cloud opens an actual dashboard route rather than the repository',()=>{
  const home=read('media-cloud.html');
  const page=read('media-cloud-dashboard.html');
  assert.match(home,/href="media-cloud-dashboard\.html"/);
  assert.doesNotMatch(home,/View development repository|href="https:\/\/github\.com\/chrisndirangu54\/Media-Cloud"/);
  assert.match(page,/tt-home-aligned tt-service-page/);
  assert.match(page,/assets\/js\/media-cloud-dashboard\.js/);
  assert.match(page,/assets\/css\/media-cloud-dashboard\.css/);
  for(const panel of ['overview','campaigns','content','creators','reports']){
    assert.ok(page.includes('data-view="'+panel+'"'),panel+' view missing');
    assert.ok(page.includes('data-section="'+panel+'"'),panel+' nav missing');
  }
  for(const form of ['mc-campaign-form','mc-draft-form','mc-creator-form','mc-report-form']){
    assert.ok(page.includes('id="'+form+'"'),form+' missing');
  }
});

test('Local Media Cloud dashboard performs meaningful draft and reporting operations without network/publishing claims',()=>{
  const code=read('assets/js/media-cloud-dashboard.js');
  assert.match(code,/localStorage\.getItem\(KEY\)/);
  assert.match(code,/localStorage\.setItem\(KEY/);
  assert.match(code,/data\.campaigns\.push/);
  assert.match(code,/data\.drafts\.push/);
  assert.match(code,/data\.creators\.push/);
  assert.match(code,/data\.reports\.push/);
  assert.match(code,/new Blob\(/);
  assert.match(code,/Request a campaign|Campaign saved locally/);
  assert.match(code,/Ready for review/);
  assert.match(code,/\/r\.reach\)\*100/);
  assert.match(code,/esc\(d\.caption\)/);
  assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|https?:\/\/api\.|access_token|publishPost|schedulePost/);
  assert.match(read('media-cloud-dashboard.html'),/No live APIs, automatic posting, AI model inference/);
});

test('Reseller operator sees a progress dashboard and protected actual onboarding route',()=>{
  const page=read('microsoft-reseller-onboarding.html');
  const cloud=read('cloud-automation.html');
  assert.match(cloud,/href="microsoft-reseller-onboarding\.html"/);
  assert.match(page,/id="ms-checklist"/);
  assert.match(page,/id="ms-progress"/);
  assert.match(page,/data-ms-check="7"/);
  assert.match(page,/localStorage\.setItem\(key/);
  assert.match(page,/\?module=reseller-onboarding/);
  assert.match(page,/requires an authorized account|only after authorized sign-in/);
  assert.match(page,/does not query Microsoft Partner Center/);
});

test('Previously protected areas and store remain separate from dashboards',()=>{
  const media=read('media-cloud-dashboard.html');
  const microsoft=read('microsoft-reseller-onboarding.html');
  assert.doesNotMatch(media,/id="tt-commerce-store"/);
  assert.doesNotMatch(microsoft,/ictCommerceCreateMpesaCheckout|paystackSecret/);
  assert.match(read('shop.html'),/assets\/js\/commerce\.js/);
});
