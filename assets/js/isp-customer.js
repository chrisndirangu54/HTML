import {idToken,functionsBase} from './auth-client.js';
const form=document.querySelector('#customer-request'),status=document.querySelector('#customer-result');
const target=functionsBase?functionsBase+'/ispCustomerRequest':'/api/ispCustomerRequest';
form.addEventListener('submit',async event=>{
 event.preventDefault();if(!form.reportValidity())return;
 const button=document.querySelector('#customer-submit');button.disabled=true;
 status.className='message';status.textContent='Submitting request…';
 try{
  const token=await idToken();
  const data=new FormData(form);
  const payload={action:'request_service',site:String(data.get('site')||'').trim(),service:String(data.get('service')||''),
   message:String(data.get('message')||'').trim(),consent:data.get('consent')==='on'};
  const response=await fetch(target,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(payload)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||'Request could not be submitted');
  status.textContent='Your service request was recorded. Reference: '+result.id+'. This is not an installation appointment or service activation.';
  form.reset();
 }catch(error){
  status.className='message error';status.textContent='Request not submitted: '+error.message+'. If you are not signed in, use the Sign in link above.';
 }finally{button.disabled=false;}
});
