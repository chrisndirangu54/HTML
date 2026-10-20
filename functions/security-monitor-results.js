import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {onRequest} from 'firebase-functions/v2/https';
if(!getApps().length)initializeApp();
const db=getFirestore();
export const securityMonitoringResults=onRequest({region:'europe-west1',maxInstances:10},async(req,res)=>{
 res.set('Cache-Control','no-store');
 try{
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  const header=String(req.headers.authorization||'');
  if(!header.startsWith('Bearer '))return res.status(401).json({error:'Login required'});
  const u=await getAuth().verifyIdToken(header.slice(7),true);
  const assetId=String(req.query.assetId||'');
  if(!/^[A-Za-z0-9_-]{8,100}$/.test(assetId))return res.status(400).json({error:'Asset ID required'});
  const asset=await db.collection('securityAssets').doc(assetId).get();
  if(!asset.exists||asset.data().uid!==u.uid)return res.status(404).json({error:'Asset not found'});
  const results=await db.collection('securityMonitorResults').where('uid','==',u.uid).where('assetId','==',assetId).limit(100).get();
  const entries=results.docs.map(d=>({id:d.id,status:d.data().status,observation:d.data().observation||null,createdAt:d.data().createdAt?.toDate?.()?.toISOString()||null}));
  return res.json({results:entries.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))});
 }catch{return res.status(500).json({error:'Unable to retrieve monitoring history'})}
});
