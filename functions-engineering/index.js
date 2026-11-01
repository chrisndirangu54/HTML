import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {HttpsError,onCall,onRequest} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {defineSecret} from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import {FREE_CREDITS,AI_COST,PACKAGES,trim,validateDesign,validateUploadMeta,
  verifyPaidPurchase,allowAIQuestion,ALLOWED_TYPES} from './core.mjs';

if(!getApps().length)initializeApp();
const db=getFirestore(),storage=getStorage(),region='europe-west1';
const AI_KEY=defineSecret('ENGINEERING_GEMINI_API_KEY');
const PAYMENT_KEY=defineSecret('ENGINEERING_PAYSTACK_SECRET_KEY');
const AUTH_OPTIONS={region,enforceAppCheck:true,maxInstances:30};
const clock=()=>FieldValue.serverTimestamp();
const wallets=()=>db.collection('engineeringWallets');
const projects=()=>db.collection('engineeringProjects');
const purchases=()=>db.collection('engineeringPurchases');
const requests=uid=>db.collection('engineeringAiJobs').doc(uid).collection('requests');

function who(req){
 const uid=req.auth?.uid;
 if(!uid||!req.auth.token?.email_verified)throw new HttpsError('unauthenticated','Sign in with a verified email to use credits, upload designs or request fabrication.');
 return {uid,email:String(req.auth.token.email||'').toLowerCase()};
}
async function ensureWallet(uid){
 const ref=wallets().doc(uid);
 await db.runTransaction(async tx=>{
  const s=await tx.get(ref);
  if(!s.exists)tx.create(ref,{balance:FREE_CREDITS,freeCreditsGranted:FREE_CREDITS,
    purchased:0,spent:0,createdAt:clock(),updatedAt:clock()});
 });
 return ref;
}
const asError=e=>{
 if(e instanceof HttpsError)return e;
 logger.error('Engineering operation failure',{message:e?.message||String(e)});
 return new HttpsError('internal','Engineering service is temporarily unavailable.');
};
async function paystack(path,key,options={}){
 const response=await fetch('https://api.paystack.co'+path,{
  method:options.method||'GET',
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  ...(options.body?{body:JSON.stringify(options.body)}:{})
 });
 const json=await response.json();
 if(!response.ok||json.status!==true)throw new Error('Payment provider declined the request.');
 return json.data;
}
async function settle(reference){
 const ref=purchases().doc(reference),snap=await ref.get();
 if(!snap.exists)throw new HttpsError('not-found','Unknown purchase.');
 const order=snap.data();
 if(order.status==='paid')return {status:'paid'};
 if(order.status!=='awaiting_payment')throw new HttpsError('failed-precondition','Payment is not pending.');
 const provider=await paystack('/transaction/verify/'+encodeURIComponent(reference),PAYMENT_KEY.value());
 if(!verifyPaidPurchase({...order,reference},provider))return {status:'pending'};
 return db.runTransaction(async tx=>{
  const current=await tx.get(ref);
  if(current.data()?.status==='paid')return {status:'paid'};
  if(current.data()?.status!=='awaiting_payment')return {status:'pending'};
  const walletRef=wallets().doc(order.uid),wallet=await tx.get(walletRef);
  if(!wallet.exists)throw Error('Customer wallet missing.');
  tx.update(walletRef,{balance:FieldValue.increment(order.credits),purchased:FieldValue.increment(order.credits),updatedAt:clock()});
  tx.update(ref,{status:'paid',settledAt:clock(),providerTransactionId:String(provider.id||''),updatedAt:clock()});
  return {status:'paid'};
 });
}
export const engineeringAccount=onCall(AUTH_OPTIONS,async request=>{
 const {uid}=who(request);
 try{
  const ref=await ensureWallet(uid),snap=await ref.get(),account=snap.data();
  return {balance:account.balance,freeCreditsGranted:account.freeCreditsGranted,
    spent:account.spent,purchased:account.purchased,
    plans:PACKAGES,aiCost:AI_COST,configured:true};
 }catch(e){throw asError(e);}
});
export const engineeringAiAssist=onCall({...AUTH_OPTIONS,secrets:[AI_KEY],timeoutSeconds:120},async request=>{
 const {uid}=who(request);
 const question=allowAIQuestion(request.data?.question);
 const id=trim(request.data?.requestId,80);
 if(!/^[a-zA-Z0-9_-]{12,80}$/.test(id))throw new HttpsError('invalid-argument','Request identifier is invalid.');
 const context=trim(request.data?.context,1800),jobRef=requests(uid).doc(id);
 await ensureWallet(uid);
 try{
  await db.runTransaction(async tx=>{
   const [job,wallet]=await Promise.all([tx.get(jobRef),tx.get(wallets().doc(uid))]);
   if(job.exists)throw new HttpsError('already-exists','This AI request was already submitted. Refresh credits before retrying.');
   if(!wallet.exists||wallet.data().balance<AI_COST)throw new HttpsError('resource-exhausted','No AI credits left. Purchase credits to continue.');
   tx.update(wallets().doc(uid),{balance:FieldValue.increment(-AI_COST),spent:FieldValue.increment(AI_COST),updatedAt:clock()});
   tx.create(jobRef,{uid,status:'pending',cost:AI_COST,question,createdAt:clock()});
  });
 }catch(e){throw asError(e);}
 try{
  if(!AI_KEY.value())throw Error('AI provider secret is not configured.');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),75000);
  let result;
  try{
   const resp=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{
    method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','x-goog-api-key':AI_KEY.value()},
    body:JSON.stringify({
     systemInstruction:{parts:[{text:'You are a careful engineering design assistant. Provide requirements, manufacturability checks, alternatives, tolerances, bill-of-material suggestions and safety tests. This is educational design critique, not certified structural/electrical engineering or machine commands. Do not pretend a CAD file was generated, simulated, fabricated or approved. Say when a calculation or detail requires verification. Decline hazardous instructions.'}]},
     contents:[{role:'user',parts:[{text:'Prototype description: '+context+'\nUser request: '+question}]}],
     generationConfig:{temperature:0.25,maxOutputTokens:1050}
    })
   });
   result=await resp.json();
   if(!resp.ok)throw Error('Upstream model unavailable: '+resp.status);
  }finally{clearTimeout(timer);}
  const answer=trim((result.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('\n'),6500);
  if(answer.length<20)throw Error('Model returned no usable response.');
  await db.runTransaction(async tx=>{
   const job=await tx.get(jobRef);
   if(job.data()?.status!=='pending')throw Error('AI reservation expired before completion.');
   tx.update(jobRef,{status:'completed',answer,completedAt:clock()});
  });
  return {answer,cost:AI_COST,model:'gemini-2.5-flash',disclaimer:'Model-generated design advice; not verified CAD or a certified engineering analysis.'};
 }catch(e){
  // Failures cannot silently consume credits.
  await db.runTransaction(async tx=>{
   const job=await tx.get(jobRef);
   if(job.data()?.status!=='pending')return;
   const wallet=await tx.get(wallets().doc(uid));
   if(!wallet.exists)return;
   tx.update(wallets().doc(uid),{balance:FieldValue.increment(AI_COST),spent:FieldValue.increment(-AI_COST),updatedAt:clock()});
   tx.update(jobRef,{status:'refunded',updatedAt:clock(),failure:'model-unavailable'});
  });
  throw new HttpsError('unavailable','AI service unavailable. Your reserved credit has been refunded.');
 }
});
export const engineeringStartCheckout=onCall({...AUTH_OPTIONS,secrets:[PAYMENT_KEY]},async request=>{
 const {uid,email}=who(request);
 const planId=trim(request.data?.planId,20),pack=PACKAGES[planId];
 if(!pack)throw new HttpsError('invalid-argument','Choose a listed credit package.');
 if(!PAYMENT_KEY.value())throw new HttpsError('failed-precondition','Paid AI credits are not yet enabled by the merchant.');
 await ensureWallet(uid);
 const reference='eng_'+randomUUID().replace(/-/g,'');
 const doc=purchases().doc(reference);
 await doc.create({uid,email,planId,credits:pack.credits,amountKes:pack.amountKes,
  currency:'KES',status:'awaiting_payment',createdAt:clock(),updatedAt:clock()});
 try{
  const payment=await paystack('/transaction/initialize',PAYMENT_KEY.value(),{
   method:'POST',body:{
    email,reference,amount:pack.amountKes*100,currency:'KES',
    callback_url:'https://tekntandao.com/engineering-fabrication.html?payment=return',
    metadata:{uid,kind:'engineering-credits',planId}
   }
  });
  const url=new URL(payment.authorization_url);
  if(url.protocol!=='https:'||!['checkout.paystack.com','paystack.com'].includes(url.hostname))
   throw Error('Unexpected payment authorization host');
  return {reference,authorizationUrl:url.href,credits:pack.credits,amountKes:pack.amountKes};
 }catch(e){
  await doc.update({status:'init_failed',updatedAt:clock()});
  throw new HttpsError('unavailable','Unable to initialize secure payment. No credits were charged.');
 }
});
export const engineeringConfirmCheckout=onCall({...AUTH_OPTIONS,secrets:[PAYMENT_KEY]},async request=>{
 const {uid}=who(request),reference=trim(request.data?.reference,90);
 if(!/^eng_[0-9a-f]{32}$/.test(reference))throw new HttpsError('invalid-argument','Invalid payment reference.');
 const doc=await purchases().doc(reference).get();
 if(!doc.exists||doc.data().uid!==uid)throw new HttpsError('permission-denied','Payment reference does not belong to this account.');
 if(doc.data().status==='paid')return {status:'paid'};
 if(!PAYMENT_KEY.value())throw new HttpsError('failed-precondition','Payment integration is not configured.');
 try{return await settle(reference);}catch(e){throw asError(e);}
});
export const engineeringPaystackWebhook=onRequest({region,secrets:[PAYMENT_KEY],maxInstances:10},async(req,res)=>{
 if(req.method!=='POST')return res.status(405).send('POST required');
 const signature=String(req.headers['x-paystack-signature']||'');
 const expected=createHmac('sha512',PAYMENT_KEY.value()).update(req.rawBody).digest('hex');
 if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))
  return res.status(401).send('Invalid signature');
 if(req.body?.event!=='charge.success')return res.status(200).send('Ignored');
 const ref=trim(req.body?.data?.reference,90);
 if(!/^eng_[0-9a-f]{32}$/.test(ref))return res.status(200).send('Ignored');
 try{await settle(ref);return res.status(200).send('Verified');}
 catch(e){logger.error('Engineering payment settlement failed',e);return res.status(500).send('Retry later');}
});
export const engineeringCreateProject=onCall(AUTH_OPTIONS,async request=>{
 const {uid}=who(request);
 let spec;
 try{spec=validateDesign(request.data);}catch(e){throw new HttpsError('invalid-argument',e.message);}
 const ref=projects().doc();
 await ref.create({uid,...spec,status:'draft',file:null,
  consentToReview:false,createdAt:clock(),updatedAt:clock()});
 return {projectId:ref.id,storagePath:spec.kind==='upload'?'engineeringFiles/'+uid+'/'+ref.id+'/design':null};
});
export const engineeringSubmitProject=onCall(AUTH_OPTIONS,async request=>{
 const {uid}=who(request),projectId=trim(request.data?.projectId,80);
 if(!/^[a-zA-Z0-9]{16,80}$/.test(projectId))throw new HttpsError('invalid-argument','Invalid fabrication project.');
 if(request.data?.consentToReview!==true)throw new HttpsError('failed-precondition','Confirm that TeknTandao may review this design for a quotation.');
 const ref=projects().doc(projectId),snap=await ref.get();
 if(!snap.exists||snap.data().uid!==uid)throw new HttpsError('permission-denied','Project not found for this account.');
 if(snap.data().status==='submitted_for_review')return {status:'submitted_for_review',projectId};
 if(snap.data().status!=='draft')throw new HttpsError('failed-precondition','Project cannot be resubmitted.');
 let file=null;
 if(snap.data().kind==='upload'){
  const ext=trim(request.data?.ext,10).toLowerCase();
  if(!Object.hasOwn(ALLOWED_TYPES,ext))throw new HttpsError('invalid-argument','Unsupported design file.');
  const path='engineeringFiles/'+uid+'/'+projectId+'/design.'+ext;
  const [metadata]=await storage.bucket().file(path).getMetadata().catch(()=>[null]);
  if(!metadata)throw new HttpsError('failed-precondition','Upload your design file before requesting fabrication.');
  try{file=validateUploadMeta(path,uid,projectId,{ext,size:Number(metadata.size)});}
  catch(e){throw new HttpsError('invalid-argument',e.message);}
 }
 await db.runTransaction(async tx=>{
  const current=await tx.get(ref);
  if(current.data()?.status!=='draft')return;
  tx.update(ref,{status:'submitted_for_review',file,consentToReview:true,submittedAt:clock(),updatedAt:clock()});
 });
 return {projectId,status:'submitted_for_review',message:'Submitted for operator review. This is not a price or fabrication order.'};
});
// Binary upload is authenticated server-side. No changes to shared Storage rules.
export const engineeringUploadDesign=onRequest({region,maxInstances:20,cors:false,memory:'512MiB'},async(req,res)=>{
 const origin=String(req.headers.origin||'');
 const allowed=origin==='https://tekntandao.com'||origin==='https://www.tekntandao.com'||
  /^https:\/\/tekntandao--[a-z0-9-]+\.web\.app$/.test(origin)||
  /^http:\/\/localhost(:[0-9]+)?$/.test(origin)||/^http:\/\/127\.0\.0\.1(:[0-9]+)?$/.test(origin);
 if(origin&&!allowed)return res.status(403).json({error:'Origin not allowed'});
 if(allowed){res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');}
 res.set('Access-Control-Allow-Headers','Authorization,Content-Type,X-Project-Id,X-File-Extension');
 res.set('Access-Control-Allow-Methods','POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 try{
  const idToken=String(req.headers.authorization||'').replace(/^Bearer /i,'');
  if(!idToken) return res.status(401).json({error:'Sign in first'});
  const user=await getAuth().verifyIdToken(idToken,true);
  if(!user.email_verified) return res.status(401).json({error:'Verified email required'});
  const projectId=trim(req.headers['x-project-id'],80),ext=trim(req.headers['x-file-extension'],10).toLowerCase();
  if(!/^[A-Za-z0-9]{16,80}$/.test(projectId)||!Object.hasOwn(ALLOWED_TYPES,ext))
    return res.status(400).json({error:'Invalid project or file format'});
  const bytes=req.rawBody;
  if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>15*1024*1024)
    return res.status(413).json({error:'Design must be a nonempty file of at most 15 MB'});
  const doc=await projects().doc(projectId).get();
  if(!doc.exists||doc.data().uid!==user.uid||doc.data().kind!=='upload'||doc.data().status!=='draft')
    return res.status(403).json({error:'This account has no draft upload project with this identifier'});
  const pathname='engineeringFiles/'+user.uid+'/'+projectId+'/design.'+ext;
  const file=storage.bucket().file(pathname);
  try{
   await file.save(bytes,{resumable:false,validation:'crc32c',
     contentType:ALLOWED_TYPES[ext],preconditionOpts:{ifGenerationMatch:0},
     metadata:{metadata:{projectId,uid:user.uid,review:'unscanned'}}});
  }catch(e){
   if(e?.code===412)return res.status(409).json({error:'File already uploaded; create a new project to replace it.'});
   throw e;
  }
  return res.status(201).json({path:pathname,size:bytes.length,extension:ext,
    status:'uploaded_unscanned',message:'File received securely; not yet validated for fabrication.'});
 }catch(e){
  logger.error('Engineering upload error',{message:e?.message});
  return res.status(500).json({error:'Could not upload file. Check authentication and storage configuration.'});
 }
});
export const engineeringAdminReviewProject=onCall(AUTH_OPTIONS,async request=>{
 const {uid}=who(request);
 if(request.auth?.token?.engineering_admin!==true)
  throw new HttpsError('permission-denied','Only an authorized engineering operator can review quotations.');
 const projectId=trim(request.data?.projectId,80),next=trim(request.data?.status,36),
  note=trim(request.data?.note,2000);
 if(!/^[A-Za-z0-9]{16,80}$/.test(projectId)||
    !['needs_revision','quoted','declined'].includes(next))
  throw new HttpsError('invalid-argument','Invalid project or review status.');
 const price=Number(request.data?.quoteKes);
 if(next==='quoted'&&(!Number.isSafeInteger(price)||price<=0||price>100000000))
  throw new HttpsError('invalid-argument','Quoted cost must be a positive whole-KES amount.');
 const ref=projects().doc(projectId);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists||!['submitted_for_review','needs_revision'].includes(snap.data().status))
   throw new HttpsError('failed-precondition','Project is not awaiting review.');
  tx.update(ref,{status:next,quoteKes:next==='quoted'?price:null,
    operatorNote:note,reviewedBy:uid,reviewedAt:clock(),updatedAt:clock()});
 });
 return {projectId,status:next,quoteKes:next==='quoted'?price:null};
});
export const engineeringListProjects=onCall(AUTH_OPTIONS,async request=>{
 const {uid}=who(request);
 const snapshot=await projects().where('uid','==',uid).limit(50).get();
 return {projects:snapshot.docs.map(x=>({id:x.id,title:x.data().title,
  kind:x.data().kind,process:x.data().process,status:x.data().status,
  createdAt:x.data().createdAt?.toDate()?.toISOString()||null})).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))};
});
// Refund stale model reservations after 30 min, e.g. if an instance terminated.
export const engineeringRecoverStaleCredits=onSchedule({region,schedule:'every 30 minutes'},async()=>{
 const cutoff=new Date(Date.now()-30*60*1000);
 const walletsProcessed=new Set();
 const groups=await db.collectionGroup('requests').where('status','==','pending')
  .where('createdAt','<',cutoff).limit(75).get();
 for(const snap of groups.docs){
  const uid=snap.ref.parent.parent?.id;
  if(!uid)continue;
  await db.runTransaction(async tx=>{
   const [job,wallet]=await Promise.all([tx.get(snap.ref),tx.get(wallets().doc(uid))]);
   if(!job.exists||job.data().status!=='pending'||!wallet.exists)return;
   tx.update(wallets().doc(uid),{balance:FieldValue.increment(job.data().cost||1),
     spent:FieldValue.increment(-(job.data().cost||1)),updatedAt:clock()});
   tx.update(snap.ref,{status:'refunded',failure:'timeout',updatedAt:clock()});
  });
  walletsProcessed.add(uid);
 }
 logger.info('Engineering AI stale-reservation recovery',{users:walletsProcessed.size});
});