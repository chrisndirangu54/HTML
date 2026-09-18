import {createHmac} from 'node:crypto';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue,getFirestore} from 'firebase-admin/firestore';
import {onRequest} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {defineSecret,defineString} from 'firebase-functions/params';

initializeApp();
const db=getFirestore();
const adminAuth=getAuth();
const mpesaKey=defineSecret('MPESA_CONSUMER_KEY');
const mpesaSecret=defineSecret('MPESA_CONSUMER_SECRET');
const mpesaPasskey=defineSecret('MPESA_PASSKEY');
const mpesaShortcode=defineSecret('MPESA_SHORTCODE');
const mpesaCallbackUrl=defineSecret('MPESA_CALLBACK_URL');
const paystackKey=defineSecret('PAYSTACK_SECRET_KEY');
const xaiKey=defineSecret('XAI_API_KEY');
const adminEmails=defineString('ADMIN_EMAILS',{default:''});
const allowed=new Set(['https://www.tekntandao.com','https://tekntandao.com','http://localhost:5500','http://127.0.0.1:5500']);
const staffRoles=new Set(['admin','attendant','delivery']);
const orderStatuses=new Set(['pending','payment_init_failed','payment_failed','paid','processing','ready_for_delivery','out_for_delivery','delivered','cancelled']);

function cors(req,res){
  const origin=req.headers.origin;
  if(origin&&allowed.has(origin))res.set('Access-Control-Allow-Origin',origin);
  res.set('Vary','Origin');
  res.set('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS'){res.status(204).send('');return true}
  return false;
}
const fail=(res,status,msg)=>res.status(status).json({error:msg});
const cleanText=(value,max=240)=>String(value||'').trim().slice(0,max);
const cleanPhone=value=>String(value||'').replace(/\D/g,'').slice(-15);
const cleanTimestamp=value=>value?.toDate?.().toISOString?.()||value||null;
function adminAllowlist(){return new Set(adminEmails.value().split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))}

async function identity(req,roles=null){
  const header=String(req.headers.authorization||'');
  if(!header.startsWith('Bearer ')){const e=new Error('Authentication required');e.status=401;throw e}
  let token;
  try{token=await adminAuth.verifyIdToken(header.slice(7))}catch{const e=new Error('Invalid or expired session');e.status=401;throw e}
  const role=staffRoles.has(token.role)?token.role:'customer';
  if(roles&&!roles.includes(role)){const e=new Error('You do not have permission for this action');e.status=403;throw e}
  return{uid:token.uid,email:token.email||'',emailVerified:token.email_verified===true,name:token.name||'',role,token};
}
async function respond(req,res,handler){
  try{if(cors(req,res))return;const value=await handler();if(!res.headersSent)res.json(value??{ok:true})}catch(e){if(!res.headersSent)fail(res,e.status||400,String(e.message||e))}
}
function normalizeItems(items){
  if(!Array.isArray(items)||!items.length||items.length>30)throw new Error('Invalid cart');
  return items.map(x=>({productId:String(x.productId||'').trim(),quantity:Number(x.quantity)})).map(x=>{
    if(!/^[a-z0-9_-]{2,80}$/i.test(x.productId)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>20)throw new Error('Invalid cart item');
    return x;
  });
}
async function priceCart(items){
  const clean=normalizeItems(items);const rows=[];let totalKsh=0;
  for(const item of clean){
    const snap=await db.collection('products').doc(item.productId).get();
    if(!snap.exists)throw new Error(`Product ${item.productId} not found`);
    const p=snap.data();
    if(p.active!==true)throw new Error(`${p.name||item.productId} is unavailable`);
    const priceKsh=Number(p.priceKsh);
    if(!Number.isInteger(priceKsh)||priceKsh<1)throw new Error('Invalid product price');
    if(Number.isInteger(p.stock)&&p.stock<item.quantity)throw new Error(`Not enough stock for ${p.name}`);
    rows.push({productId:item.productId,name:String(p.name||item.productId),quantity:item.quantity,priceKsh,lineTotalKsh:priceKsh*item.quantity});
    totalKsh+=priceKsh*item.quantity;
  }
  return{items:rows,totalKsh};
}
async function createOrder(req,provider,user){
  const cart=await priceCart(req.body?.items);
  const ref=db.collection('orders').doc();
  const email=cleanText(req.body?.email||user.email,200);
  const customer={uid:user.uid,name:cleanText(req.body?.name||user.name,120),email,phone:cleanPhone(req.body?.phone),address:cleanText(req.body?.address,500)};
  await ref.set({orderId:ref.id,provider,status:'pending',customer,...cart,assignedAttendantUid:null,assignedDeliveryUid:null,statusHistory:[{status:'pending',by:user.uid,at:new Date().toISOString()}],createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  return{ref,cart,customer};
}
function serializeOrder(doc){const row=doc.data();return{...row,id:doc.id,createdAt:cleanTimestamp(row.createdAt),updatedAt:cleanTimestamp(row.updatedAt)}}
async function setRole(uid,role,actorUid){
  if(!['admin','attendant','delivery','customer'].includes(role))throw new Error('Invalid role');
  const user=await adminAuth.getUser(uid);
  const claims={...(user.customClaims||{})};
  if(role==='customer')delete claims.role;else claims.role=role;
  await adminAuth.setCustomUserClaims(uid,claims);
  await db.collection('staffProfiles').doc(uid).set({uid,email:user.email||'',displayName:user.displayName||'',role,active:role!=='customer',updatedBy:actorUid,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return{uid,email:user.email||'',role};
}
function assertMethod(req,method){if(req.method!==method){const e=new Error(`${method} required`);e.status=405;throw e}}

export const getSession=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'GET');const user=await identity(req);return{uid:user.uid,email:user.email,name:user.name,role:user.role,emailVerified:user.emailVerified,adminBootstrapAvailable:user.emailVerified&&adminAllowlist().has(user.email.toLowerCase())};
}));

