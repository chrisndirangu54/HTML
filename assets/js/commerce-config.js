window.TeknTandaoCommerceConfig = Object.freeze({
  // Firebase web config is safe to expose, but replace these placeholders with
  // the values from Firebase Console > Project settings > Your apps > Web app.
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  },
  functionsRegion: 'europe-west1',
  whatsappNumber: '254702258870',
  merchantName: 'TeknTandao',

  // Example: https://cms.tekntandao.com
  // Expected collection endpoint: /api/articles?populate=*&sort=publishedAt:desc
  strapiUrl: '',

  // Optional: set true during local preview to skip Firebase and use products.json.
  forceLocalCatalog: false,

  // Checkout callback shown after Paystack finishes.
  paystackCallbackUrl: 'https://tekntandao.com/#Shop'
});
