import {requireUser} from './auth-client.js';
const $=id=>document.getElementById(id),message=$('message'),asset=$('asset'),result=$('result');
async function api(endpoint,{method='GET',body}={}){const user=await requireUser('security-monitoring.html'),token=await user.getIdToken();const r=await fetch('/api/'+endpoint,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Request failed');return data}
const getAsset=()=>{if(!/^[A-Za-z0-9_-]{8,100}$/.test(asset.value))throw Error('Enter a valid asset ID');return asset.value};
async function run(promise){message.textContent='Loading…';result.textContent='';try{const data=await promise();result.textContent=JSON.stringify(data,null,2);message.textContent='Request completed'}catch(e){message.textContent=e.message}}
$('status').onclick=()=>run(()=>api('securityMonitoringStatus?assetId='+encodeURIComponent(getAsset())));
$('history').onclick=()=>run(()=>api('securityMonitoringResults?assetId='+encodeURIComponent(getAsset())));
document.querySelectorAll('[data-action]').forEach(btn=>btn.onclick=()=>run(()=>api('securityMonitoringControls',{method:'POST',body:{assetId:getAsset(),action:btn.dataset.action}})));
