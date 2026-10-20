import {initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldValue,Timestamp} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {defineSecret} from 'firebase-functions/params';
import {onSchedule} from 'firebase-functions/v2/scheduler';
if(!getApps().length)initializeApp();
const db=getFirestore();
const mailKey=defineSecret('SECURITY_ALERT_EMAIL_API_KEY');
export const securityAlertDelivery=onSchedule({schedule:'every 15 minutes',region:'europe-west1',secrets:[mailKey],maxInstances:1},async()=>{
 if(process.env.SECURITY_EMAIL_DELIVERY_ENABLED!=='true'||!process.env.SECURITY_ALERT_FROM_EMAIL)return;
 // Release expired delivery leases; idempotency key prevents duplicate provider sends.
 const stale=await db.collection('securityMonitorAlerts').where('deliveryStatus','==','sending').limit(25).get();
 for(const a of stale.docs){if((a.data().claimedAt?.toMillis()||Date.now())<Date.now()-15*60000)await a.ref.update({deliveryStatus:'pending'});}
 const snap=await db.collection('securityMonitorAlerts').where('deliveryStatus','==','pending').limit(25).get();
 for(const alert of snap.docs){
  const accepted=await db.runTransaction(async tx=>{
   const d=await tx.get(alert.ref);
   if(!d.exists||d.data().deliveryStatus!=='pending'||(d.data().nextAttemptAt?.toMillis()||0)>Date.now())return false;
   tx.update(alert.ref,{deliveryStatus:'sending',claimedAt:FieldValue.serverTimestamp()});return true;
  });
  if(!accepted)continue;
  try{
   const a=alert.data(),sub=await db.collection('securityMonitoringSubscriptions').doc(a.subscriptionId).get();
   if(!sub.exists||sub.data().uid!==a.uid||sub.data().status!=='active'||sub.data().currentPeriodEnd?.toMillis()<=Date.now()||sub.data().emailAlertsEnabled!==true){await alert.ref.update({deliveryStatus:'suppressed'});continue}
   const recipient=await getAuth().getUser(a.uid);
   if(!recipient.email||recipient.disabled)throw Error('Recipient unavailable');
   const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+mailKey.value(),'Content-Type':'application/json','Idempotency-Key':alert.id},body:JSON.stringify({from:process.env.SECURITY_ALERT_FROM_EMAIL,to:[recipient.email],subject:'TeknTandao security monitoring update',text:'A new monitoring finding was recorded. Please sign in to your TeknTandao dashboard to review it.'}),signal:AbortSignal.timeout(10000)});
   if(!result.ok)throw Error('Email delivery failed');
   await alert.ref.update({deliveryStatus:'delivered',deliveredAt:FieldValue.serverTimestamp()});
  }catch{
   const attempts=(Number(alert.data().attempts)||0)+1;
   await alert.ref.update({attempts,deliveryStatus:attempts>=5?'needs_attention':'pending',nextAttemptAt:Timestamp.fromMillis(Date.now()+Math.min(60,Math.pow(2,attempts))*60000)});
  }
 }
});
