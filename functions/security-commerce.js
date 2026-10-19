import {initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {onRequest} from 'firebase-functions/v2/https';
if(!getApps().length)initializeApp();
const db=getFirestore();
const allowed=new Set(['https://tekntandao.web.app','https://tekntandao.firebaseapp.com','https://tekntandao.com','https://www.tekntandao.com']);
async function user(req){const t=String(req.headers.authorization||'');if(!t.startsWith('Bearer '))throw Object.assign(new Error('Sign in first'),{status:401});return getAuth().verifyIdToken(t.slice(7),true)}
const esc=s=>String(s||'').trim();
const fail=(code,message)=>{throw Object.assign(new Error(message),{status:code})};
export const securityCommerce=onRequest({region:'europe-west1',maxInstances:10},async(req,res)=>{
 const origin=req.headers.origin;if(origin&&allowed.has(origin))res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Authorization, Content-Type');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.set('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.status(204).end();return}
 try {
  if(origin&&!allowed.has(origin))fail(403,'Invalid origin');
  const u=await user(req);
  const path=String(req.path||'/').replace(/^\/api\/security-commerce/,'').replace(/\/+$/,'')||'/';
  if(req.method==='GET'&&path==='/blogs-admin'){
   if(u.role!=='admin')fail(403,'Admin only');
   const q=await db.collection('blogs').limit(100).get();res.json({blogs:q.docs.map(d=>({slug:d.id,...d.data()}))});return;
  }
  if(req.method==='POST'&&path==='/blogs-admin'){
   if(u.role!=='admin')fail(403,'Admin only');
   const b=req.body||{},slug=esc(b.slug||b.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-+$/g,'').slice(0,80);
   if(!slug||!esc(b.title)||esc(b.title).length>160)fail(400,'Invalid title');
   const body=Array.isArray(b.body)?b.body.map(x=>esc(x).slice(0,4000)).filter(Boolean).slice(0,30):esc(b.body).split(/\n\s*\n/).filter(Boolean).slice(0,30);
   if(!body.length)fail(400,'Article body required');
   const data={title:esc(b.title).slice(0,160),excerpt:esc(b.excerpt).slice(0,400),body,category:esc(b.category||'Cybersecurity').slice(0,80),cover:esc(b.cover).slice(0,500),published:b.published===true,source:'editor',updatedAt:FieldValue.serverTimestamp()};
   const ref=db.collection('blogs').doc(slug);const prior=await ref.get();
   await ref.set({...data,publishedAt:data.published?new Date().toISOString():null,...(!prior.exists?{createdAt:FieldValue.serverTimestamp()}:{})},{merge:true});
   res.json({slug,saved:true});return;
  }
  if(req.method==='POST'&&path==='/github-installations'){
   const id=Number(req.body?.installationId);
   if(!Number.isSafeInteger(id)||id<=0)fail(400,'Valid GitHub App installation ID required');
   // An installation ID is not proof of GitHub repo access. No token is minted at this stage.
   const ref=db.collection('securityGithubRequests').doc();
   await ref.set({uid:u.uid,installationId:id,status:'awaiting_installation_verification',createdAt:FieldValue.serverTimestamp()});
   res.status(202).json({id:ref.id,status:'awaiting_installation_verification'});return;
  }
  throw Object.assign(new Error('Route not found'),{status:404});
 }catch(e){res.status(e.status||401).json({error:e.status?e.message:'Authentication failed'})}
});
