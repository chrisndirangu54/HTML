/* Design Intelligence: deterministic, local-only preflight and opt-in revisions. */
import {assessDesign,makeRevision,validateArchive,compareRevisions,evidencePackage,
 REVISION_SCHEMA,MAX_REVISIONS} from './engineering-design-intelligence-core.mjs';
const $=id=>document.getElementById(id);
const plate=$('eng-cad-form'),quote=$('fab-project-form'),model=window.TeknEngineeringModels;
if(plate&&quote&&model&&$('eng-preflight-summary')){
 const keys=['length','width','thickness','hole','offset'];
 const storageKey='tt-eng-design-revisions-v1';
 const selection=$('eng-revisions'),summary=$('eng-preflight-summary'),findings=$('eng-preflight-findings'),
  revisionStatus=$('eng-revision-status'),comparison=$('eng-revision-comparison'),optin=$('eng-revision-persist'),
  save=$('eng-revision-save'),restore=$('eng-revision-restore'),compare=$('eng-revision-compare'),
  exportArchive=$('eng-revision-download'),importArchive=$('eng-revision-upload'),
  clear=$('eng-revision-clear'),evidence=$('eng-preflight-export'),
  attach=$('eng-preflight-attach');
 let revisions=[];
 let activeReport=null;
 const geometry=()=>Object.fromEntries(keys.map(key=>[key,Number(plate.elements.namedItem(key).value)]));
 const current=()=>({
  geometry:geometry(),process:quote.elements.namedItem('process').value,
  material:quote.elements.namedItem('material').value,
  modelMaterial:$('eng-sim-material').value,forceN:Number($('eng-sim-load-number').value)
 });
 const setStatus=message=>{revisionStatus.textContent=message;};
 const node=(tag,text,cls)=>{
  const element=document.createElement(tag);element.textContent=text||'';
  if(cls)element.className=cls;return element;
 };
 const download=(name,data)=>{
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 const persist=()=>{
  if(!optin.checked)return;
  try{localStorage.setItem(storageKey,JSON.stringify({schema:REVISION_SCHEMA,revisions}));}
  catch(_){setStatus('Browser storage is unavailable. Download an archive to retain revisions.');}
 };
 const refreshRevisions=()=>{
  const previous=selection.value;
  selection.replaceChildren();
  const placeholder=node('option','Select a saved design revision');
  placeholder.value='';selection.append(placeholder);
  for(const item of [...revisions].reverse()){
   const option=node('option',new Date(item.createdAt).toLocaleString()+' · '+
    item.scenario.geometry.length+'×'+item.scenario.geometry.width+'×'+item.scenario.geometry.thickness+' mm');
   option.value=item.id;selection.append(option);
  }
  if(revisions.some(item=>item.id===previous))selection.value=previous;
  const valid=Boolean(selection.value);
  restore.disabled=!valid;compare.disabled=!valid;
  clear.disabled=!revisions.length;
  exportArchive.disabled=!revisions.length;
  $('eng-revision-count').textContent=String(revisions.length);
 };
 const selected=()=>revisions.find(item=>item.id===selection.value)||null;
 const render=()=>{
  let report;
  try{
   model.mountingPlate(geometry());
   report=assessDesign(current());
   activeReport=report;
   const g=report.geometry;
   summary.replaceChildren();
   summary.append(node('strong','Preliminary screening · human review required'));
   summary.append(node('p','Hole-to-edge ligament '+g.edgeLigamentMm.toFixed(2)+' mm · minimum hole spacing '+
    g.clearanceMinMm.toFixed(2)+' mm · net plate volume '+g.solidVolumeMm3.toFixed(1)+' mm³.'));
   summary.append(node('p',report.findings.filter(x=>x.severity==='review').length+
     ' advisory review items. This is not FEA, machine-level DFM or manufacturing approval.'));
   findings.replaceChildren();
   for(const issue of report.findings){
    const row=node('li',undefined,'eng-intel-finding eng-intel-'+issue.severity);
    const header=node('strong',(issue.severity==='review'?'Review · ':'Measured · ')+issue.title);
    row.append(header,node('p',issue.detail));findings.append(row);
   }
   evidence.disabled=false;attach.disabled=false;save.disabled=false;
  }catch(error){
   activeReport=null;summary.textContent='Correct CAD or scenario inputs: '+error.message;
   findings.replaceChildren();evidence.disabled=true;attach.disabled=true;save.disabled=true;
  }
 };
 selection.addEventListener('change',refreshRevisions);
 save.addEventListener('click',()=>{
  if(!activeReport)return;
  try{
   const id='rev_'+crypto.randomUUID().replaceAll('-','');
   const rev=makeRevision(current(),{id,createdAt:new Date().toISOString()});
   revisions.push(rev);
   if(revisions.length>MAX_REVISIONS)revisions=revisions.slice(-MAX_REVISIONS);
   refreshRevisions();selection.value=id;refreshRevisions();persist();
   setStatus('Revision saved locally in this session. '+(optin.checked?'Browser persistence is enabled.':'Download an archive or opt in to browser storage to keep it after closing.'));
  }catch(error){setStatus('Cannot save: '+error.message);}
 });
 restore.addEventListener('click',()=>{
  const rev=selected();if(!rev)return;
  try{
   model.mountingPlate(rev.scenario.geometry);
   for(const key of keys)plate.elements.namedItem(key).value=String(rev.scenario.geometry[key]);
   quote.elements.namedItem('material').value=rev.scenario.material;
   quote.elements.namedItem('process').value=rev.scenario.process;
   $('eng-sim-material').value=rev.scenario.modelMaterial;
   $('eng-sim-load-number').value=String(rev.scenario.forceN);
   // Use the existing simulator's authoritative synchronization path for force and rendering.
   $('eng-sim-load-number').dispatchEvent(new Event('change',{bubbles:true}));
   plate.dispatchEvent(new Event('input',{bubbles:true}));
   quote.dispatchEvent(new Event('input',{bubbles:true}));
   $('eng-sim-material').dispatchEvent(new Event('input',{bubbles:true}));
   render();
   setStatus('Revision restored to CAD, simulation and quotation draft; no file was uploaded.');
  }catch(error){setStatus('Restore failed: '+error.message);}
 });
 compare.addEventListener('click',()=>{
  const rev=selected();if(!rev)return;
  try{
   const diff=compareRevisions(rev,current());
   comparison.replaceChildren();
   comparison.append(node('strong',diff.changes.length+' changed design fields'));
   if(!diff.changes.length)comparison.append(node('p','Current design matches the selected revision.'));
   for(const item of diff.changes){
    comparison.append(node('p',item.field+': '+item.from+' → '+item.to+
      (item.delta!==null?' (Δ '+Number(item.delta.toFixed(4))+' '+item.unit+')':'')));
   }
   comparison.append(node('p','Idealized solid volume change: '+
    diff.volumeDeltaMm3.toFixed(1)+' mm³ ('+diff.percentVolumeDelta.toFixed(2)+'%).'));
   comparison.append(node('small',diff.limitation));
  }catch(error){comparison.textContent='Comparison unavailable: '+error.message;}
 });
 exportArchive.addEventListener('click',()=>{
  if(revisions.length)download('tekntandao-engineering-revisions.json',{schema:REVISION_SCHEMA,revisions});
 });
 importArchive.addEventListener('change',async()=>{
  const file=importArchive.files?.[0];if(!file)return;
  if(file.size>128*1024||file.size<2){setStatus('Revision JSON must be between 2 bytes and 128 KB.');importArchive.value='';return;}
  try{
   const parsed=validateArchive(await file.text());
   revisions=parsed.revisions;
   refreshRevisions();persist();
   setStatus('Imported '+revisions.length+' checked design revisions. Nothing was sent to a server.');
  }catch(error){setStatus('Import rejected: '+error.message);}
  finally{importArchive.value='';}
 });
 clear.addEventListener('click',()=>{
  revisions=[];refreshRevisions();comparison.textContent='No revision selected.';
  try{localStorage.removeItem(storageKey);}catch(_){}
  optin.checked=false;setStatus('All local revisions and browser-persisted design history cleared.');
 });
 optin.addEventListener('change',()=>{
  if(optin.checked){persist();setStatus('Local browser storage enabled for these geometry-only revisions.');}
  else{try{localStorage.removeItem(storageKey);}catch(_){}
   setStatus('Browser storage disabled and saved browser copy erased; in-session revisions remain until cleared.');}
 });
 evidence.addEventListener('click',()=>{
  if(!activeReport)return;
  try{
   const pkg=evidencePackage(current(),{revisionId:selected()?.id||null});
   download('tekntandao-design-preflight.json',pkg);
   setStatus('Design evidence exported locally; it is not a certificate or submitted manufacturing file.');
  }catch(error){setStatus('Evidence export failed: '+error.message);}
 });
 attach.addEventListener('click',()=>{
  if(!activeReport)return;
  const field=quote.elements.namedItem('notes');
  const g=activeReport.geometry;
  const reviewCount=activeReport.findings.filter(f=>f.severity==='review').length;
  const addition='[Preliminary engineering preflight; not certified] Edge ligament '+g.edgeLigamentMm+
   ' mm; shortest hole spacing '+g.clearanceMinMm+' mm; '+reviewCount+
   ' advisory issues. Operator must verify load paths, tolerances, material and process.';
  const existing=field.value.trim();
  const updated=(existing?existing+'\n':'')+addition;
  if(updated.length>1800){setStatus('Quote notes are full. Download the JSON evidence separately.');return;}
  field.value=updated;field.dispatchEvent(new Event('input',{bubbles:true}));
  const generated=quote.querySelector('input[name=kind][value=generated]');
  if(generated){generated.checked=true;generated.dispatchEvent(new Event('change',{bubbles:true}));}
  setStatus('Preflight notes copied into the quotation draft only. Nothing has been submitted.');
  document.dispatchEvent(new CustomEvent('eng:open-view',{detail:{view:'fabrication'}}));
 });
 [plate,quote].forEach(form=>form.addEventListener('input',render));
 quote.elements.namedItem('process').addEventListener('change',render);
 quote.elements.namedItem('material').addEventListener('change',render);
 $('eng-sim-load-number').addEventListener('change',render);
 $('eng-sim-material').addEventListener('change',render);
 try{
  const stored=localStorage.getItem(storageKey);
  if(stored){
   revisions=validateArchive(stored).revisions;optin.checked=true;
   setStatus('Restored '+revisions.length+' geometry-only revisions from your opted-in browser storage.');
  }
 }catch(_){setStatus('Stored revision archive could not be read. Import a downloaded backup if available.');}
 refreshRevisions();render();
}