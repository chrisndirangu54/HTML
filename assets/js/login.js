import {createUserWithEmailAndPassword,GoogleAuthProvider,sendPasswordResetEmail,signInWithEmailAndPassword,signInWithPopup,updateProfile} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import {auth,firebaseReady,getSession,dashboardForRole} from './auth-client.js';
const $=s=>document.querySelector(s);const status=$('#auth-status');
function nextUrl(){const raw=new URLSearchParams(location.search).get('next')||'';return /^[a-z0-9_-]+\.html(?:\?.*)?$/i.test(raw)?raw:null}
async function finish(){const session=await getSession(true).catch(()=>({role:'customer'}));location.href=nextUrl()||dashboardForRole(session.role)}
function show(message){status.textContent=message}
if(!firebaseReady){show('Firebase web configuration is missing in assets/js/site-config.js.');document.querySelectorAll('button').forEach(b=>b.disabled=true)}
$('#sign-in').onclick=async()=>{try{show('Signing in…');await signInWithEmailAndPassword(auth,$('#auth-email').value.trim(),$('#auth-password').value);await finish()}catch(e){show(e.message)}};
$('#create-account').onclick=async()=>{try{show('Creating account…');const credential=await createUserWithEmailAndPassword(auth,$('#auth-email').value.trim(),$('#auth-password').value);const name=$('#auth-name').value.trim();if(name)await updateProfile(credential.user,{displayName:name});await credential.user.getIdToken(true);await finish()}catch(e){show(e.message)}};
$('#google-sign-in').onclick=async()=>{try{show('Opening Google sign-in…');await signInWithPopup(auth,new GoogleAuthProvider());await finish()}catch(e){show(e.message)}};
$('#reset-password').onclick=async()=>{try{const email=$('#auth-email').value.trim();if(!email)throw new Error('Enter your email first.');await sendPasswordResetEmail(auth,email);show('Password reset email sent.')}catch(e){show(e.message)}};
