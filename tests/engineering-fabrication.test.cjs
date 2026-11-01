const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('engineering-fabrication.html'),
  app=read('assets/js/engineering-fabrication.js'),
  preview=read('assets/js/engineering-fabrication-preview.js'),
  admin=read('assets/js/engineering-fabrication-admin.js'),
  cloud=read('functions-engineering/index.js');

test('fabrication UI offers design, upload, fabrication review, account credits and open-source tools',()=>{
 for(const id of ['fab-account','fab-signin','fab-balance','fab-ai','fab-ai-mode','fab-ai-prompt',
  'fab-ai-run','fab-apply-draft','fab-buy-starter','fab-buy-maker','fab-project-form',
  'fab-file','fab-preview','fab-jobs','fab-consent','fab-submit','fab-operator','fab-admin-list']){
   assert.ok(html.includes('id="'+id+'"'),id);
 }
 for(const name of ['replicad','ToubkalCAD','FreeCAD','OpenSCAD','MeshRight','KiCad','Webots','OpenFOAM'])
   assert.ok(html.includes(name),name);
 assert.match(html,/manufacturing feasibility review/);
 assert.match(html,/no automatic price|No automatic price/);
 assert.match(html,/unscanned/);
 assert.match(read('engineering.html'),/id="eng-send-fabrication"/);
 assert.match(read('assets/js/nav-responsive.js'),/Engineering Fabrication/);
});

test('cloud actions need verified user, App Check, server-authorized credits and explicit consent',()=>{
 const config=read('assets/js/engineering-fabrication-config.js');
 assert.match(config,/appCheckSiteKey:''/);
 assert.match(app,/ReCaptchaV3Provider/);
 assert.match(app,/getFunctions/);
 assert.match(app,/httpsCallable/);
 assert.match(app,/user\.getIdToken\(true\)/);
 assert.match(app,/idToken\.claims\?\.engineering_admin===true/);
 assert.match(app,/engineeringStartCheckout/);
 assert.match(app,/engineeringConfirmCheckout/);
 assert.match(app,/engineeringCreateProject/);
 assert.match(app,/engineeringSubmitProject/);
 assert.match(app,/fab-consent/);
 assert.doesNotMatch(app,/localStorage\.setItem\([^)]*credit|fetch\('https:\/\/api\.paystack\.co|sk_live_|sk_test_/);
 assert.match(cloud,/enforceAppCheck:true/);
 assert.match(cloud,/req\.auth\.token\?\.email_verified/);
 assert.match(cloud,/FREE_CREDITS/);
 assert.match(cloud,/runTransaction/);
 assert.match(cloud,/tx\.create\(jobRef/);
 assert.match(cloud,/FieldValue\.increment\(-AI_COST\)/);
 assert.match(cloud,/FieldValue\.increment\(AI_COST\)/);
 assert.match(cloud,/status:'refunded'/);
});

test('payments credit customer only after verified provider amount currency and reference',()=>{
 assert.match(cloud,/engineeringStartCheckout/);
 assert.match(cloud,/engineeringConfirmCheckout/);
 assert.match(cloud,/engineeringPaystackWebhook/);
 assert.match(cloud,/timingSafeEqual/);
 assert.match(cloud,/verifyPaidPurchase/);
 assert.match(cloud,/\/transaction\/verify\//);
 assert.match(cloud,/if\(current\.data\(\)\?\.status==='paid'\)/);
 assert.match(cloud,/status:'paid'/);
 assert.match(cloud,/status:'awaiting_payment'/);
 assert.doesNotMatch(html,/window\.PaystackPop|secretKey|PRIVATE_KEY/);
});

test('upload endpoint private, upload request not automatically manufacturing',()=>{
 assert.match(cloud,/verifyIdToken\(idToken,true\)/);
 assert.match(cloud,/getAppCheck\(\)\.verifyToken\(appToken\)/);
 assert.match(app,/getToken\(appCheck\)/);
 assert.match(app,/X-Firebase-AppCheck/);
 assert.match(cloud,/engineeringUploadDesign=onRequest/);
 assert.match(cloud,/req\.rawBody/);
 assert.match(cloud,/15\*1024\*1024/);
 assert.match(cloud,/doc\.data\(\)\.uid!==user\.uid/);
 assert.match(cloud,/doc\.data\(\)\.status!=='draft'/);
 assert.match(cloud,/ifGenerationMatch:0/);
 assert.match(cloud,/scanStatus:'unscanned_requires_operator_review'|validateUploadMeta/);
 assert.match(cloud,/status:'submitted_for_review'/);
 assert.match(cloud,/consentToReview:true/);
 assert.match(cloud,/engineering_admin/);
 assert.match(admin,/engineeringAdminReviewProject/);
 assert.match(admin,/engineeringAdminFileLink/);
 assert.match(admin,/engineeringAdminListProjects/);
});

test('3D preview uses local open-source Three.js loaders, protects external GLB assets',()=>{
 assert.match(preview,/STLLoader/);
 assert.match(preview,/OBJLoader/);
 assert.match(preview,/GLTFLoader/);
 assert.match(preview,/glbHasExternalUris/);
 assert.match(preview,/new THREE\.WebGLRenderer/);
 assert.match(preview,/OrbitControls/);
 assert.match(preview,/file\.arrayBuffer\(\)/);
 assert.doesNotMatch(preview,/fetch\(|uploadBytes\(|XMLHttpRequest/);
 assert.match(app,/engineering-fabrication-preview\.js/);
 assert.match(html,/three@0\.168\.0/);
});

test('Firebase deploy has an independent engineering function service and upload rewrite',()=>{
 const config=JSON.parse(read('firebase.json'));
 assert.ok(config.functions.some(f=>f.codebase==='engineering'&&f.source==='functions-engineering'));
 assert.ok(config.hosting.ignore.includes('functions-engineering/**'));
 assert.ok(config.hosting.rewrites.some(r=>r.source==='/api/engineeringUpload'&&r.function.functionId==='engineeringUploadDesign'));
 const packageJSON=JSON.parse(read('functions-engineering/package.json'));
 assert.equal(packageJSON.engines.node,'22');
 assert.match(read('functions-engineering/index.js'),/ENGINEERING_GEMINI_API_KEY/);
 assert.match(read('functions-engineering/index.js'),/ENGINEERING_PAYSTACK_SECRET_KEY/);
 assert.doesNotMatch(app,/ENGINEERING_GEMINI_API_KEY|ENGINEERING_PAYSTACK_SECRET_KEY/);
});
