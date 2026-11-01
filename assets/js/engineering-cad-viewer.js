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
 };
 const setView=view=>{
  if(!camera||!lastValues)return;
  const {length,width,thickness}=lastValues;
  const span=Math.max(length,width,thickness*4,1);
  const d=span*1.9;
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
   color:0x30c9b8,metalness:.37,roughness:.3,side:THREE.DoubleSide
  });
  plate=new THREE.Mesh(geometry,material);
  scene.add(plate);
  const edgeMaterial=new THREE.LineBasicMaterial({color:0xb5fff0,transparent:true,opacity:.77});
  edgeLines=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,28),edgeMaterial);
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
  lastValues=values;lastSolid=geometry;
  updateSpecs(values);
  status.textContent='3D ready · actual through-holes · millimetres';
  render();
 };
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
  try{refresh(true);}
  catch(error){status.textContent='Could not create preview: '+error.message;}
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
    plate.updateMatrixWorld(true);
    const exporter=new STLExporter();
    const result=exporter.parse(plate,{binary:false});
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
  pending=setTimeout(()=>{if(renderer)refresh(false);},160);
 });
 form.addEventListener('submit',()=>{
  if(renderer){clearTimeout(pending);refresh(false);}
 });
 init();
}
