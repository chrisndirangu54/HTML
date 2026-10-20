import {getSession,idToken,functionsBase} from './auth-client.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escapeHTML=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=functionsBase?functionsBase+'/ispSuiteApi':'/api/ispSuiteApi';
const state={modules:{},integrations:[],records:{},overview:null,view:'overview',current:null,busy:false};
const labels={overview:'Operations overview',architecture:'Network architecture',integrations:'Connectors & integrations',
 economics:'Pilot business simulator',quality:'Network health & QoE','customer-requests':'Customer service requests'};
const nf=x=>new Intl.NumberFormat('en-KE',{maximumFractionDigits:0}).format(x||0);
const money=x=>'KSh '+nf(x);
const fmt=x=>typeof x==='object'&&x!==null?JSON.stringify(x):String(x??'');
const message=(txt,error=false)=>{const e=$('#isp-message');e.textContent=txt;e.className='message'+(error?' error':'');};
async function api(method='GET',query={},body){
 const qs=new URLSearchParams(query);
 const url=root+(qs.size?'?'+qs:'');
 const token=await idToken();
 const response=await fetch(url,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(json.error||'Request failed ('+response.status+')');
 return json;
}
function setBusy(busy){state.busy=busy;$$('button').forEach(b=>{if(!b.hasAttribute('data-static'))b.disabled=busy;});}
async function run(action){
 if(state.busy)return;setBusy(true);
 try{await action();message('Saved and refreshed. No network commands or payments were executed.');}
 catch(e){message(e.message||'Request failed',true);}
 finally{setBusy(false);}
}
function view(name){
 state.view=name;
 state.current=Object.hasOwn(state.modules,name)?name:null;
 const page=state.current?'module':name;
 for(const x of ['overview','architecture','integrations','economics','quality','customer-requests','module']){
  const e=$('#view-'+x);if(e)e.hidden=x!==page;
 }
 $$('#isp-nav button,#isp-modules-nav button').forEach(b=>{
  if(b.dataset.view===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 });
 $('#new-record').hidden=!state.current;
 $('#page-title').textContent=state.current?state.modules[name].title:labels[name]||'ISP Operations';
 $('#page-subtitle').textContent=state.current?state.modules[name].description:'Vendor-neutral fiber, wireless and customer experience operations';
 if(state.current)loadRecords(state.current);
 else if(name==='overview')loadOverview();
 else if(name==='integrations')renderIntegrations();
 else if(name==='economics')calculate();
 else if(name==='quality')loadQuality();
 else if(name==='customer-requests')loadRequests();
}
function metric(title,value,detail=''){
 return '<article class="metric"><small>'+escapeHTML(title)+'</small><strong>'+escapeHTML(value)+'</strong><em>'+escapeHTML(detail)+'</em></article>';
}
function createNav(){
 const nav=$('#isp-modules-nav');nav.replaceChildren();
 for(const [key,mod] of Object.entries(state.modules)){
  const b=document.createElement('button');b.type='button';b.dataset.view=key;b.textContent='›   '+mod.title;
  b.addEventListener('click',()=>view(key));nav.append(b);
 }
}
function renderOverview(data){
 const stats=data.stats||{};
 const values=[
  ['Network sites',stats.sites,'Tracked locations'],
  ['Registered devices',stats.devices,'Planning / inventory'],
  ['Subscribers',stats.subscribers,'Not necessarily provisioned'],
  ['Fiber and wireless links',stats.links,'Design records'],
  ['Recorded incidents',stats.incidents,'Not live outages'],
  ['Technician work orders',stats.workOrders,'Staff workflow'],
  ['Support cases',stats.support,'Human-reviewed tickets'],
  ['Manual telemetry',stats.telemetry,'Not real-time network feed'],
 ];
 $('#isp-overview-metrics').innerHTML=values.map(([label,value,detail])=>metric(label,nf(value),detail)).join('');
 const actions=[
  ['Network & infrastructure','sites','sites, links and assets'],
  ['Customers and subscription plans','subscribers','plans, service accounts and billing drafts'],
  ['Monitoring and customer QoE','telemetry','measured samples, correlation and investigation'],
  ['Fault and field response','incidents','incidents, tickets, work orders and notifications'],
  ['Secure change management','provisioning','non-executing approvals and firmware checks'],
  ['Vendor procurement and policy','procurement','Kenyan hardware checks, VLAN isolation and RF'],
 ];
 $('#overview-actions').innerHTML=actions.map(([title,route,description])=>
  '<button type="button" class="btn" style="text-align:left;min-height:95px"><strong>'+escapeHTML(title)+
  '</strong><br><small>'+escapeHTML(description)+'</small></button>').join('');
 $$('#overview-actions button').forEach((b,i)=>b.addEventListener('click',()=>view(actions[i][1])));
}
function renderIntegrations(){
 $('#integration-grid').innerHTML=state.integrations.map(x=>
  '<article class="integration"><strong>'+escapeHTML(x.label)+'</strong><span class="status off">'+
  escapeHTML(x.status.replaceAll('_',' '))+'</span><p>'+escapeHTML(x.capabilities)+'</p></article>').join('');
}
async function loadOverview(){
 try{state.overview=await api('GET',{view:'overview'});renderOverview(state.overview);}
 catch(e){message('Overview unavailable: '+e.message,true);}
}
async function loadRecords(kind){
 const spec=state.modules[kind];
 $('#module-title').textContent=spec.title;$('#module-description').textContent=spec.description;
 $('#module-notice').textContent=kind==='telemetry'?'Measurements are manually entered, never live network probes.':
 kind==='payments'?'M-Pesa and bank references are UNVERIFIED. A saved reference never activates service.':
 kind==='provisioning'||kind==='firmware'||kind==='policies'?'Approval updates are recordkeeping only; this interface cannot execute device configuration or firmware deployments.':
 'Administration records only; no live infrastructure changes are performed.';
 $('#module-rows').textContent='Loading records…';
 try{
  const result=await api('GET',{view:'records',module:kind});
  state.records[kind]=result.records||[];
  $('#module-limit').textContent='Showing up to '+result.limit+' records. Pagination and bulk export will require a dedicated data endpoint for larger deployments.';
  renderRecords(kind);
 }catch(e){$('#module-rows').textContent='Unable to retrieve records: '+e.message;}
}
function recordSummary(mod,x){
 const keys=Object.keys(mod.fields),items=[];
 for(const k of keys){
  const v=x[k];if(v===undefined||v===''||v===null)continue;
  items.push(escapeHTML(mod.fields[k].label)+': '+escapeHTML(fmt(v)));
  if(items.length>=3)break;
 }
 return items.join(' · ');
}
function actionButtons(kind,x){
 const steps=state.modules[kind].workflow?.transitions?.[x.status]||[];
 return steps.length?steps.map(step=>'<button class="btn soft" data-transition="'+escapeHTML(step)+
  '" data-id="'+escapeHTML(x.id)+'" data-module="'+escapeHTML(kind)+'">'+
  escapeHTML(step.replaceAll('_',' '))+'</button>').join(' '):'<small>No action</small>';
}
function renderRecords(kind){
 const mod=state.modules[kind],all=state.records[kind]||[];
 const filter=$('#module-filter').value.trim().toLowerCase();
 const visible=filter?all.filter(x=>JSON.stringify(x).toLowerCase().includes(filter)):all;
 const target=$('#module-rows');
 if(!visible.length){target.innerHTML='<p>No matching records. Add the first entry to get started.</p>';return;}
 target.innerHTML='<table class="table"><thead><tr><th>Record</th><th>Fields</th><th>State</th><th>Actions</th></tr></thead><tbody>'+
  visible.map(x=>{
   const label=x.label||x.title||x.name||x.accountCode||x.invoiceCode||x.code||x.deviceId||x.id;
   const source=kind==='telemetry'?' · admin-submitted manual sample':'';
   return '<tr><td><b>'+escapeHTML(label)+'</b><small class="code">'+escapeHTML(x.id)+
    '</small></td><td>'+recordSummary(mod,x)+'</td><td><span class="status">'+
    escapeHTML(x.status||'recorded')+'</span>'+escapeHTML(source)+'</td><td>'+
    actionButtons(kind,x)+'</td></tr>';
  }).join('')+'</tbody></table>';
 target.querySelectorAll('[data-transition]').forEach(b=>b.addEventListener('click',()=>{
  const next=b.dataset.transition,id=b.dataset.id;
  if(!window.confirm('Change the record to '+next+'? This is a bookkeeping transition only.'))return;
  run(async()=>{await api('POST',{}, {action:'transition',module:kind,id,status:next});await loadRecords(kind);});
 }));
}
function addRecord(){
 const name=state.current;if(!name)return;
 const fields=state.modules[name].fields;
 $('#record-heading').textContent='New '+state.modules[name].title+' record';
 const box=$('#record-fields');box.replaceChildren();
 for(const [key,spec] of Object.entries(fields)){
  const label=document.createElement('label');label.className='field';
  label.append(document.createTextNode(spec.label+(spec.required?' *':'')));
  let input;
  if(spec.type==='select'){
   input=document.createElement('select');
   for(const value of spec.values){const opt=document.createElement('option');opt.value=value;opt.textContent=value.replaceAll('_',' ');input.append(opt);}
  }else if(spec.type==='textarea'){
   input=document.createElement('textarea');input.maxLength=spec.max;
  }else{
   input=document.createElement('input');input.type=spec.type==='number'?'number':'text';
   if(spec.type==='number'){input.step='any';input.min=spec.min;input.max=spec.max;}
   else input.maxLength=spec.max;
  }
  input.name=key;input.required=!!spec.required;label.append(input);box.append(label);
 }
 $('#record-dialog').showModal();
}
function saveForm(event){
 event.preventDefault();
 const name=state.current,fields=state.modules[name].fields,form=$('#record-form'),data=new FormData(form),record={};
 for(const [key,spec] of Object.entries(fields)){
  const value=String(data.get(key)||'').trim();
  if(!value && !spec.required)continue;
  record[key]=spec.type==='number'?Number(value):value;
 }
 run(async()=>{
  await api('POST',{}, {action:'create',module:name,record});
  $('#record-dialog').close();form.reset();
  await loadRecords(name);if(name==='telemetry')await loadQuality();
 });
}
function calculate(){
 const count=Math.max(0,Number($('#calc-customers').value)||0),arpu=Math.max(0,Number($('#calc-arpu').value)||0),
  opex=Math.max(0,Number($('#calc-opex').value)||0),capex=Math.max(0,Number($('#calc-capex').value)||0);
 const revenue=count*arpu,margin=revenue-opex,payback=margin>0?Math.ceil(capex/margin):null;
 $('#economics-results').innerHTML=[
  metric('Monthly subscription revenue',money(revenue),'Gross, illustrative'),
  metric('Monthly operating allowance',money(opex),'Assumed expenses'),
  metric('Monthly operating difference',money(margin),'Not net profit'),
  metric('Simple capital payback',payback===null?'N/A':payback+' months','Excludes growth, taxes and depreciation'),
 ].join('');
}
async function loadQuality(){
 try{
  const [a,b]=await Promise.all([api('GET',{view:'records',module:'telemetry'}),api('GET',{view:'overview'})]);
  const samples=(a.records||[]).slice().sort((x,y)=>String(x.createdAt).localeCompare(String(y.createdAt)));
  const states={healthy:0,warning:0,critical:0,insufficient_data:0};
  for(const s of samples){if(Object.hasOwn(states,s.health))states[s.health]++;}
  $('#quality-metrics').innerHTML=[
   metric('Manual samples',nf(samples.length),'Up to 150 records'),
   metric('Healthy samples',nf(states.healthy),'Rule-based thresholds'),
   metric('Warnings',nf(states.warning),'Needs investigation'),
   metric('Critical samples',nf(states.critical),'Not confirmed customer outages'),
  ].join('');
  $('#capacity-bars').innerHTML=samples.slice(-40).map(s=>{
   const n=Math.max(1,Math.min(100,Number(s.utilizationPct)||0));
   return '<div class="bar '+(n>=85?'alert':'')+'" style="height:'+n+'%" title="'+escapeHTML(s.site||'Device')+': '+n+'%"></div>';
  }).join('')||'<p class="pill-note">No manual samples yet.</p>';
  const info=b.stats?.capacity||{state:'insufficient_data',hint:'More samples needed'};
  $('#quality-commentary').textContent='Capacity assessment: '+info.state+
   '. '+(info.estimateUtilizationPct===undefined?'':'Estimated utilization '+info.estimateUtilizationPct+'%. ')+
   (info.hint||'')+' Predictions require timestamped, validated multi-week observations.';
  const faults=b.stats?.possibleSharedFaults||[];
  $('#fault-list').innerHTML=faults.length?
   '<ul>'+faults.map(f=>'<li>Segment '+escapeHTML(f.segment)+': '+f.affectedDevices+
    ' distinct device samples marked critical. Requires human verification.</li>').join('')+'</ul>':
   '<p>No shared-fault clusters identified in the loaded manual samples.</p>';
 }catch(e){message('QoE view unavailable: '+e.message,true);}
}
async function loadRequests(){
 const box=$('#customer-requests-table');box.textContent='Loading requests…';
 try{
  const data=await api('GET',{view:'requests'});
  if(!data.requests?.length){box.innerHTML='<p>No requests received.</p>';return;}
  box.innerHTML='<table class="table"><thead><tr><th>Reference</th><th>Service</th><th>Site</th><th>Customer</th><th>Request</th></tr></thead><tbody>'+
  data.requests.map(x=>'<tr><td class="code">'+escapeHTML(x.id)+'</td><td>'+escapeHTML(x.service)+'</td><td>'+
  escapeHTML(x.site)+'</td><td>'+escapeHTML(x.email)+'</td><td>'+escapeHTML(x.message)+'</td></tr>').join('')+'</tbody></table>';
 }catch(e){box.textContent='Cannot read requests: '+e.message;}
}
function downloadCSV(){
 const kind=state.current,records=state.records[kind]||[],spec=state.modules[kind];if(!records.length)return message('No records to export',true);
 const columns=['id','status',...Object.keys(spec.fields),'createdAt'];
 const csv=[columns.map(v=>'"'+v+'"').join(','),...records.map(row=>columns.map(k=>'"'+fmt(row[k]).replaceAll('"','""')+'"').join(','))].join('\r\n');
 const file=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(file);
 const a=document.createElement('a');a.href=url;a.download='tekntandao-isp-'+kind+'.csv';a.click();URL.revokeObjectURL(url);
 message('Downloaded the loaded '+kind+' records as CSV.');
}
async function initialize(){
 try{
  const session=await getSession(true);
  if(session.role!=='admin')throw new Error('Administrator role required');
  const result=await api('GET',{view:'modules'});
  state.modules=result.modules;state.integrations=result.integrations||[];
  $('#auth-banner').className='banner';
  $('#auth-banner').textContent='Signed in as '+session.email+'. All device control and settlement integrations remain disabled until separately commissioned.';
  $('#isp-content').hidden=false;createNav();
  $$('#isp-nav [data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
  $('#isp-refresh').addEventListener('click',()=>view(state.view));
  $('#new-record').addEventListener('click',addRecord);
  $('#record-close').addEventListener('click',()=>$('#record-dialog').close());
  $('#record-cancel').addEventListener('click',()=>$('#record-dialog').close());
  $('#record-form').addEventListener('submit',saveForm);
  $('#module-filter').addEventListener('input',()=>{if(state.current)renderRecords(state.current);});
  $('#module-export').addEventListener('click',downloadCSV);
  for(const id of ['calc-customers','calc-arpu','calc-opex','calc-capex'])$('#'+id).addEventListener('input',calculate);
  view('overview');
 }catch(e){
  $('#auth-banner').className='banner warning';
  $('#auth-banner').textContent='ISP administration is restricted. '+e.message;
  $('#permission-hint').hidden=false;message('Sign in or check the deployment/API configuration.',true);
 }
}
initialize();
