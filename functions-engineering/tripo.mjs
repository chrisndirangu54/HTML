/* Tripo v3 generation: server secrets, credit reservation, async tasks, private GLBs. */
import {getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getAppCheck} from 'firebase-admin/app-check';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {onCall,onRequest,HttpsError} from 'firebase-functions/v2/https';
import {defineSecret,defineString} from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import {TRIPO_COST,TRIPO_MODEL,MAX_GLB,taskId,modelPrompt,imageBytes,safeUrl} from './tripo-core.mjs';
if(!getApps().length)initializeApp();
const db=getFirestore(),storage=getStorage(),region='europe-west1',opts={region,enforceAppCheck:true,maxInstances:20};
const KEY=defineSecret('ENGINEERING_TRIPO_API_KEY'),BUCKET=defineString('ENGINEERING_STORAGE_BUCKET',{default:''});
const wallets=()=>db.collection('engineeringWallets'),jobs=uid=>db.collection('engineeringTripoJobs').doc(uid).collection('tasks');
const clock=()=>FieldValue.serverTimestamp();
const bucket=()=>{const name=String(BUCKET.value()||'').trim();if(!name)throw new HttpsError('failed-precondition','Engineering Storage bucket is not configured.');return storage.bucket(name);};
function identity(req){const uid=req.auth?.uid;if(!uid||!req.auth.token?.email_verified)throw new HttpsError('unauthenticated','Verified sign-in required');return uid;}
async function wallet(uid){const ref=wallets().doc(uid);await db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)tx.create(ref,{balance:3,freeCreditsGranted:3,purchased:0,spent:0,createdAt:clock(),updatedAt:clock()});});return ref;}
async function api(path,body,form){
 const headers={Authorization:'Bearer '+KEY.value()};
 if(!form)headers['Content-Type']='application/json';
 const r=await fetch('https://openapi.tripo3d.ai/v3'+path,{method:body||form?'POST':'GET',headers,signal:AbortSignal.timeout(55000),...(form?{body:form}:body?{body:JSON.stringify(body)}:{})});
 const json=await r.json().catch(()=>null);
 if(!r.ok||json?.code!==0||!json?.data)throw Error('Tripo provider error: '+r.status);
 return json.data;
}
async function refund(uid,ref,reason){
 await db.runTransaction(async tx=>{
  const [j,w]=await Promise.all([tx.get(ref),tx.get(wallets().doc(uid))]);
  if(!j.exists||!['starting','processing','saving'].includes(j.data().status))return;
  tx.update(ref,{status:'refunded',reason,updatedAt:clock()});
  if(w.exists)tx.update(wallets().doc(uid),{balance:FieldValue.increment(j.data().cost),spent:FieldValue.increment(-j.data().cost),updatedAt:clock()});
 });
}
const details=(id,j)=>({jobId:id,status:j.status,progress:j.progress||0,cost:j.cost||TRIPO_COST});
export const engineeringTripoStart=onCall({...opts,secrets:[KEY],timeoutSeconds:120,memory:'512MiB'},async req=>{
 const uid=identity(req),id=taskId(req.data?.requestId),mode=req.data?.mode;
 if(mode!=='text'&&mode!=='image')throw new HttpsError('invalid-argument','Choose text or image');
 const prompt=mode==='text'?modelPrompt(req.data?.prompt):null;
 const picture=mode==='image'?imageBytes(req.data?.imageBase64,req.data?.imageMime):null;
 if(!KEY.value())throw new HttpsError('failed-precondition','Tripo key not configured');
 bucket();const ref=jobs(uid).doc(id),walletRef=await wallet(uid);
 await db.runTransaction(async tx=>{
  const [old,account]=await Promise.all([tx.get(ref),tx.get(walletRef)]);
  if(old.exists)throw new HttpsError('already-exists','Already submitted; resume task');
  if(!account.exists||account.data().balance<TRIPO_COST)throw new HttpsError('resource-exhausted','Insufficient engineering credits');
  tx.update(walletRef,{balance:FieldValue.increment(-TRIPO_COST),spent:FieldValue.increment(TRIPO_COST),updatedAt:clock()});
  tx.create(ref,{uid,mode,status:'starting',cost:TRIPO_COST,model:TRIPO_MODEL,createdAt:clock(),updatedAt:clock()});
 });
 try{
  const payload={model:TRIPO_MODEL,texture:false,pbr:false,face_limit:30000};let route='/generation/text-to-model';
  if(prompt)payload.prompt=prompt;
  else{
   const form=new FormData();
   form.append('file',new Blob([picture.bytes],{type:picture.mime}),'reference.'+picture.ext);
   const uploaded=await api('/files',null,form);
   if(!uploaded.file_token)throw Error('Image upload missing token');
   payload.input=uploaded.file_token;route='/generation/image-to-model';
  }
  const created=await api(route,payload,null);
  if(!/^[A-Za-z0-9_-]{8,120}$/.test(String(created.task_id||'')))throw Error('Provider task ID invalid');
  await ref.update({status:'processing',providerId:created.task_id,updatedAt:clock()});
  return details(id,{status:'processing',cost:TRIPO_COST});
 }catch(error){
  logger.error('Tripo creation failed',{message:String(error?.message||'Provider error')});
  await refund(uid,ref,'provider-start-failed');
  throw new HttpsError('unavailable','Generation did not start; credits refunded');
 }
});
export const engineeringTripoStatus=onCall({...opts,secrets:[KEY],timeoutSeconds:120,memory:'512MiB'},async req=>{
 const uid=identity(req),id=taskId(req.data?.jobId),ref=jobs(uid).doc(id),snapshot=await ref.get();
 if(!snapshot.exists)throw new HttpsError('not-found','Unknown task');
 const j=snapshot.data();
 if(['completed','refunded','starting','saving'].includes(j.status))return details(id,j);
 if(j.status!=='processing'||!j.providerId)throw new HttpsError('failed-precondition','Invalid task state');
 let remote;
 try{remote=await api('/tasks/'+encodeURIComponent(j.providerId),null,null);}
 catch(error){logger.warn('Tripo poll failed',{message:String(error?.message||'Status error')});throw new HttpsError('unavailable','Status temporarily unavailable; resume task');}
 if(['failed','cancelled','banned','expired'].includes(remote.status)){
  await refund(uid,ref,'provider-failed');
  return details(id,(await ref.get()).data());
 }
 if(remote.status!=='success')return details(id,{...j,progress:Math.max(0,Math.min(99,Number(remote.progress)||0))});
 const mine=await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.data()?.status!=='processing')return false;tx.update(ref,{status:'saving',updatedAt:clock()});return true;});
 if(!mine)return details(id,(await ref.get()).data());
 try{
  const r=await fetch(safeUrl(remote.output?.model_url),{redirect:'error',signal:AbortSignal.timeout(60000)});
  if(!r.ok||Number(r.headers.get('content-length')||0)>MAX_GLB)throw Error('GLB download rejected');
  const bytes=Buffer.from(await r.arrayBuffer());
  if(bytes.length<20||bytes.length>MAX_GLB||bytes.readUInt32LE(0)!==0x46546c67)throw Error('GLB invalid/oversize');
  const path='engineeringTripoModels/'+uid+'/'+id+'/model.glb';
  await bucket().file(path).save(bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0},metadata:{contentType:'model/gltf-binary',cacheControl:'private,no-store'}});
  await ref.update({status:'completed',progress:100,storagePath:path,bytes:bytes.length,completedAt:clock(),updatedAt:clock()});
  return details(id,{status:'completed',progress:100,cost:TRIPO_COST});
 }catch(error){
  logger.error('Tripo GLB storage failed',{message:String(error?.message||'Result error')});
  await refund(uid,ref,'result-unavailable');
  throw new HttpsError('unavailable','Model result could not be saved securely; credits refunded');
 }
});
export const engineeringTripoDownload=onRequest({region,cors:false,maxInstances:20,memory:'512MiB'},async(req,res)=>{
 if(req.method!=='GET')return res.status(405).end();
 try{
  const auth=String(req.headers.authorization||''),app=String(req.headers['x-firebase-appcheck']||'');
  if(!auth.startsWith('Bearer ')||!app)return res.status(401).end();
  await getAppCheck().verifyToken(app);
  const user=await getAuth().verifyIdToken(auth.slice(7),true);
  if(!user.email_verified)return res.status(401).end();
  const id=taskId(req.query.jobId),snap=await jobs(user.uid).doc(id).get(),j=snap.data();
  if(!snap.exists||j.uid!==user.uid||j.status!=='completed')return res.status(404).end();
  const path='engineeringTripoModels/'+user.uid+'/'+id+'/model.glb';
  if(j.storagePath!==path)return res.status(403).end();
  const [bytes]=await bucket().file(path).download();
  if(!bytes.length||bytes.length>MAX_GLB)throw Error('Invalid file');
  res.set('Content-Type','model/gltf-binary');res.set('Content-Disposition','attachment; filename="tekntandao-tripo.glb"');
  res.set('Cache-Control','private,no-store');res.set('X-Content-Type-Options','nosniff');
  return res.status(200).send(bytes);
 }catch(error){logger.warn('Tripo download refused',{message:String(error?.message||'Unauthorized')});return res.status(401).end();}
});