export const bootstrapAdmin=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'POST');const user=await identity(req);
  if(!user.emailVerified||!adminAllowlist().has(user.email.toLowerCase())){const e=new Error('This account is not configured as a bootstrap administrator');e.status=403;throw e}
  return{...(await setRole(user.uid,'admin',user.uid)),refreshToken:true};
}));

export const getMyOrders=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'GET');const user=await identity(req);const q=await db.collection('orders').where('customer.uid','==',user.uid).limit(100).get();
  return{orders:q.docs.map(serializeOrder).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))};
}));

export const getStaffOrders=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'GET');const user=await identity(req,['admin','attendant','delivery']);let docs=[];
  if(user.role==='delivery'){const q=await db.collection('orders').where('assignedDeliveryUid','==',user.uid).limit(150).get();docs=q.docs}
  else{const q=await db.collection('orders').limit(250).get();docs=q.docs}
  let rows=docs.map(serializeOrder);
  if(user.role==='attendant')rows=rows.filter(x=>['paid','processing','ready_for_delivery'].includes(x.status)&&(!x.assignedAttendantUid||x.assignedAttendantUid===user.uid));
  return{role:user.role,orders:rows.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))};
}));

export const adminListStaff=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'GET');await identity(req,['admin']);let token;const users=[];
  do{const page=await adminAuth.listUsers(1000,token);for(const u of page.users){const role=staffRoles.has(u.customClaims?.role)?u.customClaims.role:'customer';users.push({uid:u.uid,email:u.email||'',displayName:u.displayName||'',role,disabled:u.disabled,emailVerified:u.emailVerified})}token=page.pageToken}while(token);
  return{users:users.sort((a,b)=>a.email.localeCompare(b.email))};
}));

export const adminSetStaffRole=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'POST');const admin=await identity(req,['admin']);const role=cleanText(req.body?.role,30);let uid=cleanText(req.body?.uid,128);
  if(!uid&&req.body?.email){const u=await adminAuth.getUserByEmail(cleanText(req.body.email,200));uid=u.uid}
  if(!uid)throw new Error('User UID or email required');
  if(uid===admin.uid&&role!=='admin')throw new Error('An administrator cannot demote their own active session');
  return setRole(uid,role,admin.uid);
}));

export const adminAssignOrder=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'POST');const admin=await identity(req,['admin']);const orderId=cleanText(req.body?.orderId,128);const attendantUid=cleanText(req.body?.attendantUid,128);const deliveryUid=cleanText(req.body?.deliveryUid,128);if(!orderId)throw new Error('Order required');
  const patch={updatedAt:FieldValue.serverTimestamp(),assignmentUpdatedBy:admin.uid};
  if(attendantUid){const u=await adminAuth.getUser(attendantUid);if(u.customClaims?.role!=='attendant'&&u.customClaims?.role!=='admin')throw new Error('Selected user is not an attendant');patch.assignedAttendantUid=attendantUid}
  if(deliveryUid){const u=await adminAuth.getUser(deliveryUid);if(u.customClaims?.role!=='delivery'&&u.customClaims?.role!=='admin')throw new Error('Selected user is not a delivery user');patch.assignedDeliveryUid=deliveryUid}
  await db.collection('orders').doc(orderId).update(patch);return{orderId,...patch};
}));

