(async () => {
  const button = document.getElementById('newsletter-subscribe');
  const status = document.getElementById('newsletter-status');
  let signupUrl=window.TEKNTANDAO_CONFIG?.mailchimpSignupUrl || '';
  const base=(window.TEKNTANDAO_CONFIG?.functionsBaseUrl||'').replace(/\/$/,'');
  if(base){try{const response=await fetch(`${base}/getNewsletterSettings`);if(!response.ok)throw new Error();signupUrl=(await response.json()).signupUrl||'';}catch{status.textContent='Newsletter signup is temporarily unavailable. Please try again later.';return;}}
  try {
    const url = new URL(signupUrl);
    if (url.protocol !== 'https:' || !/(^|\.)(list-manage\.com|eepurl\.com|mailchi\.mp)$/.test(url.hostname)) return;
    button.href = url.href;
    button.hidden = false;
    status.textContent = 'Continue to Mailchimp to enter your email and confirm your subscription.';
  } catch { /* Signup stays unavailable until the audience URL is configured. */ }
})();
