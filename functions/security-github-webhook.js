import {createHmac,timingSafeEqual} from 'node:crypto';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {defineSecret} from 'firebase-functions/params';
import {onRequest} from 'firebase-functions/v2/https';
if(!getApps().length)initializeApp();
const db=getFirestore(),secret=defineSecret('GITHUB_SECURITY_WEBHOOK_SECRET');
export const securityGithubWebhook=onRequest({region:'europe-west1',secrets:[secret],maxInstances:3},async(req,res)=>{
 try{
 const signature=String(req.headers['x-hub-signature-256']||'');
 const expected='sha256='+createHmac('sha256',secret.value()).update(req.rawBody).digest('hex');
 if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return res.status(401).end();
 const event=String(req.headers['x-github-event']||'');
 const action=String(req.body?.action||'');
 const installationId=Number(req.body?.installation?.id);
 if(!Number.isSafeInteger(installationId)||installationId<1)return res.status(202).send('ignored');
 if(event==='installation'&&['deleted','suspend'].includes(action)){
  const q=await db.collection('securityGithubConnections').where('installationId','==',installationId).get();
  const batch=db.batch();q.docs.forEach(doc=>batch.update(doc.ref,{status:'revoked',revokedAt:FieldValue.serverTimestamp()}));await batch.commit();
 } else if(event==='installation'&&action==='unsuspend'){
  // Do not automatically restore access; require customer re-verification.
 }
 res.status(200).send('ok');
 }catch{res.status(500).end()}
});