export const updateOrderStatus=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'POST');const user=await identity(req,['admin','attendant','delivery']);const orderId=cleanText(req.body?.orderId,128);const next=cleanText(req.body?.status,40);if(!orderStatuses.has(next))throw new Error('Invalid order status');const ref=db.collection('orders').doc(orderId);const snap=await ref.get();if(!snap.exists)throw new Error('Order not found');const order=snap.data();const current=order.status;
  const attendantTransitions={paid:['processing'],processing:['ready_for_delivery']};
  const deliveryTransitions={ready_for_delivery:['out_for_delivery'],out_for_delivery:['delivered']};
  if(user.role==='attendant'){
    if(order.assignedAttendantUid&&order.assignedAttendantUid!==user.uid){const e=new Error('Order is assigned to another attendant');e.status=403;throw e}
    if(!(attendantTransitions[current]||[]).includes(next))throw new Error(`Attendant cannot change ${current} to ${next}`);
  }
  if(user.role==='delivery'){
    if(order.assignedDeliveryUid!==user.uid){const e=new Error('Delivery is not assigned to this account');e.status=403;throw e}
    if(!(deliveryTransitions[current]||[]).includes(next))throw new Error(`Delivery cannot change ${current} to ${next}`);
  }
  const patch={status:next,updatedAt:FieldValue.serverTimestamp(),statusHistory:FieldValue.arrayUnion({status:next,by:user.uid,role:user.role,at:new Date().toISOString()})};
  if(user.role==='attendant'&&!order.assignedAttendantUid)patch.assignedAttendantUid=user.uid;
  await ref.update(patch);return{orderId,status:next};
}));

export const adminListProducts=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'GET');await identity(req,['admin']);const q=await db.collection('products').limit(500).get();return{products:q.docs.map(d=>({id:d.id,...d.data()}))};
}));

export const adminSaveProduct=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'POST');const admin=await identity(req,['admin']);const input=req.body?.product||{};const id=cleanText(input.id||req.body?.productId,80).toLowerCase().replace(/[^a-z0-9_-]/g,'-');if(!id||id.length<2)throw new Error('Product id required');const priceKsh=Number(input.priceKsh);const stock=Number(input.stock);if(!Number.isInteger(priceKsh)||priceKsh<1)throw new Error('Valid integer KES price required');if(!Number.isInteger(stock)||stock<0)throw new Error('Valid stock required');const row={name:cleanText(input.name,160),description:cleanText(input.description,1200),category:cleanText(input.category,80),image:cleanText(input.image,800),referenceUrl:cleanText(input.referenceUrl,800),marketReference:cleanText(input.marketReference,160),imageCredit:cleanText(input.imageCredit,240),priceKsh,stock,active:input.active!==false,updatedBy:admin.uid,updatedAt:FieldValue.serverTimestamp()};if(!row.name)throw new Error('Product name required');await db.collection('products').doc(id).set(row,{merge:true});return{productId:id};
}));

export const adminListContent=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'GET');await identity(req,['admin']);const q=await db.collection('siteContent').limit(500).get();return{items:q.docs.map(d=>({id:d.id,...d.data(),createdAt:cleanTimestamp(d.data().createdAt),updatedAt:cleanTimestamp(d.data().updatedAt)})).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))};
}));

export const adminSaveContent=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'POST');const admin=await identity(req,['admin']);const input=req.body?.item||{};const allowedTypes=new Set(['event','training','award','gallery','podcast','community']);const type=cleanText(input.type,30).toLowerCase();if(!allowedTypes.has(type))throw new Error('Invalid content type');const title=cleanText(input.title,200);if(!title)throw new Error('Content title required');const id=cleanText(input.id,120).toLowerCase().replace(/[^a-z0-9_-]/g,'-');const ref=id?db.collection('siteContent').doc(id):db.collection('siteContent').doc();const row={type,title,description:cleanText(input.description,3000),mediaUrl:cleanText(input.mediaUrl,1000),embedUrl:cleanText(input.embedUrl,1000),externalUrl:cleanText(input.externalUrl,1000),signupUrl:cleanText(input.signupUrl,1000),active:input.active!==false,updatedBy:admin.uid,updatedAt:FieldValue.serverTimestamp()};await ref.set({...row,createdAt:FieldValue.serverTimestamp()},{merge:true});return{contentId:ref.id};
}));

