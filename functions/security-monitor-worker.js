import {initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {monitor} from './security-monitor-probe.js';
import {newIssueCodes} from './security-monitor-alerts.js';
if(!getApps().length)initializeApp();
const db=getFirestore();
export const securityMonitorTick=onSchedule({schedule:'every 24 hours',timeZone:'Africa/Nairobi',region:'europe-west1',timeoutSeconds:300,maxInstances:1},async()=>{
 if(process.env.SECURITY_MONITOR_EXECUTION_ENABLED!=='true')return;
 const now=Date.now(),subs=await db.collection('securityMonitoringSubscriptions').where('status','==','active').limit(50).get();
 for(const doc of subs.docs){
  const s=doc.data();if(s.monitoringExecutionEnabled!==true||s.currentPeriodEnd?.toMillis()<=now)continue;
  const asset=await db.collection('securityAssets').doc(s.assetId).get();
  if(!asset.exists||asset.data().uid!==s.uid||asset.data().status!=='verified'||!asset.data().verificationToken)continue;
  const date=new Date().toISOString().slice(0,10),ref=db.collection('securityMonitorResults').doc(doc.id+'_'+date);
  const claimed=await db.runTransaction(async tx=>{const old=await tx.get(ref);if(old.exists)return false;tx.create(ref,{uid:s.uid,assetId:s.assetId,subscriptionId:doc.id,status:'running',createdAt:FieldValue.serverTimestamp()});return true});
  if(!claimed)continue;
  try{const observation=await monitor(asset.data().domain,asset.data().verificationToken);await ref.update({status:'completed',observation,updatedAt:FieldValue.serverTimestamp()});await recordAlerts(doc,s,observation,date)}
  catch(e){const observation={reachable:false,error:'Ownership or network validation failed'};await ref.update({status:'failed',observation,updatedAt:FieldValue.serverTimestamp()});await recordAlerts(doc,s,observation,date)}
 }
});

async function recordAlerts(doc,subscription,observation,date){
 const ref=doc.ref;
 await db.runTransaction(async tx=>{
  const current=await tx.get(ref);
  if(!current.exists||current.data().status!=='active'||current.data().monitoringExecutionEnabled!==true||current.data().currentPeriodEnd?.toMillis()<=Date.now())return;
  const changes=newIssueCodes(current.data().lastObservation||null,observation);
  tx.update(ref,{lastObservation:observation,lastCheckAt:FieldValue.serverTimestamp()});
  for(const code of changes){
   const alert=db.collection('securityMonitorAlerts').doc(doc.id+'_'+date+'_'+code);
   tx.create(alert,{uid:subscription.uid,assetId:subscription.assetId,subscriptionId:doc.id,code,deliveryStatus:'pending',attempts:0,createdAt:FieldValue.serverTimestamp()});
  }
 });
}
