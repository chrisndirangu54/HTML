/* Unified Engineering Workbench: one central scene, five tool stages, explicit model provenance.
 * Existing validated CAD, AI, mesh-editor and manufacturing forms are moved—not cloned.
 * No automatic upload, AI spend, persistent storage or manufacturing operation.
 */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const host=$('eng-dashboard-pipeline'),viewport=$('fab-preview'),cadForm=$('eng-cad-form'),quote=$('fab-project-form');
 if(!host||!viewport||!cadForm||!quote)return;
 // One rendering canvas: skip the separate CAD renderer (it reads this flag before init).
 window.TeknUnifiedEngineeringPipeline=true;
 const steps=[
  ['brief','01 · Brief','Project definition and requirements'],
  ['model','02 · Model','Dimensions and parametric source'],
  ['refine','03 · Refine','AI, imports and sculpting'],
  ['analyze','04 · Analyze','Calculators and preliminary engineering checks'],
  ['deliver','05 · Deliver','Export and consent-controlled fabrication quote']
 ];
 const build=(tag,cls,text)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text)n.textContent=text;
  return n;
 };
 const main=build('section','eng-pipeline');main.id='eng-pipeline';
 main.dataset.exactPlate='true';
 const header=build('div','eng-pipeline-stage-nav');
 header.setAttribute('role','group');header.setAttribute('aria-label','Engineering pipeline stages');
 const stageButtons=new Map();
 for(const [id,label,desc] of steps){
  const button=build('button',null,label);button.type='button';button.dataset.pipelineStage=id;button.title=desc;
  header.append(button);stageButtons.set(id,button);
 }
 const surface=build('div','eng-pipeline-surface');
 const visual=build('section','eng-pipeline-viewport-shell');
 visual.setAttribute('aria-label','Shared engineering model viewport');
 const top=build('header','eng-pipeline-viewport-head');
 const heading=build('strong',null,'One active engineering model');
 const sourceBadge=build('span','eng-pipeline-tag','Parametric CAD · editable');
 sourceBadge.id='eng-pipeline-source';
 top.append(heading,sourceBadge);
 const sourceInfo=build('p','eng-pipeline-provenance','Single model: parametric plate. CAD edits, AI results and mesh tools feed this viewport.');
 const simState=build('p','eng-pipeline-sim-state',
  'Illustrative beam-model analysis is available only for the unchanged parametric plate. It is not FEA or structural approval.');
 simState.id='eng-pipeline-analysis-state';
 const viewportNote=build('p','eng-pipeline-mesh-state','Drag to orbit, wheel to zoom and right-drag to pan. Use Refine to sculpt this same model.');
 viewportNote.id='eng-pipeline-viewport-status';
 visual.append(top,viewport,sourceInfo,simState,viewportNote);
 const measurements=build('p','eng-pipeline-mesh-state','Active model dimensions: awaiting geometry…');
 measurements.id='eng-pipeline-dimensions';
 const unitTools=build('div','eng-pipeline-unit-controls');
 const unitLabel=build('label',null,'Original mesh units');
 const unitSelect=build('select');unitSelect.id='eng-pipeline-input-units';
 for(const [value,label] of [['','Select units'],['mm','Millimetres'],['cm','Centimetres'],['m','Metres'],['in','Inches']]){
  const option=document.createElement('option');option.value=value;option.textContent=label;unitSelect.append(option);
 }
 unitLabel.append(unitSelect);
 const unitApply=build('button','tt-svc-button','Convert input to mm');unitApply.type='button';unitApply.id='eng-pipeline-units-apply';
 const unitStatus=build('p','eng-pipeline-mesh-state','Model units are unverified until you explicitly choose and apply them.');
 unitStatus.id='eng-pipeline-unit-status';unitStatus.setAttribute('role','status');unitStatus.setAttribute('aria-live','polite');
 unitTools.append(unitLabel,unitApply,unitStatus);
 visual.append(measurements,unitTools);
 const toolbar=build('div','eng-pipeline-view-actions');
 const cameraBar=$('eng-cad-viewport')?.parentElement?.querySelector('.eng-cad-controlbar');
 if(cameraBar)toolbar.append(cameraBar);
 const rebuild=build('button','tt-svc-button','Replace with parametric plate');
 rebuild.id='eng-pipeline-rebuild';rebuild.type='button';
 const use=build('button','tt-svc-button primary','Use active mesh for quote');
 use.id='eng-pipeline-use';use.type='button';
 toolbar.append(rebuild,use);
 visual.append(toolbar);
 const inspector=build('div','eng-pipeline-stage-shell');
 inspector.setAttribute('aria-label','Active engineering tools');
 const stagePanels=new Map();
 for(const [id] of steps){
  const panel=build('section','eng-pipeline-stage');
  panel.id='eng-pipeline-'+id;
  panel.dataset.pipelineTools=id;panel.hidden=id!=='model';stagePanels.set(id,panel);inspector.append(panel);
 }
 surface.append(visual,inspector);main.append(header,surface);
 host.append(main);
 const move=(elementId,step)=>{
  const el=$(elementId);
  if(!el)throw Error('Pipeline control missing: '+elementId);
  stagePanels.get(step).append(el);
 };
 // The original dashboard creates the sculpt editor section. Its canvas is moved
 // above into the permanent central region, so no second viewport is mounted.
 for(const id of ['eng-workspace'])move(id,'brief');
 for(const id of ['eng-cad'])move(id,'model');
 for(const id of ['eng-ai','fab-ai','fab-tripo','eng-sculpt'])move(id,'refine');
 for(const id of ['eng-calculators','eng-simulators','eng-sim-controls','eng-sim-results','eng-preflight'])move(id,'analyze');
 for(const id of ['fab-design'])move(id,'deliver');
 const alert=build('p','eng-pipeline-sim-state',
  'The active imported, AI-generated, primitive or sculpted mesh has no validated structural solver. The plate beam results below, if available elsewhere, are NOT results for this mesh.');
 alert.id='eng-pipeline-unavailable';alert.hidden=true;
 stagePanels.get('analyze').prepend(alert);

 // Existing fabrication quote remains a separate human-reviewed, authorized action.
 const fieldKeys=['length','width','thickness','hole','offset'];
 const currentDims=()=>Object.fromEntries(fieldKeys.map(name=>[name,Number(cadForm.elements.namedItem(name).value)]));
 let stage='model',source='parametric',generation=0,viewer=null,loading=false,renderTimer=null,renderAgain=false,wireframe=false;
 let unitsVerified=true,sourceUnits='mm',activeBounds=null,activeVertices=0;
 let lastSnapshot=window.TeknPlateSimulationSnapshot||null;
 const fromHash=hash=>{
  if(/^#eng-pipeline-(brief|model|refine|analyze|deliver)$/.test(String(hash||'')))return String(hash).slice('#eng-pipeline-'.length);
  const fragment=String(hash||'').replace(/^#/,'');
  if(['eng-workspace','eng-brief-form'].includes(fragment))return 'brief';
  if(['eng-cad','eng-cad-form','eng-cad-viewport','eng-scad-preview'].includes(fragment))return 'model';
  if(['eng-ai','fab-ai','fab-tripo','eng-sculpt','fab-sculpt-workbench','fab-preview'].includes(fragment))return 'refine';
  if(['eng-calculators','eng-simulators','eng-sim-results','eng-sim-controls','eng-preflight','eng-design-space'].includes(fragment))return 'analyze';
  if(['fab-design','fab-project-form','fab-upload-area','fab-upload-summary'].includes(fragment))return 'deliver';
  return null;
 };
 const viewPipeline=()=>document.dispatchEvent(new CustomEvent('eng:open-view',{detail:{view:'pipeline'}}));
 const setStage=(next,{updateHash=false}={})=>{
  if(!stagePanels.has(next))return;
  stage=next;
  for(const [id,panel] of stagePanels){
   panel.hidden=id!==next;
   const button=stageButtons.get(id);
   if(id===next)button.setAttribute('aria-current','step');
   else button.removeAttribute('aria-current');
  }
  main.dataset.stage=next;
  if(updateHash&&location.hash!=='#eng-pipeline-'+next)
   history.pushState(null,'','#eng-pipeline-'+next);
  window.dispatchEvent(new Event('resize'));
 };
 const analysisSupported=()=>source==='parametric';
 const updateContext=()=>{
  const available=analysisSupported();
  main.dataset.exactPlate=String(available);
  main.dataset.unitsVerified=String(unitsVerified);
  unitTools.hidden=available||source==='primitive';
  unitApply.disabled=!viewer||!unitSelect.value;
  unitStatus.textContent=unitsVerified?
   'Verified source units: '+sourceUnits+'. The displayed and exported model uses millimetres.':
   'Units unverified: choose the source units and convert before preparing this mesh for fabrication.';
  measurements.textContent=activeBounds?
   'Active bounds (mm'+(unitsVerified?'':', interpretation unverified')+'): '+
    activeBounds.map(n=>Number(n).toFixed(2)).join(' × ')+' · '+activeVertices.toLocaleString()+' vertices.':
   'Waiting for an active mesh to measure.';

  const labels={
   parametric:'Parametric plate · editable',
   primitive:'Primitive mesh · editable',
   imported:'Imported geometry · mesh',
   ai:'AI-generated mesh · verify units',
   'sculpted-parametric':'Sculpted plate · mesh derivative',
   'sculpted-primitive':'Sculpted primitive · mesh derivative',
   'sculpted-imported':'Sculpted import · mesh derivative',
   'sculpted-ai':'Sculpted AI mesh · mesh derivative'
  };
  sourceBadge.textContent=labels[source]||'Mesh model';
  sourceInfo.textContent=available?
   'Authoritative active model: the verified parametric plate. SCAD and approximate beam screening refer to this unmodified geometry.':
   'Active model: '+source.replaceAll('-',' ')+'. CAD dimension controls no longer describe this modified mesh. Use the explicit plate replacement button to return to parametric CAD.';
  simState.textContent=available?
   'Plate surrogate available: nominal beam stress and deflection, illustrative material properties, no FEM. Overlay is color only; physical mesh is not deformed.':
   'Structural simulation unavailable for this active mesh. No results are inferred from its appearance or an unrelated parametric plate.';
  alert.hidden=available;
  const scad=$('eng-download-scad');
  if(scad)scad.disabled=!available;
  rebuild.hidden=available;
  $('eng-download-stl').disabled=!viewer;
  use.disabled=!viewer||!unitsVerified;
  const warning='Design source: '+source+'. '+(available?'Plate surrogate available.':'No verified structural solver for this geometry.');
  viewportNote.textContent=warning;
  document.dispatchEvent(new CustomEvent('eng:pipeline-state',{detail:{source,generation,analysisSupported:available}}));
 };
 const setSource=(newSource)=>{
  const valid=['parametric','primitive','imported','ai'];
  if(!valid.includes(newSource))return;
  source=newSource;generation++;
  updateContext();
 };
 const markEdited=()=>{
  if(source.startsWith('sculpted-'))return;
  source='sculpted-'+source;generation++;updateContext();
 };
 const cameraAction=action=>async()=>{
  const api=viewer||await import('./engineering-fabrication-preview.js');
  return api.selectUnifiedView(action);
 };
 const cameraMap=[
  ['eng-view-iso','iso'],['eng-view-top','top'],['eng-view-side','side'],
  ['eng-view-reset','iso']
 ];
 for(const [id,action] of cameraMap){
  const button=$(id);button.disabled=false;button.addEventListener('click',cameraAction(action));
 }
 const edges=$('eng-view-edges');edges.disabled=false;
 edges.addEventListener('click',async()=>{
  wireframe=!wireframe;await cameraAction(wireframe?'wireframe':'solid')();
  edges.textContent=wireframe?'Wireframe on':'Wireframe off';
  edges.setAttribute('aria-pressed',String(wireframe));
 });
 const download=$('eng-download-stl');download.disabled=true;
 download.addEventListener('click',()=>{
  // Both CAD and sculpt exports use the active unmodified mesh object in the shared scene.
  $('fab-sculpt-export')?.click();
 });
 use.disabled=true;
 use.addEventListener('click',()=>{
  if(!viewer||!unitsVerified){unitStatus.textContent='Choose and verify model units before selecting an edited STL for fabrication.';return;}
  $('fab-sculpt-use')?.click();
  setStage('deliver');
 });
 rebuild.addEventListener('click',()=>{
  $('fab-sculpt-plate')?.click();
  setStage('model');
 });
 const renderPlate=async()=>{
  if(source!=='parametric')return;
  if(loading){renderAgain=true;return;}
  let values;try{values=currentDims();window.TeknEngineeringModels.mountingPlate(values);}
  catch(error){viewportNote.textContent='Invalid plate: '+error.message;return;}
  loading=true;
  try{
   viewer=viewer||await import('./engineering-fabrication-preview.js');
   await viewer.previewPrimitive('plate',viewport,values);
   if(lastSnapshot)viewer.showPlateSimulation(lastSnapshot);
   wireframe=false;edges.textContent='Wireframe off';edges.setAttribute('aria-pressed','false');
  }catch(error){viewportNote.textContent='Shared 3D viewport failed: '+error.message;}
  finally{
   loading=false;updateContext();
   if(renderAgain&&source==='parametric'){renderAgain=false;setTimeout(()=>renderPlate(),0);}
  }
 };
 cadForm.addEventListener('input',()=>{
  if(source!=='parametric')return; // Never replace sculpted/imported meshes silently.
  clearTimeout(renderTimer);renderTimer=setTimeout(()=>renderPlate(),200);
 });
 cadForm.addEventListener('submit',()=>{
  if(source!=='parametric')return;
  clearTimeout(renderTimer);renderTimer=setTimeout(()=>renderPlate(),0);
 });
 window.addEventListener('eng:plate-simulation',event=>{
  lastSnapshot=event.detail;
  if(analysisSupported())viewer?.showPlateSimulation(lastSnapshot);
 });
 document.addEventListener('eng:geometry-loaded',event=>{
  if(!event.detail?.source)return;
  unitsVerified=event.detail.unitsVerified===true;
  sourceUnits=event.detail.sourceUnits||'unknown';
  activeBounds=Array.isArray(event.detail.bounds)?event.detail.bounds:null;
  activeVertices=Number(event.detail.vertices)||0;
  setSource(event.detail.source);
  if(!analysisSupported())setStage('refine');
  if(analysisSupported()&&lastSnapshot)viewer?.showPlateSimulation(lastSnapshot);
 });
 document.addEventListener('fab:sculpt-changed',()=>markEdited());
 unitSelect.addEventListener('change',()=>{unitApply.disabled=!unitSelect.value||!viewer;});
 unitApply.addEventListener('click',async()=>{
  if(!viewer||!unitSelect.value){unitStatus.textContent='Select known source units to continue.';return;}
  if(source==='parametric'||source==='primitive')return;
  if(source.startsWith('sculpted-')&&!window.confirm(
   'Changing input units re-imports the original model and discards its current sculpt edits. Continue?'))return;
  unitApply.disabled=true;unitStatus.textContent='Re-importing original geometry in '+unitSelect.value+' and converting to millimetres…';
  try{
   const api=viewer||await import('./engineering-fabrication-preview.js');
   const result=await api.reopenCurrentModelWithUnits(unitSelect.value);
   if(!result)return;
   // Clear previously prepared upload files. Re-export the active converted mesh explicitly.
   document.dispatchEvent(new CustomEvent('fab:sculpt-changed'));
   unitStatus.textContent='Converted from '+unitSelect.value+' to millimetres. Inspect measured bounds, then choose Use active mesh for quote.';
  }catch(error){unitStatus.textContent='Unit conversion failed: '+error.message;}
  finally{unitApply.disabled=!unitSelect.value;}
 });
 document.addEventListener('fab:edited-stl-ready',()=>{
  // Selection uses the explicit existing upload consent workflow.
  setStage('deliver');viewPipeline();
 });
 document.addEventListener('eng:plate-from-fabrication',()=>{
  // Gemini-drafted dimensions are validated upstream before this event fires.
  // Explicitly discard the previous mesh and switch the shared source back to CAD.
  setTimeout(()=>rebuild.click(),0);
 });
 document.addEventListener('eng:pipeline-stage',event=>{
  if(stagePanels.has(event.detail?.stage)){setStage(event.detail.stage);viewPipeline();}
 });
 document.addEventListener('eng:pipeline-navigate',event=>{
  const target=fromHash(event.detail?.hash);
  if(target)setStage(target);
 });
 document.addEventListener('eng:open-view',event=>{
  if(event.detail?.view!=='pipeline')return;
  const target=event.detail.stage||fromHash(location.hash);
  if(stagePanels.has(target))setStage(target);
 });
 window.addEventListener('hashchange',()=>{
  const target=fromHash(location.hash);
  if(target){setStage(target);viewPipeline();}
  else if(location.hash.startsWith('#eng-pipeline-')){
   setStage(location.hash.slice('#eng-pipeline-'.length));viewPipeline();
  }
 });
 document.addEventListener('click',event=>{
  if(event.defaultPrevented)return;
  const link=event.target.closest('a[href^="#"]');
  if(!link)return;
  const target=fromHash(link.getAttribute('href'));
  if(!target)return;
  event.preventDefault();setStage(target);viewPipeline();
  history.pushState(null,'',link.getAttribute('href'));
  main.scrollIntoView({behavior:'smooth',block:'start'});
 });
 for(const [name,button] of stageButtons){
  button.addEventListener('click',()=>setStage(name,{updateHash:true}));
 }
 window.TeknEngineeringPipeline={
  get source(){return source;},
  get stage(){return stage;},
  get requiresMeshSelection(){return !analysisSupported();},
  get requiresUnitVerification(){return !unitsVerified;},
  get activeModelBounds(){return activeBounds?[...activeBounds]:null;},
  openStage(next){setStage(next);viewPipeline();},
  usePlate(){rebuild.click();}
 };
 setStage(fromHash(location.hash)||'model');
 updateContext();
 // Only the pipeline mode is used as the default. Other account / overview links are preserved.
 if(!location.hash||fromHash(location.hash))viewPipeline();
 // This creates the ONLY engineering WebGL viewport at startup.
 renderPlate();
})();