async function mpesaToken(){const raw=Buffer.from(`${mpesaKey.value()}:${mpesaSecret.value()}`).toString('base64');const r=await fetch('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:`Basic ${raw}`}});const j=await r.json();if(!r.ok||!j.access_token)throw new Error(j.errorMessage||'M-Pesa authentication failed');return j.access_token}
function mpesaTimestamp(){const d=new Date();const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`}

export const createMpesaCheckout=onRequest({region:'europe-west1',secrets:[mpesaKey,mpesaSecret,mpesaPasskey,mpesaShortcode,mpesaCallbackUrl]},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'POST');const user=await identity(req);const phone=cleanPhone(req.body?.phone);if(!/^2547\d{8}$/.test(phone)&&!/^2541\d{8}$/.test(phone))throw new Error('Use a Kenyan phone in 2547… or 2541… format');const {ref,cart}=await createOrder(req,'mpesa',user);const ts=mpesaTimestamp(),shortcode=mpesaShortcode.value();const password=Buffer.from(`${shortcode}${mpesaPasskey.value()}${ts}`).toString('base64');const token=await mpesaToken();const r=await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({BusinessShortCode:shortcode,Password:password,Timestamp:ts,TransactionType:'CustomerPayBillOnline',Amount:cart.totalKsh,PartyA:phone,PartyB:shortcode,PhoneNumber:phone,CallBackURL:mpesaCallbackUrl.value(),AccountReference:`TT-${ref.id.slice(0,12)}`,TransactionDesc:'TeknTandao ICT order'})});const j=await r.json();if(!r.ok||!j.CheckoutRequestID){await ref.update({status:'payment_init_failed',paymentError:j,updatedAt:FieldValue.serverTimestamp()});const e=new Error(j.errorMessage||j.ResponseDescription||'M-Pesa request failed');e.status=502;throw e}await ref.update({mpesa:{checkoutRequestId:j.CheckoutRequestID,merchantRequestId:j.MerchantRequestID},updatedAt:FieldValue.serverTimestamp()});return{orderId:ref.id,message:'M-Pesa prompt sent. Complete payment on your phone.'};
}));

export const mpesaCallback=onRequest({region:'europe-west1'},async(req,res)=>{try{const cb=req.body?.Body?.stkCallback;if(!cb?.CheckoutRequestID)return res.json({ResultCode:0,ResultDesc:'Accepted'});const q=await db.collection('orders').where('mpesa.checkoutRequestId','==',cb.CheckoutRequestID).limit(1).get();if(!q.empty){const meta=Object.fromEntries((cb.CallbackMetadata?.Item||[]).map(x=>[x.Name,x.Value]));await q.docs[0].ref.update({status:cb.ResultCode===0?'paid':'payment_failed',mpesaResult:{resultCode:cb.ResultCode,resultDesc:cb.ResultDesc,receipt:meta.MpesaReceiptNumber||null,amount:meta.Amount||null,phone:meta.PhoneNumber||null},statusHistory:FieldValue.arrayUnion({status:cb.ResultCode===0?'paid':'payment_failed',by:'mpesa',at:new Date().toISOString()}),updatedAt:FieldValue.serverTimestamp()})}res.json({ResultCode:0,ResultDesc:'Accepted'})}catch(e){res.status(500).json({error:String(e.message||e)})}});

export const createPaystackCheckout=onRequest({region:'europe-west1',secrets:[paystackKey]},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'POST');const user=await identity(req);const email=cleanText(req.body?.email||user.email,200);if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('Valid email required for Paystack');const {ref,cart}=await createOrder(req,'paystack',user);const callback=cleanText(req.body?.origin||'https://www.tekntandao.com',300).replace(/\/$/,'')+'/shop.html?payment=paystack';const r=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${paystackKey.value()}`,'Content-Type':'application/json'},body:JSON.stringify({email,amount:cart.totalKsh*100,currency:'KES',reference:ref.id,callback_url:callback,metadata:{orderId:ref.id,customerUid:user.uid}})});const j=await r.json();if(!r.ok||j.status!==true){await ref.update({status:'payment_init_failed',paymentError:j,updatedAt:FieldValue.serverTimestamp()});const e=new Error(j.message||'Paystack initialization failed');e.status=502;throw e}await ref.update({paystack:{reference:ref.id,accessCode:j.data.access_code},updatedAt:FieldValue.serverTimestamp()});return{orderId:ref.id,authorizationUrl:j.data.authorization_url};
}));

