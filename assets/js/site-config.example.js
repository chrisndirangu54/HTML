window.TEKNTANDAO_CONFIG = {
  firebase: {
    apiKey: "YOUR_FIREBASE_WEB_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  },
  functionsBaseUrl: "https://europe-west1-YOUR_PROJECT_ID.cloudfunctions.net",
  strapiBaseUrl: "https://cms.example.com",
  whatsappNumber: "254702258870"
};
// XAI_API_KEY stays on the server (Firebase secret). Never put it in this file.
// Set it with: firebase functions:secrets:set XAI_API_KEY
// Then deploy publishTrendingBlog / runTrendingBlog / listBlogs.
