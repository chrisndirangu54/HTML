/* Tripo text/image generation. No provider secrets; local sculpting is free. */
const $=id=>document.getElementById(id);
export function initTripo({call,reloadAccount,getUser,getAppCheck}){
 const mode=$('fab-tripo-mode'),prompt=$('fab-tripo-prompt'),image=$('fab-tripo-image');
 const run=$('fab-tripo-run'),resume=$('fab-tripo-resume'),edit=$('fab-tripo-edit'),download=$('fab-tripo-download');
 const status=$('fab-tripo-status'),progress=$('fab-tripo-progress'),actions=$('fab-tripo-actions');
 let enabled=false,busy=false,job=null;
 const key=()=>getUser()?'tekntandao-tripo-'+getUser().uid:null;
 const message=t=>{status.textContent=t;};
 const sleep=ms=>new Promise(done=>setTimeout(done,ms));
 function setEnabled(value){
  enabled=Boolean(value);run.disabled=!enabled||busy;resume.disabled=!enabled||busy;
  if(enabled&&key()){
   try{job=sessionStorage.getItem(key())||job;}catch(_){}
   resume.hidden=!job;
  }else{job=null;resume.hidden=true;actions.hidden=true;}
 }
 mode.addEventListener('change',()=>{
  $('fab-tripo-image-wrap').hidden=mode.value!=='image';
  $('fab-tripo-prompt-wrap').hidden=mode.value==='image';
 });
 function readImage(file){
  return new Promise((resolve,reject)=>{
   if(!file||!['image/png','image/jpeg'].includes(file.type)||file.size<100||file.size>4*1024*1024)
    return reject(Error('Select a PNG or JPEG image up to 4 MB.'));
   const reader=new FileReader();
   reader.onload=()=>resolve(String(reader.result||'').split(',')[1]);
   reader.onerror=()=>reject(Error('Image could not be loaded.'));
   reader.readAsDataURL(file);
  });
 }
 async function poll(){
  if(!enabled||busy||!job)return;
  busy=true;run.disabled=true;resume.disabled=true;actions.hidden=true;
  try{
   for(let n=0;n<75&&enabled;n++){
    let task;
    try{task=await call('engineeringTripoStatus',{jobId:job});}
    catch(error){message('Status temporarily unavailable: '+error.message+'. Resume this task instead of starting another.');resume.hidden=false;return;}
    progress.value=task.progress||0;
    if(task.status==='completed'){
     message('GLB ready. Download it or open it in the free sculpt editor. Validate all physical dimensions before fabrication.');
     actions.hidden=false;resume.hidden=true;return;
    }
    if(task.status==='refunded'){
     message('Generation failed and the reserved credits were refunded.');
     try{sessionStorage.removeItem(key());}catch(_){}
     job=null;resume.hidden=true;
     await reloadAccount();return;
    }
    message('Tripo 3D generation: '+(task.progress||0)+'%');
    await sleep(2500);
   }
   message('Generation is still processing. Resume task to check again without paying another time.');
   resume.hidden=false;
  }finally{busy=false;run.disabled=!enabled;resume.disabled=!enabled;}
 }
 run.addEventListener('click',async()=>{
  if(!enabled||busy)return;
  busy=true;run.disabled=true;actions.hidden=true;resume.hidden=true;progress.value=0;
  try{
   const request={mode:mode.value,requestId:crypto.randomUUID()};
   if(mode.value==='text'){
    request.prompt=prompt.value.trim();
    if(request.prompt.length<8||request.prompt.length>1024)throw Error('Describe the model in 8–1024 characters.');
   }else{
    const file=image.files?.[0];
    request.imageMime=file?.type;request.imageBase64=await readImage(file);
   }
   if(!confirm('Send your '+(mode.value==='image'?'reference image':'prompt')+' to Tripo AI and spend 10 engineering credits? Output is conceptual, not certified CAD.'))return;
   message('Reserving credits and submitting your 3D generation task…');
   const result=await call('engineeringTripoStart',request);
   job=result.jobId;
   try{sessionStorage.setItem(key(),job);}catch(_){}
   await reloadAccount();
  }catch(error){message('Could not start Tripo generation: '+error.message);}
  finally{busy=false;run.disabled=!enabled;}
  if(job)poll();
 });
 resume.addEventListener('click',()=>poll());
 async function getModel(){
  if(!enabled||!job||!getUser())throw Error('Sign in and finish generating a model.');
  const token=await getUser().getIdToken(),appToken=(await getAppCheck()).token;
  const response=await fetch('/api/engineeringTripoDownload?jobId='+encodeURIComponent(job),{
   headers:{Authorization:'Bearer '+token,'X-Firebase-AppCheck':appToken},cache:'no-store'
  });
  if(!response.ok)throw Error('Private GLB download failed: '+response.status);
  const blob=await response.blob();
  if(!blob.size||blob.size>15*1024*1024)throw Error('Model is too large.');
  return new File([blob],'tekntandao-tripo-'+job+'.glb',{type:'model/gltf-binary'});
 }
 async function doWithFile(callback){
  if(busy)return;busy=true;edit.disabled=true;download.disabled=true;
  try{await callback(await getModel());}
  catch(error){message('Model access failed: '+error.message);}
  finally{busy=false;edit.disabled=false;download.disabled=false;}
 }
 download.addEventListener('click',()=>doWithFile(async file=>{
  const url=URL.createObjectURL(file),a=document.createElement('a');
  a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
 }));
 edit.addEventListener('click',()=>doWithFile(async file=>{
  document.dispatchEvent(new CustomEvent('eng:open-view',{detail:{view:'pipeline',stage:'refine'}}));
  const viewer=await import('./engineering-fabrication-preview.js');
  await viewer.previewFile(file,$('fab-preview'),{sourceType:'ai'});
  message('Generated GLB opened in the free sculpt editor. Review dimensions; manually select edited STL for a quote if desired.');
  (document.getElementById('eng-pipeline')||$('fab-sculpt-workbench')).scrollIntoView({block:'start',behavior:'smooth'});
 }));
 return {setEnabled};
}
