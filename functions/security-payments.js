import {createHmac,timingSafeEqual} from 'node:crypto';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
if(!getApps().length)initializeApp();
const db=getFirestore(),paystack=defineSecret('PAYSTACK_SECRET_KEY');
const amount=5000;
function error(status,message){throw Object.assign(new Error(message),{status})}
async function customer(req){const header=String(req.headers.authorization||'');if(!header.startsWith('Bearer '))error(401,'Authentication required');return getAuth().verifyIdToken(header.slice(7),true)}
export const securityPaystackCheckout=onRequest({region:'europe-west1',secrets:[paystack]},async(req,res)=>{
 try{
  if(req.method!=='POST')error(405,'Method not allowed');
  const u=await customer(req),assessmentId=String(req.body?.assessmentId||'');
  if(!/^[A-Za-z0-9_-]{8,100}$/.test(assessmentId))error(400,'Assessment required');
  const snap=await db.collection('securityAssessments').doc(assessmentId).get();
  if(!snap.exists||snap.data().uid!==u.uid||snap.data().status!=='approved_not_scheduled')error(403,'Assessment must be approved');
  if(!u.email)error(400,'Verified email required');
  const ref=db.collection('securityPayments').doc();
  await ref.set({uid:u.uid,assessmentId,amountKsh:amount,provider:'paystack',status:'pending',createdAt:FieldValue.serverTimestamp()});
  const response=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:'Bearer '+paystack.value(),'Content-Type':'application/json'},body:JSON.stringify({email:u.email,amount:amount*100,currency:'KES',reference:'SEC-'+ref.id,callback_url:'https://tekntandao.web.app/cybersecurity-portal.html?payment=return',metadata:{purpose:'security_assessment',assessmentId,paymentId:ref.id}})});
  const data=await response.json();
  if(!response.ok||data.status!==true){await ref.update({status:'init_failed'});error(502,'Payment provider did not initialize transaction')}
  res.json({paymentId:ref.id,amountKsh:amount,authorizationUrl:data.data.authorization_url});
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'Checkout error'})}
});
export const securityPaystackWebhook=onRequest({region:'europe-west1',secrets:[paystack]},async(req,res)=>{
 try{
  const sig=String(req.headers['x-paystack-signature']||'');const expected=createHmac('sha512',paystack.value()).update(req.rawBody).digest('hex');
  if(sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return res.status(401).end();
  if(req.body?.event==='charge.success'){
   const refString=String(req.body.data?.reference||'');
   if(/^SEC-[A-Za-z0-9_-]+$/.test(refString)){
    const id=refString.slice(4),ref=db.collection('securityPayments').doc(id),snap=await ref.get();
    if(snap.exists&&snap.data().provider==='paystack'&&Number(req.body.data.amount)===amount*100&&String(req.body.data.currency)==='KES'){
      await db.runTransaction(async tx=>{const latest=await tx.get(ref);if(latest.data()?.status==='paid')return;
       tx.update(ref,{status:'paid',paidAt:FieldValue.serverTimestamp(),providerReference:refString});
       tx.update(db.collection('securityAssessments').doc(snap.data().assessmentId),{paymentStatus:'paid',executionEnabled:false,updatedAt:FieldValue.serverTimestamp()});
      });
    }
   }
  }
  res.status(200).send('ok');
 }catch{res.status(500).end()}
});
