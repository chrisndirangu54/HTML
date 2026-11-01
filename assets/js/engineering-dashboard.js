/* Unified Engineering dashboard. Existing tools are moved, never cloned. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const root=$('eng-dashboard'),stage=$('eng-dash-panels');
 if(!root||!stage)return;
 const views={
  overview:{title:'Engineering overview',description:'Every engineering workflow in one connected workspace.',ids:[]},
  pipeline:{title:'Engineering design pipeline',description:'One active design, one shared 3D viewport, five connected stages.',ids:[]},
  analysis:{title:'Engineering calculators & simulation',description:'Engineering briefs, real estimators and open-source simulation workbenches.',ids:['eng-workspace','eng-calculators','eng-simulators']},
  cad:{title:'Parametric CAD & STL',description:'Create 3D geometry, simulate approximate loads, export SCAD and STL.',ids:['eng-cad']},
  ai:{title:'AI design studio',description:'Optional free on-device critique and authenticated Gemini/Tripo generation.',ids:['eng-ai','fab-ai','fab-tripo']},
  sculpt:{title:'3D sculpting & editing',description:'Edit models locally with brushes, transforms, import and export.',ids:['eng-sculpt']},
  fabrication:{title:'Fabrication quotation',description:'Prepare a private design request for human review, without automatic production.',ids:['fab-design']},
  projects:{title:'Projects & credits',description:'Verified AI wallet and private fabrication quote history.',ids:['fab-account','fab-plans','eng-project-history','fab-operator']}
 };
 const element=(tag,cls,text)=>{
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(text)e.textContent=text;
  return e;
 };
 const design=$('fab-design'),previewCard=design?.querySelector('.eng-fab-preview');
 const jobs=$('fab-jobs'),refresh=$('fab-refresh-jobs');
 if(!design||!previewCard||!jobs||!refresh)return;
 const sculpt=element('section','eng-section eng-dash-sculpt');
 sculpt.id='eng-sculpt';
 const sculptHead=element('div','eng-head');
 sculptHead.append(element('span','tt-svc-eyebrow','Local 3D workbench'),
  element('h2',null,'Sculpt, inspect and refine'),
  element('p',null,'Import STL, OBJ or GLB locally, sculpt triangle meshes and export your edits without consuming AI credits.'));
 sculpt.append(sculptHead);
 const importer=element('div','eng-panel eng-dash-import');
 const label=element('label',null,'Import a model for editing (STL, OBJ or GLB · maximum 15 MB)');
 const fileInput=element('input');fileInput.type='file';fileInput.id='eng-sculpt-import';fileInput.accept='.stl,.obj,.glb';
 label.append(fileInput);
 const importStatus=element('p','eng-fine','Selecting a local model never uploads it.');
 importStatus.id='eng-sculpt-import-status';
 const quoteLink=element('a','tt-svc-button','Prepare a fabrication quote');quoteLink.href='#fab-design';
 importer.append(label,importStatus,quoteLink);
 sculpt.append(importer);
 const historySection=element('section','eng-section eng-dash-history');
 historySection.id='eng-project-history';
 const historyHead=element('div','eng-head');
 historyHead.append(element('span','tt-svc-eyebrow','Private engineering projects'),element('h2',null,'Fabrication requests'),element('p',null,'Your request states and human quotations, sourced from the authenticated project service.'));
 historySection.append(historyHead);
 const historyPanel=element('div','eng-panel');
 const oldHeading=jobs.previousElementSibling;
 if(oldHeading?.tagName==='H3'&&/fabrication requests/i.test(oldHeading.textContent))oldHeading.remove();
 historyPanel.append(jobs,refresh);historySection.append(historyPanel);
 const summary=$('fab-upload-summary');
 if(summary)design.querySelector('#fab-project-form')?.append(summary);
 sculpt.append(previewCard);
 const panels={overview:$('eng-dashboard-overview')};
 for(const [name,definition] of Object.entries(views)){
  if(name==='overview')continue;
  const panel=element('div','eng-dash-panel');panel.id='eng-dashboard-'+name;
  panel.dataset.engPanel=name;panel.setAttribute('role','region');panel.setAttribute('aria-label',definition.title);
  panels[name]=panel;stage.append(panel);
 }
 for(const [name,definition] of Object.entries(views)){
  for(const id of definition.ids){
   const section=id==='eng-sculpt'?sculpt:id==='eng-project-history'?historySection:$(id);
   if(!section)return;
   panels[name].append(section);
  }
 }
 const oldIntro=$('eng-fabrication');if(oldIntro)panels.overview.append(oldIntro);
 const next=document.querySelector('.eng-next')?.closest('.eng-section');if(next)panels.overview.append(next);

 // Live summary is read from the existing authenticated account/quote UI.
 const balance=$('fab-balance'),username=$('fab-user'),plate=$('fab-plate-reference');
 const syncSummary=()=>{
  const credits=balance.textContent.trim()||'—';
  $('eng-dash-credit-count').textContent=credits;
  $('eng-dash-side-credits').textContent=credits;
  $('eng-dash-account-state').textContent=username.textContent.includes('@')?'Signed in':'Guest';
  const count=jobs.querySelectorAll('.eng-fab-job').length;
  $('eng-dash-project-count').textContent=count?String(count):/No fabrication requests yet/i.test(jobs.textContent)?'0':'—';
  const match=plate.textContent.match(/([\d.]+)\s*×\s*([\d.]+)/);
  if(match)$('eng-dash-plate-size').textContent=match[1]+' × '+match[2]+' mm';
 };
 [balance,username,plate,jobs].forEach(node=>new MutationObserver(syncSummary).observe(node,{subtree:true,childList:true,characterData:true}));
 syncSummary();

 const links=[...root.querySelectorAll('[data-eng-view]')];
 const resolve=hash=>{
  const target=hash&&document.getElementById(hash.replace(/^#/,''));
  return target?.closest('[data-eng-panel]')?.dataset.engPanel||'overview';
 };
 let active='overview';
 const activate=(name,{hash,scroll=true,targetId}={})=>{
  if(!views[name])name='overview';
  active=name;
  Object.entries(panels).forEach(([key,panel])=>{panel.hidden=key!==name;});
  links.forEach(link=>{
   if(link.dataset.engView===name)link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
  });
  $('eng-dash-current-title').textContent=views[name].title;
  $('eng-dash-current-description').textContent=views[name].description;
  if(hash){
   const target=document.getElementById(hash.slice(1));
   const nextHash=target?hash:'#eng-dashboard-'+name;
   if(location.hash!==nextHash)history.pushState(null,'',nextHash);
  }
  requestAnimationFrame(()=>{
   window.dispatchEvent(new Event('resize'));
   if(scroll)(targetId&&$(targetId)||root).scrollIntoView({behavior:'auto',block:'start'});
  });
 };
 root.addEventListener('click',event=>{
  const a=event.target.closest('a[data-eng-view]');
  if(!a||!root.contains(a))return;
  event.preventDefault();
  activate(a.dataset.engView,{hash:a.getAttribute('href')});
  if(a.dataset.engView==='pipeline')document.dispatchEvent(new CustomEvent('eng:pipeline-navigate',{detail:{hash:a.getAttribute('href')}}));
 });
 document.addEventListener('click',event=>{
  if(event.defaultPrevented)return;
  const a=event.target.closest('a[href^="#"]');
  if(!a)return;
  const dest=document.getElementById(a.getAttribute('href').slice(1));
  const panel=dest?.closest('[data-eng-panel]');
  if(!panel||panel.dataset.engPanel===active)return;
  event.preventDefault();
  activate(panel.dataset.engPanel,{hash:'#'+dest.id,targetId:dest.id});
 });
 window.addEventListener('hashchange',()=>activate(resolve(location.hash),{targetId:location.hash.slice(1)}));
 document.addEventListener('eng:open-view',event=>{
  const name=event.detail?.view;
  if(views[name])activate(name,{hash:'#eng-dashboard-'+name,scroll:false});
 });
 document.addEventListener('fab:edited-stl-ready',()=>activate('pipeline',{hash:'#eng-pipeline'}));
 fileInput.addEventListener('change',()=>{
  const file=fileInput.files?.[0];if(!file)return;
  if(!/\.(stl|obj|glb)$/i.test(file.name)||file.size<=0||file.size>15*1024*1024){
   importStatus.textContent='Choose a valid STL, OBJ or GLB no larger than 15 MB.';fileInput.value='';return;
  }
  try{
   const original=$('fab-file');original.files=fileInput.files;
   const choice=$('fab-project-form').querySelector('input[name="kind"][value="upload"]');
   choice.checked=true;choice.dispatchEvent(new Event('change',{bubbles:true}));
   original.dispatchEvent(new Event('change',{bubbles:true}));
   importStatus.textContent='Opened locally: '+file.name+'. Submit a quote separately if desired.';
   document.dispatchEvent(new CustomEvent('eng:pipeline-stage',{detail:{stage:'refine'}}));
  }catch(error){importStatus.textContent='Local model import unavailable: '+error.message;}
 });
 // Apply panel hiding only after every original module has been successfully assigned.
 document.body.classList.add('eng-dashboard-enabled');
 const metrics=document.querySelector('.eng-metrics');if(metrics)metrics.hidden=true;
 activate(resolve(location.hash),{scroll:Boolean(location.hash),targetId:location.hash.slice(1)});
})();