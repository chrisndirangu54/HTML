import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {getAuth,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import {getFirestore} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

export const config=window.TEKNTANDAO_CONFIG||{};
export const firebaseReady=Boolean(config.firebase?.projectId&&config.firebase?.apiKey);
export const app=firebaseReady?(getApps().length?getApp():initializeApp(config.firebase)):null;
export const auth=app?getAuth(app):null;
export const db=app?getFirestore(app):null;
export const functionsBase=(config.functionsBaseUrl||'').replace(/\/$/,'');

export function waitForUser(){
  return new Promise(resolve=>{
    if(!auth)return resolve(null);
    const stop=onAuthStateChanged(auth,user=>{stop();resolve(user)});
  });
}
export async function requireUser(next=location.pathname.split('/').pop()||'shop.html'){
  const user=await waitForUser();
  if(user)return user;
  location.href=`login.html?next=${encodeURIComponent(next)}`;
  throw new Error('Authentication required');
}
export async function idToken(force=false){const user=await requireUser();return user.getIdToken(force)}
export async function apiFetch(name,{method='GET',body=null,forceToken=false}={}){
  if(!functionsBase)throw new Error('Configure functionsBaseUrl in assets/js/site-config.js');
  const token=await idToken(forceToken);
  const res=await fetch(`${functionsBase}/${name}`,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||`Request failed (${res.status})`);
  return data;
}
export async function getSession(force=false){return apiFetch('getSession',{forceToken:force})}
export function dashboardForRole(role){if(role==='admin')return'admin.html';if(role==='attendant')return'attendant.html';if(role==='delivery')return'delivery.html';return'account.html'}
export async function signOutCurrent(){if(auth)await signOut(auth);location.href='shop.html'}
