import {createHmac,timingSafeEqual} from 'node:crypto';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue,Timestamp} from 'firebase-admin/firestore';
import {defineSecret} from 'firebase-functions/params';
import {onRequest} from 'firebase-functions/v2/https';
if(!getApps().length)initializeApp();
const db=getFirestore(),key=defineSecret('PAYSTACK_SECRET_KEY'),price=2500,periodDays=30;
function fail(status,message){throw Object.assign(new Error(message),{status})}
async function user(req){const a=String(req.headers.authorization||'');if(!a.startsWith('Bearer '))fail(401,'Sign-in required');try{return await getAuth().verifyIdToken(a.slice(7),true)}catch{fail(401,'Invalid session')}}
export const securityMonitoringCheckout=onRequest({region:'europe-west1',secrets:[key],maxInstances:5},async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{
  if(req.method!=='POST')fail(405,'POST only');
  const u=await user(req),assetId=String(req.body?.assetId||'');
  if(!/^[A-Za-z0-9_-]{8,100}$/.test(assetId))fail(400,'Verified asset ID required');
  const asset=await db.collection('securityAssets').doc(assetId).get();
  if(!asset.exists||asset.data().uid!==u.uid||asset.data().verified!==true)fail(403,'Asset must be owned and verified');
  if(!u.email)fail(400,'Account email required');
  const entitlementId=u.uid+'_'+assetId,entRef=db.collection('securityMonitoringSubscriptions').doc(entitlementId),old=await entRef.get();
  if(old.exists&&old.data().status==='active'&&old.data().currentPeriodEnd?.toMillis()>Date.now())fail(409,'Monitoring already paid for current period');
  const ref=db.collection('securityMonitoringPayments').doc();
  await ref.set({uid:u.uid,assetId,entitlementId,amountKsh:price,status:'pending',createdAt:FieldValue.serverTimestamp(),provider:'paystack',kind:'manual_30_day_renewal'});
  const response=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:'Bearer '+key.value(),'Content-Type':'application/json'},body:JSON.stringify({email:u.email,amount:price*100,currency:'KES',reference:'MON-'+ref.id,callback_url:'https://tekntandao.web.app/cybersecurity-portal.html?monitoring=return',metadata:{purpose:'security_monitoring',paymentId:ref.id,assetId}})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.status!==true||!result.data?.authorization_url){await ref.update({status:'init_failed'});fail(502,'Checkout could not be initialized')}
  return res.json({authorizationUrl:result.data.authorization_url,paymentId:ref.id,amountKsh:price,renewal:'manual_every_30_days'});
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'Unable to create monitoring checkout'})}
});
export const securityMonitoringWebhook=onRequest({region:'europe-west1',secrets:[key]},async(req,res)=>{
 try{
  const signature=String(req.headers['x-paystack-signature']||''),expected=createHmac('sha512',key.value()).update(req.rawBody).digest('hex');
  if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return res.status(401).end();
  if(req.body?.event!=='charge.success')return res.status(200).send('ignored');
  const reference=String(req.body?.data?.reference||'');
  if(!/^MON-[A-Za-z0-9_-]+$/.test(reference)||req.body.data.currency!=='KES'||Number(req.body.data.amount)!==price*100)return res.status(200).send('ignored');
  const paymentRef=db.collection('securityMonitoringPayments').doc(reference.slice(4)),payment=await paymentRef.get();
  if(!payment.exists||payment.data().provider!=='paystack')return res.status(200).send('ignored');
  const entitlementRef=db.collection('securityMonitoringSubscriptions').doc(payment.data().entitlementId);
  await db.runTransaction(async tx=>{
   const p=await tx.get(paymentRef),e=await tx.get(entitlementRef);
   if(!p.exists||p.data().status==='paid')return;
   const start=Math.max(Date.now(),e.exists&&e.data().currentPeriodEnd?.toMillis()>Date.now()?e.data().currentPeriodEnd.toMillis():0);
   const end=start+periodDays*86400000;
   tx.update(paymentRef,{status:'paid',paidAt:FieldValue.serverTimestamp(),providerReference:reference});
   tx.set(entitlementRef,{uid:p.data().uid,assetId:p.data().assetId,status:'active',amountKsh:price,currentPeriodEnd:Timestamp.fromMillis(end),updatedAt:FieldValue.serverTimestamp(),monitoringExecutionEnabled:false,renewalMode:'manual'}, {merge:true});
  });
  return res.status(200).send('ok');
 }catch{return res.status(500).end()}
});
export const securityMonitoringStatus=onRequest({region:'europe-west1'},async(req,res)=>{
 try{
  if(req.method!=='GET')fail(405,'GET only');
  const u=await user(req),assetId=String(req.query.assetId||'');
  if(!/^[A-Za-z0-9_-]{8,100}$/.test(assetId))fail(400,'Asset ID required');
  const ref=await db.collection('securityMonitoringSubscriptions').doc(u.uid+'_'+assetId).get();
  const v=ref.exists?ref.data():null;
  const active=v?.status==='active'&&v.currentPeriodEnd?.toMillis()>Date.now();
  res.json({active:!!active,monthlyPriceKsh:price,renewalMode:'manual',paidUntil:v?.currentPeriodEnd?.toDate().toISOString()||null,monitoringOperational:false});
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'Status error'})}
});
