/* Browser-side true-geometry CAD preview. Three.js pinned via engineering.html import map.
 * Builds a 2D outline with four circular holes and extrudes to actual plate thickness.
 * View/mesh/STL are geometric previews, not validated CAD/FEA or STEP/BREP exports.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

const viewport=document.getElementById('eng-cad-viewport');
const form=document.getElementById('eng-cad-form');
const status=document.getElementById('eng-viewer-status');
const cadModel=window.TeknEngineeringModels;
const buttons=['eng-view-iso','eng-view-top','eng-view-side','eng-view-reset','eng-view-edges','eng-download-stl'];
const byId=id=>document.getElementById(id);
const asNumber=name=>Number(form.elements.namedItem(name).value);

if(viewport&&form&&status&&cadModel){
 let renderer,scene,camera,controls,plate,edgeLines,grid,axes,lastValues,lastSolid;
 let requestedFrame=0,resizeObserver=null,pending=0,edgeMode=true;
 let originalPositions=null,support=null,loadArrow=null,activeSimulation=null;
 const safeDisplay=(delta,exaggeration,length)=>Math.min(Math.max(0,delta*exaggeration),length*.25);
 const simColorCold=new THREE.Color(0x25bdd5),simColorWarm=new THREE.Color(0xffb547);
 const dimensions=()=>Object.fromEntries(['length','width','thickness','hole','offset'].map(key=>[key,asNumber(key)]));
 const check=values=>cadModel.mountingPlate(values);
 const onRender=()=>{
  requestedFrame=0;
  if(document.visibilityState==='hidden'||!renderer||!scene||!camera)return;
  renderer.render(scene,camera);
 };
 const render=()=>{
  if(!requestedFrame&&renderer)requestedFrame=requestAnimationFrame(onRender);
 };
 const disposeSolid=()=>{
  if(plate){scene.remove(plate);plate.geometry.dispose();plate.material.dispose();plate=null;}
  if(edgeLines){scene.remove(edgeLines);edgeLines.geometry.dispose();edgeLines.material.dispose();edgeLines=null;}
  if(lastSolid){lastSolid.dispose();lastSolid=null;}
  if(support){scene.remove(support);support.geometry.dispose();support.material.dispose();support=null;}
  if(loadArrow){
    scene.remove(loadArrow);
    loadArrow.line.geometry.dispose();
    loadArrow.line.material.dispose();
    loadArrow.cone.geometry.dispose();
    loadArrow.cone.material.dispose();
    loadArrow=null;
  }
 };
 const setView=view=>{
  if(!camera||!lastValues)return;
  const {length,width,thickness}=lastValues;
  const span=Math.max(length,width,thickness*4,1);
  const d=span*1.3;
  camera.up.set(0,view==='top'?1:0,view==='top'?0:1);
  if(view==='top')camera.position.set(0,0,d);
  else if(view==='side')camera.position.set(0,-d*.9,d*.16);
  else camera.position.set(d*.76,-d*.82,d*.72);
  camera.lookAt(0,0,0);
  controls.target.set(0,0,0);
  controls.minDistance=span*.28;
  controls.maxDistance=span*12;
  controls.update();
  render();
 };
 const updateSpecs=values=>{
  byId('eng-cad-specs').replaceChildren();
  const entries=[
   ['Size',`${values.length} × ${values.width} × ${values.thickness} mm`],
   ['Holes',`4 × Ø${values.hole} mm`],
   ['Edge offset',`${values.offset} mm to centers`]
  ];
  for(const [label,value] of entries){
   const wrap=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
   dt.textContent=label;dd.textContent=value;wrap.append(dt,dd);byId('eng-cad-specs').append(wrap);
  }
 };
 const makePlate=values=>{
  check(values);
  const {length,width,thickness,hole,offset}=values;
  const left=-length/2,right=length/2,bottom=-width/2,top=width/2;
  const outline=new THREE.Shape();
  outline.moveTo(left,bottom);outline.lineTo(right,bottom);
  outline.lineTo(right,top);outline.lineTo(left,top);outline.closePath();
  // The outside outline is CCW; circular holes are CW and subtract from the solid.
  for(const x of [left+offset,right-offset]){
   for(const y of [bottom+offset,top-offset]){
    const opening=new THREE.Path();
    opening.absarc(x,y,hole/2,0,Math.PI*2,true);
    outline.holes.push(opening);
   }
  }
  const geometry=new THREE.ExtrudeGeometry(outline,{
   depth:thickness,steps:1,curveSegments:64,bevelEnabled:false
  });
  geometry.translate(0,0,-thickness/2);
  // Create both mesh and edge lines from the same actual perforated geometry.
  disposeSolid();
  const material=new THREE.MeshStandardMaterial({
   color:0xffffff,metalness:.25,roughness:.4,vertexColors:true,side:THREE.DoubleSide
  });
  // Keep a pristine mesh for manufacturing exports; deformation is view-only.
  lastSolid=geometry;
  plate=new THREE.Mesh(geometry.clone(),material);
  originalPositions=Float32Array.from(plate.geometry.attributes.position.array);
  scene.add(plate);
  const edgeMaterial=new THREE.LineBasicMaterial({color:0xb5fff0,transparent:true,opacity:.77});
  edgeLines=new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry,28),edgeMaterial);
  edgeLines.visible=edgeMode;
  scene.add(edgeLines);
  if(grid)scene.remove(grid);
  if(axes)scene.remove(axes);
  if(grid){grid.geometry.dispose();if(Array.isArray(grid.material))grid.material.forEach(m=>m.dispose());else grid.material.dispose();}
  if(axes){axes.geometry.dispose();axes.material.dispose();}
  const gridSize=Math.max(60,Math.ceil(Math.max(length,width)*1.6/10)*10);
  grid=new THREE.GridHelper(gridSize,Math.min(40,Math.max(10,Math.round(gridSize/10))),0x3a9c99,0x1f5659);
  grid.rotation.x=Math.PI/2;
  grid.position.z=-thickness/2-4;
  grid.material.transparent=true;grid.material.opacity=.32;
  scene.add(grid);
  axes=new THREE.AxesHelper(Math.min(42,Math.max(15,Math.min(length,width)*.32)));
  axes.position.set(left-8,bottom-8,-thickness/2-2);
  scene.add(axes);
  lastValues=values;
  updateSpecs(values);
  const clampGeometry=new THREE.BoxGeometry(Math.max(3,thickness*.9),width+8,thickness+16);
  support=new THREE.Mesh(clampGeometry,new THREE.MeshStandardMaterial({
    color:0x5a7183,metalness:.55,roughness:.6,transparent:true,opacity:.85
  }));
  support.position.set(left-Math.max(3,thickness*.9)/2-1,0,0);
  scene.add(support);
  status.textContent='3D ready · through-holes · adjustable force';
  render();
 };
 // Rendering uses a documented beam-surrogate deformation, not FEA.
 const applySimulation=snapshot=>{
  if(!plate||!lastValues||!snapshot?.simulation||!originalPositions)return;
  activeSimulation=snapshot;
  const {length,width,thickness}=lastValues;
  const tip=snapshot.simulation.tipDeflectionMm;
  const visual=safeDisplay(tip,Number(snapshot.exaggeration),length);
  const geom=plate.geometry,position=geom.attributes.position;
  const colors=new Float32Array(position.count*3);
  const stressMaximum=Math.max(snapshot.simulation.nominalMaximumMpa,1e-8);
  for(let i=0;i<position.count;i++){
    const k=i*3,localX=originalPositions[k]+length/2;
    const t=Math.min(1,Math.max(0,localX/length));
    const deflection=visual*t*t*(3-t)/2;
    position.array[k]=originalPositions[k];
    position.array[k+1]=originalPositions[k+1];
    position.array[k+2]=originalPositions[k+2]-deflection;
    const localStress=snapshot.simulation.rootNominalStressMpa*(1-t);
    const fraction=Math.min(1,localStress/stressMaximum);
    const rgb=new THREE.Color(0x46ccb3);
    if(snapshot.overlay==='stress')rgb.lerpColors(simColorCold,simColorWarm,fraction);
    colors[k]=rgb.r;colors[k+1]=rgb.g;colors[k+2]=rgb.b;
  }
  position.needsUpdate=true;
  geom.computeVertexNormals();
  if(!geom.getAttribute('color'))geom.setAttribute('color',new THREE.BufferAttribute(colors,3));
  else{geom.attributes.color.array.set(colors);geom.attributes.color.needsUpdate=true;}
  geom.computeBoundingSphere();
  if(edgeLines){
    edgeLines.geometry.dispose();
    edgeLines.geometry=new THREE.EdgesGeometry(geom,28);
  }
  if(snapshot.simulation.inputs.forceN>0){
    const origin=new THREE.Vector3(length/2,0,thickness/2+Math.max(10,length*.19)-visual);
    if(!loadArrow){
      loadArrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),origin,
        Math.max(10,length*.18),0xffb85d,Math.max(4,length*.05),Math.max(3,length*.027));
      scene.add(loadArrow);
    }
    loadArrow.visible=true;
    loadArrow.position.copy(origin);
    loadArrow.setLength(Math.max(10,length*.18),Math.max(4,length*.05),Math.max(3,length*.027));
  }else if(loadArrow){loadArrow.visible=false;}
  status.textContent='Live simulation · '+snapshot.simulation.inputs.forceN.toFixed(1)+
    ' N · displayed deformation '+Math.round(snapshot.exaggeration)+'× (capped for visibility)';
  render();
 };
 window.addEventListener('eng:plate-simulation',event=>{
  if(!renderer||!event.detail)return;
  refresh(false);applySimulation(event.detail);
 });
 window.addEventListener('eng:plate-simulation-invalid',event=>{
  status.textContent='Invalid geometry: '+(event.detail?.message||'check dimensions')+' — last valid model preserved';
  byId('eng-download-stl').disabled=true;
 });
 const refresh=(resetCamera=false)=>{
  try{
   const values=dimensions();
   const changed=!lastValues||['length','width','thickness','hole','offset'].some(k=>lastValues[k]!==values[k]);
   const previousSpan=lastValues?Math.max(lastValues.length,lastValues.width,lastValues.thickness*4,1):null;
   if(changed)makePlate(values);
   if(resetCamera||!previousSpan){setView('isometric');}
   else if(changed){
    // Preserve the user's viewing direction while framing large size changes.
    const nextSpan=Math.max(values.length,values.width,values.thickness*4,1);
    camera.position.multiplyScalar(nextSpan/previousSpan);
    controls.minDistance=nextSpan*.28;
    controls.maxDistance=nextSpan*12;
    controls.update();
    render();
   }else render();
  }catch(error){
   status.textContent='Invalid CAD dimensions: '+error.message+' — showing last valid model';
   byId('eng-download-stl').disabled=true;
   return;
  }
  byId('eng-download-stl').disabled=false;
 };
 const init=()=>{
  if(!document.createElement('canvas').getContext('webgl2')&&!document.createElement('canvas').getContext('webgl')){
   status.textContent='WebGL unavailable — SVG preview and OpenSCAD source remain usable';
   return;
  }
  try{
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  }catch(_){
   status.textContent='3D unavailable on this device — use the OpenSCAD source';
   return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setClearColor(0x081923);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  viewport.append(renderer.domElement);
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','Three-dimensional mounting plate, drag to rotate, wheel to zoom');
  viewport.classList.add('is-ready');
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(42,1,0.1,16000);
  const fill=new THREE.HemisphereLight(0xdffeff,0x143034,2.5);fill.position.set(0,0,200);scene.add(fill);
  const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(175,-220,280);scene.add(key);
  const rim=new THREE.DirectionalLight(0x32ceff,2.4);rim.position.set(-170,140,140);scene.add(rim);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=false;
  controls.screenSpacePanning=true;
  controls.enablePan=true;
  controls.addEventListener('change',render);
  const resize=()=>{
   const w=Math.max(10,viewport.clientWidth),h=Math.max(10,viewport.clientHeight);
   renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();
  };
  if('ResizeObserver' in window){resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);}
  else window.addEventListener('resize',resize,{passive:true});
  resize();
  try{
    refresh(true);
    if(window.TeknPlateSimulationSnapshot)applySimulation(window.TeknPlateSimulationSnapshot);
  }catch(error){status.textContent='Could not create preview: '+error.message;}
  buttons.forEach(id=>{if(id!=='eng-download-stl')byId(id).disabled=false;});
  byId('eng-view-iso').addEventListener('click',()=>setView('isometric'));
  byId('eng-view-top').addEventListener('click',()=>setView('top'));
  byId('eng-view-side').addEventListener('click',()=>setView('side'));
  byId('eng-view-reset').addEventListener('click',()=>{refresh(true);});
  byId('eng-view-edges').addEventListener('click',()=>{
   edgeMode=!edgeMode;
   if(edgeLines)edgeLines.visible=edgeMode;
   byId('eng-view-edges').textContent=edgeMode?'Edges on':'Edges off';
   byId('eng-view-edges').setAttribute('aria-pressed',String(edgeMode));
   render();
  });
  byId('eng-download-stl').addEventListener('click',()=>{
   if(!plate||!lastSolid||!lastValues)return;
   try{
    // Export the undeformed perforated CAD solid, never the exaggerated simulation mesh.
    const original=new THREE.Mesh(lastSolid);
    original.updateMatrixWorld(true);
    const exporter=new STLExporter();
    const result=exporter.parse(original,{binary:false});
    const blob=new Blob([result],{type:'model/stl'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.download='tekntandao-mounting-plate-mm.stl';a.href=url;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    status.textContent='STL downloaded · dimensions in mm; validate mesh before manufacturing';
   }catch(error){status.textContent='STL export failed: '+error.message;}
  });
  renderer.domElement.addEventListener('webglcontextlost',event=>{
   event.preventDefault();
   viewport.classList.remove('is-ready');
   status.textContent='Graphics context lost — reload to restore 3D; OpenSCAD source is still available';
   buttons.forEach(id=>byId(id).disabled=true);
  },false);
  document.addEventListener('visibilitychange',render);
 };
 // Existing source form uses the same pure geometry validator.
 form.addEventListener('input',()=>{
  clearTimeout(pending);
  pending=setTimeout(()=>{if(renderer){refresh(false);if(window.TeknPlateSimulationSnapshot)applySimulation(window.TeknPlateSimulationSnapshot);}},160);
 });
 form.addEventListener('submit',()=>{
  if(renderer){clearTimeout(pending);refresh(false);}
 });
 if(!window.TeknUnifiedEngineeringPipeline)init();
}
