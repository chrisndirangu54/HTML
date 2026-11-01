/* Fill public Firebase web configuration and reCAPTCHA Enterprise/v3 site key
   before enabling server-based engineering features. No provider secrets here. */
window.TeknTandaoEngineeringConfig=Object.freeze({
  firebase: window.TeknTandaoCommerceConfig?.firebase || {},
  functionsRegion:'europe-west1',
  appCheckSiteKey:'',
  uploadEndpoint:'/api/engineeringUpload',
  maxUploadBytes:15*1024*1024,
  freeCredits:3,
  proposedPackages:[{id:'starter',credits:10,amountKes:250},{id:'maker',credits:50,amountKes:1000}]
});