export const paystackWebhook=onRequest({region:'europe-west1',secrets:[paystackKey]},async(req,res)=>{try{const signature=req.headers['x-paystack-signature'];const expected=createHmac('sha512',paystackKey.value()).update(req.rawBody).digest('hex');if(signature!==expected)return res.status(401).send('Invalid signature');const event=req.body;if(event.event==='charge.success'){const reference=String(event.data?.reference||'');const ref=db.collection('orders').doc(reference);const snap=await ref.get();if(snap.exists){const order=snap.data();const paidKsh=Math.round(Number(event.data.amount||0)/100);if(paidKsh===order.totalKsh)await ref.update({status:'paid',paystackResult:{reference,channel:event.data.channel||null,paidAt:event.data.paid_at||null},statusHistory:FieldValue.arrayUnion({status:'paid',by:'paystack',at:new Date().toISOString()}),updatedAt:FieldValue.serverTimestamp()})}}res.status(200).send('ok')}catch(e){res.status(500).send('error')}});

function slugify(value){
  return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
}
function extractModelText(payload){
  if(typeof payload?.output_text==='string'&&payload.output_text.trim())return payload.output_text;
  const chunks=[];
  for(const item of payload?.output||[]){
    for(const part of item.content||[]){
      if(typeof part.text==='string')chunks.push(part.text);
      else if(typeof part.output_text==='string')chunks.push(part.output_text);
    }
  }
  return chunks.join('\n').trim();
}
function parseBlogJson(text){
  const match=String(text||'').match(/\{[\s\S]*\}/);
  if(!match)throw new Error('Model did not return JSON');
  const row=JSON.parse(match[0]);
  const title=cleanText(row.title,160);
  const slug=slugify(row.slug||title);
  const excerpt=cleanText(row.excerpt,320);
  const category=cleanText(row.category,40)||'Insight';
  const body=Array.isArray(row.body)?row.body.map(p=>cleanText(p,1200)).filter(Boolean):String(row.body||'').split(/\n{2,}/).map(p=>cleanText(p,1200)).filter(Boolean);
  if(!title||!slug||body.length<2)throw new Error('Incomplete blog payload');
  return{title,slug,excerpt,category,body,cover:cleanText(row.cover,400)};
}
async function generateTrendingBlog(){
  const existing=await db.collection('blogs').orderBy('publishedAt','desc').limit(40).get();
  const titles=existing.docs.map(d=>d.data().title).filter(Boolean);
  const prompt=`You are TeknTandao's Nairobi editorial desk. Search the live web for the most important, currently trending cybersecurity or African-tech topics (ransomware, Kenya DPA/ODPC, M-Pesa fraud, cloud exposure, AI-assisted attacks, NIS2/GDPR knock-on effects, critical CVEs). Pick ONE topic that is not already covered by these titles: ${titles.join(' | ')||'(none yet)'}. Write an original briefing for Kenyan SMEs and public-sector IT leads. Return ONLY JSON with keys: title, slug, excerpt, category, cover (optional URL), body (array of 4 to 6 short paragraphs). No markdown fences.`;
  const response=await fetch('https://api.x.ai/v1/responses',{
    method:'POST',
    headers:{Authorization:`Bearer ${xaiKey.value()}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:'grok-4.6',
      tools:[{type:'web_search'}],
      input:[
        {role:'system',content:'Write factual, concise English. Prefer Kenya and East Africa context. Do not invent incident statistics.'},
        {role:'user',content:prompt}
      ]
    })
  });
  const payload=await response.json();
  if(!response.ok)throw new Error(payload.error?.message||'SpaceXAI request failed');
  const post=parseBlogJson(extractModelText(payload));
  const ref=db.collection('blogs').doc(post.slug);
  const prior=await ref.get();
  if(prior.exists)throw new Error('Slug already published');
  const row={...post,published:true,source:'spacexai',publishedAt:new Date().toISOString(),createdAt:FieldValue.serverTimestamp()};
  await ref.set(row);
  return{slug:post.slug,title:post.title};
}

export const listBlogs=onRequest({region:'europe-west1'},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'GET');
  const snap=await db.collection('blogs').where('published','==',true).limit(40).get();
  const blogs=snap.docs.map(d=>{const row=d.data();return{slug:d.id,title:row.title,excerpt:row.excerpt,category:row.category,cover:row.cover||'',publishedAt:row.publishedAt||null,body:row.body||[],source:row.source||'live'}});
  blogs.sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
  return{blogs};
}));

export const runTrendingBlog=onRequest({region:'europe-west1',secrets:[xaiKey]},async(req,res)=>respond(req,res,async()=>{
  assertMethod(req,'POST');
  await identity(req,['admin']);
  return generateTrendingBlog();
}));

export const publishTrendingBlog=onSchedule({region:'europe-west1',schedule:'every 24 hours',timeZone:'Africa/Nairobi',secrets:[xaiKey]},async()=>{
  await generateTrendingBlog();
});

