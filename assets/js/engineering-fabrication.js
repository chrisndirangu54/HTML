/* Customer-side Engineering Hub.
 * No client-secret credentials, fake credits or automatic manufacturing.
 */
import {initTripo} from './engineering-tripo.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js';
import {initializeAppCheck,ReCaptchaV3Provider,getToken} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js';

const cfg=window.TeknTandaoEngineeringConfig||{},M=window.TeknEngineeringModels;
const $=id=>document.getElementById(id);
const status=$('fab-service-status');
const form=$('fab-project-form');
let firebaseAuth=null,appCheck=null,fx=null,user=null,verified=false,lastDraft=null,pendingFile=null,submitting=false;
const validConfig=cfg.firebase&&['apiKey','authDomain','projectId','appId'].every(k=>Boolean(cfg.firebase[k]))&&
  Boolean(cfg.appCheckSiteKey);
function notice(message,error=false){status.textContent=message;status.classList.toggle('is-error',error);}
function output(message){$('fab-ai-output').textContent=message;}
function escapeHTML(x){return String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[ch]));}
function call(name,data){if(!fx)throw Error('Cloud features are not configured.');return httpsCallable(fx,name)(data).then(r=>r.data);}
function busy(on){submitting=on;$('fab-submit').disabled=on||!verified;}
function canUseCloud(on){verified=on;for(const id of ['fab-ai-run','fab-buy-starter','fab-buy-maker','fab-submit','fab-refresh-jobs'])$(id).disabled=!on;tripo.setEnabled(on);}
const dimensions=()=>Object.fromEntries(['length','width','thickness','hole','offset'].map(k=>[k,Number(form.elements.namedItem(k).value)]));
function kind(){
 const selected=form.elements.namedItem('kind').value;
 $('fab-parametric').hidden=selected!=='generated';
 $('fab-upload-area').hidden=selected!=='upload';
 return selected;
}
function stateFromForm(){
 const data=Object.fromEntries(new FormData(form).entries());
 const result={kind:kind(),title:data.title||'',process:data.process,material:data.material,
  quantity:Number(data.quantity),notes:data.notes||'',contactEmail:data.contactEmail||'',
  deliveryLocation:data.deliveryLocation||''};
 if(result.kind==='generated'){
   if(!M)throw Error('Parametric design calculator unavailable.');
   M.mountingPlate(dimensions());result.dimensions=dimensions();
 }else{
   if(!pendingFile)throw Error('Select your own engineering design file first.');
 }
 return result;
}
function syncDraft(){
 try{
  const type=kind();
  if(type==='generated'){
   const d=dimensions(),shape=M.mountingPlate(d);
   $('fab-upload-summary').textContent='Validated four-hole plate: '+d.length+' × '+d.width+' × '+d.thickness+' mm; '+d.hole+' mm holes with '+d.offset+' mm edge-center offsets. Nominal solid volume '+shape.volumeMm3.toFixed(1)+' mm³. A human fabrication quote will assess material, loads and tolerances.';
  }else{
   $('fab-upload-summary').textContent=pendingFile?
    'Selected: '+pendingFile.name+' ('+Math.round(pendingFile.size/1024)+' KiB). File will only be transmitted after your explicit submission.':
    'Select a file to inspect it locally before requesting a fabrication quotation.';
  }
 }catch(e){$('fab-upload-summary').textContent='Check design dimensions: '+e.message;}
}
function parseReferral(){
 const q=new URLSearchParams(location.search),vals={};
 for(const k of ['length','width','thickness','hole','offset']){
  if(q.has(k)){const n=Number(q.get(k));if(!Number.isFinite(n))return;vals[k]=n;}
 }
 if(Object.keys(vals).length){
  try{
   const d={...dimensions(),...vals};M.mountingPlate(d);
   for(const [k,v] of Object.entries(d))form.elements.namedItem(k).value=String(v);
   document.dispatchEvent(new CustomEvent('eng:plate-from-fabrication',{detail:{dimensions:d}}));
   form.elements.namedItem('kind').value='generated';
  }catch(_){}
 }
 syncDraft();
}
function fillOutputAccount(data){
 $('fab-balance').textContent=String(data.balance);
 notice('Secure engineering account ready. Credit balance is verified on the server.',false);
}
async function reloadAccount(){
 const data=await call('engineeringAccount',{});
 fillOutputAccount(data);return data;
}
async function reloadProjects(){
 const out=$('fab-jobs');out.textContent='Loading private project history…';
 try{
  const data=await call('engineeringListProjects',{});
  out.replaceChildren();
  if(!data.projects?.length){out.textContent='No fabrication requests yet.';return;}
  for(const p of data.projects){
   const card=document.createElement('div');card.className='eng-fab-job';
   const title=document.createElement('strong');title.textContent=p.title;
   const small=document.createElement('span');small.textContent=p.process+' · '+p.kind+' · '+p.status;
   const id=document.createElement('small');id.textContent='Reference: '+p.id;
   card.append(title,small,id);
   if(p.quoteKes){const quote=document.createElement('small');quote.textContent='Human fabrication quote: KSh '+p.quoteKes.toLocaleString('en-KE')+' (pending separate approval/payment).';card.append(quote);}
   if(p.operatorNote){const note=document.createElement('small');note.textContent='Reviewer: '+p.operatorNote;card.append(note);}
   out.append(card);
  }
 }catch(e){out.textContent='Could not retrieve projects: '+e.message;}
}
form.querySelectorAll('input[name=kind]').forEach(el=>el.addEventListener('change',syncDraft));
form.addEventListener('input',syncDraft);
const modelContainer=$('fab-preview');
const beginShape=async shape=>{
 try{
  const module=await import('./engineering-fabrication-preview.js');
  pendingFile=null;window.TeknUploadedDesignFile=null;
  $('fab-file').value='';
  $('fab-file-details').textContent='Editable '+shape+' created locally. Select "Use edited STL for quote" to prepare a fabrication upload.';
  await module.previewPrimitive(shape,modelContainer,shape==='plate'?dimensions():undefined);
  $('fab-sculpt-status').scrollIntoView({block:'nearest',behavior:'smooth'});
  syncDraft();
 }catch(error){$('fab-sculpt-status').textContent='Could not create model: '+error.message;}
};
$('fab-sculpt-plate').addEventListener('click',()=>beginShape('plate'));
document.querySelectorAll('[data-sculpt-shape]').forEach(button=>button.addEventListener('click',()=>beginShape(button.dataset.sculptShape)));
document.addEventListener('fab:sculpt-changed',()=>{
 pendingFile=null;window.TeknUploadedDesignFile=null;
 $('fab-file-details').textContent='Unsaved mesh edit. Click "Use edited STL for quote" after editing to select the updated model.';
 syncDraft();
});
document.addEventListener('fab:edited-stl-ready',event=>{
 const file=event.detail?.file;
 if(!(file instanceof File)||file.size===0||file.size>cfg.maxUploadBytes)return;
 pendingFile=file;window.TeknUploadedDesignFile=file;
 const upload=form.querySelector('input[name="kind"][value="upload"]');
 upload.checked=true;kind();
 $('fab-file-details').textContent='Edited model prepared: '+file.name+' ('+(file.size/1024/1024).toFixed(2)+' MB). This is the version that will be uploaded only when you submit the fabrication request.';
 syncDraft();
});
$('fab-file').addEventListener('change',async e=>{
 const file=e.target.files?.[0];pendingFile=null;window.TeknUploadedDesignFile=null;
 if(!file){syncDraft();return;}
 const ext=file.name.split('.').pop().toLowerCase();
 if(!['stl','obj','step','stp','scad','dxf','3mf','glb','pdf'].includes(ext)||
   file.size===0||file.size>cfg.maxUploadBytes){
  $('fab-file').value='';syncDraft();
  $('fab-file-details').textContent='File must be STL, OBJ, STEP, STP, SCAD, DXF, 3MF, GLB or PDF and no larger than 15 MB.';
  return;
 }
 pendingFile=file;window.TeknUploadedDesignFile=file;
 $('fab-file-details').textContent=file.name+' · '+(file.size/1024/1024).toFixed(2)+' MB · local check only';
 syncDraft();
 try{
  const module=await import('./engineering-fabrication-preview.js');
  await module.previewFile(file,$('fab-preview'));
 }catch(err){$('fab-preview').textContent='3D preview unavailable: '+err.message+'. You may still submit the file.';}
});
$('fab-signin').addEventListener('click',async()=>{
 if(!firebaseAuth)return;
 try{notice('Opening verified Google sign-in…');
  await signInWithPopup(firebaseAuth,new GoogleAuthProvider());}
 catch(e){notice('Sign-in failed: '+e.message,true);}
});
$('fab-signout').addEventListener('click',async()=>{if(firebaseAuth)await signOut(firebaseAuth);});
$('fab-refresh-jobs').addEventListener('click',reloadProjects);
$('fab-ai-mode').addEventListener('change',()=>{$('fab-apply-draft').hidden=true;lastDraft=null;});
$('fab-ai-run').addEventListener('click',async()=>{
 if(!verified||submitting)return;
 const question=$('fab-ai-prompt').value.trim();
 if(question.length<12){output('Describe the requested design or engineering problem in at least 12 characters.');return;}
 $('fab-ai-run').disabled=true;output('Requesting engineering AI. One credit is reserved on the server…');
 const requestId='req_'+crypto.randomUUID().replace(/-/g,'');
 try{
  const result=await call('engineeringAiAssist',{requestId,mode:$('fab-ai-mode').value,
    question,context:JSON.stringify({material:form.elements.namedItem('material').value,dimensions:dimensions(),process:form.elements.namedItem('process').value})});
  output(result.answer+'\n\n'+result.disclaimer);
  lastDraft=result.suggestedPlate||null;
  $('fab-apply-draft').hidden=!lastDraft;
 }catch(e){output('Could not complete AI request: '+e.message+'. If the provider failed, the server refunds the reserved credit.');}
 finally{$('fab-ai-run').disabled=!verified;try{await reloadAccount();}catch(_){}}
});
$('fab-apply-draft').addEventListener('click',()=>{
 if(!lastDraft)return;
 try{
  M.mountingPlate(lastDraft);
  for(const [key,value] of Object.entries(lastDraft))form.elements.namedItem(key).value=String(value);
  document.dispatchEvent(new CustomEvent('eng:plate-from-fabrication',{detail:{dimensions:lastDraft}}));
  const choice=form.querySelector('input[name=kind][value=generated]');choice.checked=true;
  kind();syncDraft();$('fab-upload-summary').scrollIntoView({behavior:'smooth',block:'center'});
 }catch(e){output('AI draft failed validation: '+e.message);}
});
for(const plan of ['starter','maker']){
 $('fab-buy-'+plan).addEventListener('click',async()=>{
  if(!verified)return;
  $('fab-buy-'+plan).disabled=true;
  notice('Initializing secure Paystack checkout. Pricing is confirmed by the server…');
  try{
   const r=await call('engineeringStartCheckout',{planId:plan});
   sessionStorage.setItem('tt-engineering-paystack-reference',r.reference);
   const url=new URL(r.authorizationUrl);
   if(url.protocol!=='https:'||url.hostname!=='checkout.paystack.com')throw Error('Invalid payment destination');
   location.assign(url.href);
  }catch(e){notice('Checkout unavailable: '+e.message,true);$('fab-buy-'+plan).disabled=false;}
 });
}
form.addEventListener('submit',async e=>{
 e.preventDefault();
 if(!verified||submitting)return;
 if(!$('fab-consent').checked){notice('Confirm your right to submit this design before proceeding.',true);return;}
 let design;
 try{design=stateFromForm();}catch(e){notice('Design validation: '+e.message,true);return;}
 busy(true);notice('Creating your private engineering request…');
 try{
  const created=await call('engineeringCreateProject',design);
  if(design.kind==='upload'){
   const token=await user.getIdToken(true),appCheckToken=(await getToken(appCheck)).token,ext=pendingFile.name.split('.').pop().toLowerCase();
   notice('Uploading private CAD file for human review…');
   const r=await fetch(cfg.uploadEndpoint,{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream',
      'X-Project-Id':created.projectId,'X-File-Extension':ext,'X-Firebase-AppCheck':appCheckToken},body:pendingFile
   });
   const receipt=await r.json().catch(()=>({}));
   if(!r.ok)throw Error('Upload failed: '+(receipt.error||r.status)+'. Draft reference: '+created.projectId);
   notice('File securely received. Finalizing fabrication quotation request…');
  }
  const receipt=await call('engineeringSubmitProject',{projectId:created.projectId,
    consentToReview:true,ext:design.kind==='upload'?pendingFile.name.split('.').pop().toLowerCase():null});
  notice('Fabrication request received for review. Reference: '+receipt.projectId+'. No manufacture or payment has been initiated.');
  await reloadProjects();
 }catch(e){notice('Submission not completed: '+e.message,true);}
 finally{busy(false);}
});
async function restorePayment(){
 const q=new URLSearchParams(location.search),ref=q.get('reference')||sessionStorage.getItem('tt-engineering-paystack-reference');
 if(!ref||!/^eng_[0-9a-f]{32}$/.test(ref))return;
 try{
  const result=await call('engineeringConfirmCheckout',{reference:ref});
  if(result.status==='paid'){
   sessionStorage.removeItem('tt-engineering-paystack-reference');
   notice('Payment verified by Paystack and credits granted by the server.');
   await reloadAccount();
  }else notice('Payment still pending verification. Credits have not yet been granted.');
 }catch(e){notice('Payment not verified: '+e.message,true);}
}
function init(){
 parseReferral();
 if(!validConfig){
  notice('Cloud engineering features need Firebase web config and an App Check site key. Local CAD, open-source links and previews remain available. Paid AI, account credits and fabrication submission are not active yet.',true);
  $('fab-signin').disabled=true;
  return;
 }
 try{
  const app=initializeApp(cfg.firebase,'engineering-fabrication');
  appCheck=initializeAppCheck(app,{provider:new ReCaptchaV3Provider(cfg.appCheckSiteKey),isTokenAutoRefreshEnabled:true});
  firebaseAuth=getAuth(app);fx=getFunctions(app,cfg.functionsRegion||'europe-west1');
  $('fab-signin').disabled=false;
  onAuthStateChanged(firebaseAuth,async current=>{
   user=current;canUseCloud(false);$('fab-signout').hidden=!current;
   document.getElementById('fab-operator').hidden=true;
   document.getElementById('fab-admin-list').replaceChildren();
   if(!current)$('fab-jobs').replaceChildren();
   $('fab-signin').hidden=Boolean(current);
   $('fab-user').textContent=current?.email||'Not signed in.';
   $('fab-balance').textContent='—';
   if(!current){notice('Sign in with Google to access free introductory credits and secure fabrication requests.');return;}
   if(!current.emailVerified){notice('Please verify your account email before continuing.',true);return;}
   try{await reloadAccount();canUseCloud(true);
    const idToken=await current.getIdTokenResult();
    if(idToken.claims?.engineering_admin===true){
      const admin=await import('./engineering-fabrication-admin.js');
      await admin.enableOperator(call);
    }
    const formEmail=form.elements.namedItem('contactEmail');
    if(!formEmail.value)formEmail.value=current.email;
    await Promise.all([reloadProjects(),restorePayment()]);
   }catch(e){notice('Engineering backend unavailable: '+e.message,true);}
  });
 }catch(e){notice('Firebase initialization failed: '+e.message,true);}
}
const tripo=initTripo({call,reloadAccount,getUser:()=>user,getAppCheck:()=>getToken(appCheck)});
init();
