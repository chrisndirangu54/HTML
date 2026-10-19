import {apiFetch,config,getSession,functionsBase} from './auth-client.js';
const form=document.getElementById('newsletter-settings-form');
const status=document.getElementById('newsletter-settings-status');
function validUrl(value){if(!value)return true;try{const u=new URL(value);return u.protocol==='https:'&&/(^|\.)(list-manage\.com|eepurl\.com|mailchi\.mp)$/.test(u.hostname)}catch{return false}}
async function load(){
  const session=await getSession();if(session.role!=='admin')return;
  document.getElementById('admin-panels').hidden=false;
  form.elements.signupUrl.value=config.mailchimpSignupUrl||'';
  if(!functionsBase){status.textContent='Saving requires the admin backend. This release deploys Hosting only.';form.querySelector('button').disabled=true;return;}
  const response=await fetch(`${functionsBase}/getNewsletterSettings`);
  if(!response.ok)throw new Error('Unable to load newsletter settings.');
  const data=await response.json();form.elements.signupUrl.value=data.signupUrl||'';
}
form.addEventListener('submit',async event=>{
  event.preventDefault();const signupUrl=form.elements.signupUrl.value.trim();
  if(!validUrl(signupUrl)){status.textContent='Enter a Mailchimp public HTTPS signup URL.';return;}
  try{await apiFetch('adminSaveNewsletterSettings',{method:'POST',body:{signupUrl}});status.textContent='Newsletter settings saved.'}catch(error){status.textContent=error.message}
});
load().catch(error=>{status.textContent=error.message});
