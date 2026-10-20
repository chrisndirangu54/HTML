import {initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {resolve4,resolve6,resolveTxt} from 'node:dns/promises';
import {connect} from 'node:tls';
import {isIP} from 'node:net';
if(!getApps().length)initializeApp();
const db=getFirestore();
const forbidden=v=>{if(isIP(v)===4){let a=v.split('.').map(Number);return a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===192&&a[1]===0||a[0]===198&&[18,19].includes(a[1]);}if(isIP(v)===6)return v==='::1'||v==='::'||v.toLowerCase().startsWith('fc')||v.toLowerCase().startsWith('fd')||v.toLowerCase().startsWith('fe80')||v.toLowerCase().startsWith('::ffff:');return true};
async function publicDns(domain){const addresses=[...(await resolve4(domain).catch(()=>[])),...(await resolve6(domain).catch(()=>[]))];if(!addresses.length||addresses.some(forbidden))throw Error('Non-public address or unresolved domain');return addresses}
async function check(domain,token){
 await publicDns(domain);
 const proof=(await resolveTxt('_tekntandao-verify.'+domain)).map(v=>v.join(''));
 if(!proof.includes('tekntandao-verification='+token))throw Error('Domain ownership proof expired');
 const response=await fetch('https://'+domain+'/',{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{'User-Agent':'TeknTandao-Authorized-Monitor/1.0'}});
 return {reachable:true,httpStatus:response.status,hasHsts:response.headers.has('strict-transport-security'),hasCsp:response.headers.has('content-security-policy'),checkedAt:new Date().toISOString()};
}
export const securityMonitorTick=onSchedule({schedule:'every 24 hours',timeZone:'Africa/Nairobi',region:'europe-west1',timeoutSeconds:300,maxInstances:1},async()=>{
 if(process.env.SECURITY_MONITOR_EXECUTION_ENABLED!=='true')return;
 const now=Date.now(),subs=await db.collection('securityMonitoringSubscriptions').where('status','==','active').limit(50).get();
 for(const doc of subs.docs){
  const s=doc.data();if(s.monitoringExecutionEnabled!==true||s.currentPeriodEnd?.toMillis()<=now)continue;
  const asset=await db.collection('securityAssets').doc(s.assetId).get();
  if(!asset.exists||asset.data().uid!==s.uid||asset.data().status!=='verified'||!asset.data().verificationToken)continue;
  const ref=db.collection('securityMonitorResults').doc();
  try{const observation=await check(asset.data().domain,asset.data().verificationToken);await ref.set({uid:s.uid,assetId:s.assetId,subscriptionId:doc.id,observation,createdAt:FieldValue.serverTimestamp()})}
  catch(e){await ref.set({uid:s.uid,assetId:s.assetId,subscriptionId:doc.id,observation:{reachable:false,error:'Ownership or network validation failed'},createdAt:FieldValue.serverTimestamp()})}
 }
});
