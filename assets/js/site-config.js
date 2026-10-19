// Public runtime configuration. Firebase web config is safe to expose; payment/API secrets are NOT.
window.TEKNTANDAO_CONFIG = window.TEKNTANDAO_CONFIG || {
  firebase: {"projectId":"tekntandao","appId":"1:469001920001:web:5c3a82b7ef16b65686ea00","storageBucket":"tekntandao.firebasestorage.app","apiKey":"AIzaSyCpVZIz9FqihWSenI5NBnIcDEIyfLci5as","authDomain":"tekntandao.firebaseapp.com","messagingSenderId":"469001920001","projectNumber":"469001920001","version":"2"},
  functionsBaseUrl:"", // empty uses the hosting rewrite /api/siteAssistant
  strapiBaseUrl: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://127.0.0.1:1337" : "",
  mailchimpSignupUrl:"", // Mailchimp audience public signup URL; never an API key
  strapiApiVersion:"5",
  strapiArticleCollection:"articles",
  whatsappNumber:"254702258870"
};
