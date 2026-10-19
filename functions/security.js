import {randomBytes} from 'node:crypto';
import {resolveTxt} from 'node:dns/promises';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {onRequest} from 'firebase-functions/v2/https';
if(!getApps().length)initializeApp();
const db=getFirestore();
const origins=new Set(['https://tekntandao.web.app','https://tekntandao.firebaseapp.com','https://tekntandao.com','https://www.tekntandao.com']);
const deny=(status,message)=>Object.assign(new Error(message),{status});
const domainValid=s=>typeof s==='string'&&s.length<=253&&s.length>3&&/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(s)&&!s.endsWith('.local');
async function principal(req){const a=String(req.headers.authorization||'');if(!a.startsWith('Bearer '))throw deny(401,'Sign-in required');try{return await getAuth().verifyIdToken(a.slice(7),true)}catch{throw deny(401,'Session invalid')}}
const admin=user=>user.securityAdmin===true;
const serialize=s=>({id:s.id,...s.data(),createdAt:s.data().createdAt?.toDate?.()?.toISOString()||null,updatedAt:s.data().updatedAt?.toDate?.()?.toISOString()||null});
export const securityApi=onRequest({region:'europe-west1',timeoutSeconds:30,maxInstances:10,invoker:'public'},async(req,res)=>{
  const origin=req.headers.origin;if(origin&&origins.has(origin))res.set('Access-Control-Allow-Origin',origin);
  res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.set('Cache-Control','no-store');
  if(req.method==='OPTIONS'){res.status(origins.has(origin)?204:403).end();return}
  try{
    if(origin&&!origins.has(origin))throw deny(403,'Origin not permitted');
    const user=await principal(req);
    const path=(String(req.path||'/').replace(/^\/api\/security(?=\/|$)/,'').replace(/\/+$/,'')||'/');
    if(req.method==='POST'&&path==='/assets'){
      const domain=String(req.body?.domain||'').trim().toLowerCase();
      if(!domainValid(domain))throw deny(400,'Enter a valid public DNS domain; IP and private network targets are not permitted');
      const token=randomBytes(24).toString('hex');
      const ref=db.collection('securityAssets').doc();
      await ref.set({uid:user.uid,domain,verificationToken:token,status:'pending_dns',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
      res.status(201).json({id:ref.id,domain,status:'pending_dns',dnsHost:'_tekntandao-verify.'+domain,dnsValue:'tekntandao-verification='+token});return;
    }
    const match=path.match(/^\/assets\/([A-Za-z0-9_-]+)\/verify$/);
    if(req.method==='POST'&&match){
      const ref=db.collection('securityAssets').doc(match[1]);const doc=await ref.get();
      if(!doc.exists||(!admin(user)&&doc.data().uid!==user.uid))throw deny(404,'Asset not found');
      const a=doc.data();let values=[];try{values=(await resolveTxt('_tekntandao-verify.'+a.domain)).map(x=>x.join(''))}catch{}
      if(!values.includes('tekntandao-verification='+a.verificationToken))throw deny(409,'DNS TXT verification record not found');
      await ref.update({status:'verified',verifiedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
      res.json({id:doc.id,status:'verified'});return;
    }
    if(req.method==='GET'&&path==='/assets'){
      const snap=await db.collection('securityAssets').where('uid','==',user.uid).limit(100).get();
      res.json({assets:snap.docs.map(s=>{const o=serialize(s);delete o.verificationToken;return o})});return;
    }
    if(req.method==='POST'&&path==='/assessments'){
      const assetId=String(req.body?.assetId||'');
      if(!/^[A-Za-z0-9_-]{8,100}$/.test(assetId))throw deny(400,'Invalid asset ID');
      const a=await db.collection('securityAssets').doc(assetId).get();
      if(!a.exists||a.data().uid!==user.uid||a.data().status!=='verified')throw deny(403,'Verified owned asset required');
      const type=String(req.body?.type||'web');if(!['web','network'].includes(type))throw deny(400,'Unsupported assessment type');
      const ref=db.collection('securityAssessments').doc();
      await ref.set({uid:user.uid,assetId,domain:a.data().domain,type,status:'awaiting_admin_approval',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),executionEnabled:false});
      res.status(201).json({id:ref.id,status:'awaiting_admin_approval',executionEnabled:false});return;
    }
    if(req.method==='GET'&&path==='/assessments'){
      const snap=await db.collection('securityAssessments').where('uid','==',user.uid).limit(100).get();
      res.json({assessments:snap.docs.map(serialize)});return;
    }
    const ap=path.match(/^\/assessments\/([A-Za-z0-9_-]+)\/approve$/);
    if(req.method==='POST'&&ap){
      if(!admin(user))throw deny(403,'Security administrator permission required');
      const ref=db.collection('securityAssessments').doc(ap[1]);const snap=await ref.get();if(!snap.exists)throw deny(404,'Assessment not found');
      if(snap.data().status!=='awaiting_admin_approval')throw deny(409,'Assessment already processed');
      await ref.update({status:'approved_not_scheduled',approvedBy:user.uid,approvedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),executionEnabled:false});
      res.json({id:ref.id,status:'approved_not_scheduled',executionEnabled:false});return;
    }
    throw deny(404,'Unknown route');
  }catch(e){res.status(e.status||500).json({error:e.status?e.message:'Internal service error'})}
});
