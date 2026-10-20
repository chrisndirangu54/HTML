import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {onRequest} from 'firebase-functions/v2/https';
if(!getApps().length)initializeApp();
const db=getFirestore();
export const securityMonitoringControls=onRequest({region:'europe-west1'},async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const h=String(req.headers.authorization||'');
  if(!h.startsWith('Bearer '))return res.status(401).json({error:'Sign in required'});
  const u=await getAuth().verifyIdToken(h.slice(7),true);
  const assetId=String(req.body?.assetId||''),action=String(req.body?.action||'');
  if(!/^[A-Za-z0-9_-]{8,100}$/.test(assetId)||!['pause','resume','cancel'].includes(action))return res.status(400).json({error:'Invalid request'});
  const assetRef=db.collection('securityAssets').doc(assetId),subRef=db.collection('securityMonitoringSubscriptions').doc(u.uid+'_'+assetId);
  await db.runTransaction(async tx=>{
   const [a,s]=await Promise.all([tx.get(assetRef),tx.get(subRef)]);
   if(!a.exists||a.data().uid!==u.uid||!s.exists||s.data().uid!==u.uid)throw Object.assign(new Error('Subscription unavailable'),{code:404});
   const paid=s.data().currentPeriodEnd?.toMillis()>Date.now()&&s.data().status==='active';
   if(action==='resume'&&(!paid||a.data().status!=='verified'))throw Object.assign(new Error('Valid paid subscription and verified asset required'),{code:409});
   const patch={updatedAt:FieldValue.serverTimestamp()};
   if(action==='cancel'){patch.status='cancelled';patch.monitoringExecutionEnabled=false;patch.renewalMode='manual';patch.cancelledAt=FieldValue.serverTimestamp()}
   else if(action==='pause'){patch.monitoringExecutionEnabled=false;patch.customerPaused=true}
   else{patch.customerPaused=false;patch.monitoringExecutionEnabled=false} // admin must separately activate safe worker
   tx.update(subRef,patch);
  });
  return res.json({action,monitoringExecutionEnabled:false,message:action==='resume'?'Resume requested; monitoring requires operator activation':'Updated'});
 }catch(e){return res.status(e.code||500).json({error:e.code?e.message:'Unable to update monitoring settings'})}
});
