import {requireUser} from './auth-client.js';
const status=document.getElementById('status'),install=document.getElementById('install'),list=document.getElementById('list'),repos=document.getElementById('repos'),input=document.getElementById('installation');
async function request(path,method='GET',body){const u=await requireUser('github-connect.html'),token=await u.getIdToken();const r=await fetch('/api/security-github'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Request failed');return data}
const params=new URLSearchParams(location.search);
async function init(){await requireUser('github-connect.html');install.disabled=false;status.textContent='Connect only the repositories you want assessed.';
const state=params.get('state'),id=params.get('installation_id');
if(state&&id){status.textContent='Verifying installation…';const result=await request('/complete','POST',{state,installationId:Number(id)});input.value=result.installationId;list.disabled=false;status.textContent='Connected: '+result.account;history.replaceState({},'',location.pathname)}
}
install.addEventListener('click',async()=>{install.disabled=true;try{const a=await request('/start','POST',{});location.assign(a.url)}catch(e){status.textContent=e.message;install.disabled=false}});
list.addEventListener('click',async()=>{repos.replaceChildren();try{const data=await request('/repositories?installationId='+encodeURIComponent(input.value));for(const x of data.repositories){const li=document.createElement('li');li.textContent=x.fullName+(x.private?' (private)':' (public)');repos.append(li)}if(data.hasMore){const li=document.createElement('li');li.textContent='More than 100 repositories: pagination will be added before production use.';repos.append(li)}}catch(e){status.textContent=e.message}});
init().catch(e=>status.textContent=e.message);
