import {createPrivateKey,createSign,randomBytes} from 'node:crypto';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {defineSecret,defineString} from 'firebase-functions/params';
import {onRequest} from 'firebase-functions/v2/https';
if(!getApps().length) initializeApp();
const db=getFirestore(),appId=defineString('GITHUB_SECURITY_APP_ID',{default:''}),slug=defineString('GITHUB_SECURITY_APP_SLUG',{default:''}),privateKey=defineSecret('GITHUB_SECURITY_APP_PRIVATE_KEY');
function deny(code,msg){throw Object.assign(new Error(msg),{status:code})}
function jwt(){
 const now=Math.floor(Date.now()/1000),header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url'),body=Buffer.from(JSON.stringify({iat:now-60,exp:now+480,iss:appId.value()})).toString('base64url');
 const data=header+'.'+body,signer=createSign('RSA-SHA256');signer.update(data);signer.end();return data+'.'+signer.sign(createPrivateKey(privateKey.value())).toString('base64url');
}
async function github(path,{method='GET',token=jwt()}={}){const r=await fetch('https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});if(!r.ok)deny(r.status===404?404:502,'GitHub authorization could not be verified');return r.json()}
async function installationToken(id){const r=await github('/app/installations/'+id+'/access_tokens',{method:'POST'});return r.token}
async function account(req){const v=String(req.headers.authorization||'');if(!v.startsWith('Bearer '))deny(401,'Sign in first');try{return await getAuth().verifyIdToken(v.slice(7),true)}catch{deny(401,'Invalid session')}}
const ids=s=>/^[A-Za-z0-9_-]{12,160}$/.test(s);
export const securityGithubApp=onRequest({region:'europe-west1',secrets:[privateKey],maxInstances:5},async(req,res)=>{
 res.set('Cache-Control','no-store');res.set('Access-Control-Allow-Headers','Authorization, Content-Type');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 try{
 const u=await account(req);
 if(!appId.value()||!slug.value())deny(503,'GitHub App is not configured');
 const path=String(req.path||'/').replace(/^\/api\/security-github/,'').replace(/\/+$/,'')||'/';
 if(req.method==='POST'&&path==='/start'){
  const state=randomBytes(32).toString('hex'),ref=db.collection('securityGithubStates').doc(state);
  await ref.set({uid:u.uid,expiresAt:Date.now()+600000,createdAt:FieldValue.serverTimestamp()});
  return res.json({url:'https://github.com/apps/'+encodeURIComponent(slug.value())+'/installations/new?state='+state});
 }
 if(req.method==='POST'&&path==='/complete'){
  const state=String(req.body?.state||''),installationId=Number(req.body?.installationId);
  if(!/^[a-f0-9]{64}$/.test(state)||!Number.isSafeInteger(installationId)||installationId<=0)deny(400,'Invalid installation callback');
  const stateRef=db.collection('securityGithubStates').doc(state);
  const record=await db.runTransaction(async t=>{const d=await t.get(stateRef);if(!d.exists||d.data().uid!==u.uid||d.data().expiresAt<Date.now())deny(403,'Expired or invalid installation state');t.delete(stateRef);return d.data()});
  const installation=await github('/app/installations/'+installationId);
  if(installation.suspended_at)deny(403,'GitHub installation suspended');
  const token=await installationToken(installationId);
  const repositories=await github('/installation/repositories?per_page=1',{token});
  if(!Array.isArray(repositories.repositories))deny(502,'Repository permission check failed');
  await db.collection('securityGithubConnections').doc(u.uid+'_'+installationId).set({uid:u.uid,installationId,accountLogin:installation.account?.login||'',selection:installation.repository_selection,status:'verified',verifiedAt:FieldValue.serverTimestamp()});
  return res.json({connected:true,installationId,account:installation.account?.login||'',selection:installation.repository_selection});
 }
 if(req.method==='GET'&&path==='/repositories'){
  const installationId=Number(req.query.installationId);
  if(!Number.isSafeInteger(installationId)||installationId<=0)deny(400,'Invalid installation');
  const d=await db.collection('securityGithubConnections').doc(u.uid+'_'+installationId).get();
  if(!d.exists||d.data().uid!==u.uid)deny(403,'Installation not linked');
  const token=await installationToken(installationId);
  const result=await github('/installation/repositories?per_page=100',{token});
  return res.json({repositories:(result.repositories||[]).map(r=>({id:r.id,fullName:r.full_name,private:r.private,defaultBranch:r.default_branch})),hasMore:result.total_count>100});
 }
 deny(404,'Not found')
 }catch(e){res.status(e.status||500).json({error:e.status?e.message:'GitHub App service error'})}
});
