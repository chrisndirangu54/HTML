import {randomUUID} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {onRequest} from 'firebase-functions/v2/https';
import {ispModules,integrationCatalog,normalizeRecord,transitionAllowed,correlateOutages,capacityHeuristic,customerRisk} from './isp_suite_core.js';

// Authenticated admin-only control plane. Its record workflows NEVER execute
// router/ONT operations, remote firmware commands, payments or outbound messages.
const allowOrigins=new Set(['https://www.tekntandao.com','https://tekntandao.com',
  'https://tekntandao.web.app','https://tekntandao.firebaseapp.com',
  'http://localhost:5500','http://127.0.0.1:5500',
  'http://localhost:5000','http://127.0.0.1:5000']);
// Resolve Firestore lazily after the shared Firebase entrypoint initializes the app.
const db={collection:(...args)=>getFirestore().collection(...args)};
const stamp=()=>FieldValue.serverTimestamp();
const err=(code,message)=>Object.assign(new Error(message),{status:code});
const modules=Object.keys(ispModules);
const auditCollection=db.collection('htmlIspAudit');
async function identify(req,adminOnly=true) {
 const bearer=String(req.headers.authorization||'');
 if(!bearer.startsWith('Bearer '))throw err(401,'Authentication required');
 let token;
 try{token=await getAuth().verifyIdToken(bearer.slice(7),true);}
 catch{throw err(401,'Invalid or expired identity token');}
 if(adminOnly&&token.role!=='admin')throw err(403,'Administrator role required');
 return token;
}
function cors(req,res) {
 const origin=req.headers.origin;
 res.set('Vary','Origin');
 if(origin&&!allowOrigins.has(origin))throw err(403,'Origin is not permitted');
 if(origin)res.set('Access-Control-Allow-Origin',origin);
 res.set('Access-Control-Allow-Headers','Authorization, Content-Type');
 res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');
}
const listRecords=async(mod,limit=150)=>{
 const snap=await db.collection(ispModules[mod].collection).limit(limit).get();
 return snap.docs.map(d=>({...d.data(),id:d.id,
  createdAt:d.data().createdAt?.toDate?.()?.toISOString?.()||null,
  updatedAt:d.data().updatedAt?.toDate?.()?.toISOString?.()||null,
 }));
};
async function overview() {
 const kinds=['sites','devices','subscribers','links','incidents','workOrders','support','telemetry','invoices','payments','provisioning'];
 const stats={};
 await Promise.all(kinds.map(async kind=>{
  const [count,items]=await Promise.all([
   db.collection(ispModules[kind].collection).count().get(),
   kind==='telemetry'?listRecords(kind,150):Promise.resolve(null),
  ]);
  stats[kind]=count.data().count;
  if(items){
   stats.manualTelemetry=items.length;
   stats.criticalSamples=items.filter(x=>x.health==='critical').length;
   stats.possibleSharedFaults=correlateOutages(items);
   stats.capacity=capacityHeuristic(items.slice().reverse());
  }
 }));
 return {stats,integrations:integrationCatalog,
  operational:false,telemetryLive:false,ispBillingLive:false,
  customerPaymentVerification:false,networkProvisioningLive:false,
  note:'Records, drafts and manual measurements are not live network data. All adapter integrations disabled.'};
}
function cleanBody(data,allowed) {
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!allowed.includes(k)))throw err(400,'Invalid request fields');
}
function moduleFor(value) {
 if(typeof value!=='string'||!Object.hasOwn(ispModules,value))throw err(400,'Unknown ISP module');
 return value;
}
function recordId(moduleName,record){
 if(moduleName==='subscribers')return record.accountCode;
 if(moduleName==='invoices')return record.invoiceCode.toUpperCase();
 return randomUUID();
}
async function createRecord(user,body) {
 cleanBody(body,['action','module','record']);
 const moduleName=moduleFor(body.module);
 const input=normalizeRecord(moduleName,body.record);
 const id=recordId(moduleName,input);
 const spec=ispModules[moduleName];
 // Validated invoice references cannot settle customer accounts without a bank callback.
 if(moduleName==='payments')input.verified=false;
 if(moduleName==='provisioning'||moduleName==='firmware'||moduleName==='policies')input.executed=false;
 const ref=db.collection(spec.collection).doc(id),audit=auditCollection.doc();
 const batch=db.batch();
 batch.create(ref,{...input,status:spec.workflow?.initial||'recorded',
  createdBy:user.uid,createdAt:stamp(),updatedAt:stamp()});
 batch.create(audit,{actor:user.uid,action:'create',module:moduleName,recordId:id,createdAt:stamp()});
 try{await batch.commit();}
 catch(e){if(String(e.code)==='6'||/already exists/i.test(String(e.message)))throw err(409,'Identifier already exists');throw e;}
 return {ok:true,module:moduleName,id,executed:false};
}
async function transition(user,body){
 cleanBody(body,['action','module','id','status']);
 const moduleName=moduleFor(body.module),spec=ispModules[moduleName];
 const id=String(body.id||'');
 if(!/^[A-Za-z0-9_-]{2,120}$/.test(id))throw err(400,'Invalid record ID');
 const to=String(body.status||'');
 const ref=db.collection(spec.collection).doc(id),audit=auditCollection.doc();
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists)throw err(404,'Record not found');
  if(!transitionAllowed(moduleName,snap.data().status,to))throw err(409,'Status transition is not allowed');
  tx.update(ref,{status:to,updatedBy:user.uid,updatedAt:stamp()});
  tx.create(audit,{actor:user.uid,action:'transition',module:moduleName,recordId:id,to,createdAt:stamp()});
 });
 return {ok:true,module:moduleName,id,status:to,executed:false};
}
async function serviceRequest(user,body){
 cleanBody(body,['action','site','service','message','consent']);
 const site=String(body.site||'').trim(),service=String(body.service||'').trim(),message=String(body.message||'').trim();
 if(site.length<3||site.length>120||message.length<8||message.length>800)throw err(400,'Invalid site or message');
 if(!['fiber_survey','wireless_survey','home_wifi','support_callback'].includes(service))throw err(400,'Invalid service');
 if(body.consent!==true)throw err(400,'Consent to contact is required');
 if(user.email_verified!==true)throw err(403,'Verify your email before requesting service');
 // Atomic per-user daily submission allowance. Does not expose personal data.
 const day=new Date().toISOString().slice(0,10),rateRef=db.collection('htmlIspRequestLimits').doc(user.uid+'_'+day);
 const requestRef=db.collection('htmlIspCustomerRequests').doc(),now=stamp();
 await db.runTransaction(async tx=>{
  const rate=await tx.get(rateRef);
  const used=rate.exists?rate.data().count||0:0;
  if(used>=3)throw err(429,'Daily limit of three requests reached');
  tx.set(rateRef,{uid:user.uid,day,count:used+1,updatedAt:now},{merge:true});
  tx.create(requestRef,{uid:user.uid,site,service,message,consent:true,status:'received_unassigned',
   email:user.email||'',createdAt:now});
 });
 return {ok:true,id:requestRef.id,status:'received_unassigned'};
}
export const ispSuiteApi=onRequest({region:'europe-west1',maxInstances:6,timeoutSeconds:30},async(req,res)=>{
 try{
  cors(req,res);
  if(req.method==='OPTIONS'){res.status(204).end();return;}
  if(!['GET','POST'].includes(req.method))throw err(405,'Method not allowed');
  const user=await identify(req);
  if(req.method==='GET'){
   const view=req.query?.view||'modules';
   if(view==='modules'){res.json({modules:ispModules,integrations:integrationCatalog});return;}
   if(view==='overview'){res.json(await overview());return;}
   if(view==='records'){const name=moduleFor(req.query?.module);res.json({module:name,records:await listRecords(name),limit:150});return;}
   if(view==='requests'){
    const snap=await db.collection('htmlIspCustomerRequests').limit(100).get();
    res.json({requests:snap.docs.map(d=>({...d.data(),id:d.id,createdAt:d.data().createdAt?.toDate?.()?.toISOString?.()||null}))});return;
   }
   throw err(400,'Unsupported view');
  }
  const body=req.body||{};
  if(body.action==='create'){res.json(await createRecord(user,body));return;}
  if(body.action==='transition'){res.json(await transition(user,body));return;}
  throw err(400,'Unsupported admin operation');
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'ISP request failed'});}
});
// A separate, narrowly scoped endpoint for verified Firebase users to submit
// service enquiries. It never discloses ISP admin data to customer accounts.
export const ispCustomerRequest=onRequest({region:'europe-west1',maxInstances:4,timeoutSeconds:30},async(req,res)=>{
 try{
  cors(req,res);
  if(req.method==='OPTIONS'){res.status(204).end();return;}
  if(req.method!=='POST')throw err(405,'POST required');
  const user=await identify(req,false);
  const result=await serviceRequest(user,req.body||{});
  res.json(result);
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'Service request failed'});}
});
