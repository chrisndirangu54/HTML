/* TeknTandao Engineering: one persistent Three.js renderer, one active scene model.
 * STL/OBJ/GLB imports and sculpting happen locally; upload remains a separate action.
 * Every async load has an intent ticket so stale parses cannot replace newer geometry.
 */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {inspectTriangleGeometry} from './engineering-mesh-inspection.js';
import {createMeshEditor} from './engineering-sculpt-editor.js';

const $=id=>document.getElementById(id);
const MAX_FILE_BYTES=15*1024*1024;
const MAX_VERTICES=750000;
let session=null,currentView=null,requestVersion=0,rendererCreated=0;
const describe=message=>{const status=$('fab-sculpt-status');if(status)status.textContent=message;};

function glbHasExternalUris(buffer){
 const data=new DataView(buffer);
 if(data.byteLength<20||data.getUint32(0,true)!==0x46546c67)return true;
 const n=data.getUint32(12,true),kind=data.getUint32(16,true);
 if(kind!==0x4e4f534a||n>1000000||n+20>data.byteLength)return true;
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,n)).replace(/\0+$/,''));
 return [...(json.buffers||[]),...(json.images||[])].some(item=>item.uri&&!String(item.uri).startsWith('data:'));
}
function surfaceMesh(geometry){
 return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
  color:0x64ddc8,roughness:.54,metalness:.11,side:THREE.DoubleSide
 }));
}
function defaultShape(type,dimensions){
 if(type==='sphere')return surfaceMesh(new THREE.SphereGeometry(30,48,32));
 if(type==='box')return surfaceMesh(new THREE.BoxGeometry(60,50,35,14,12,10));
 if(type==='cylinder')return surfaceMesh(new THREE.CylinderGeometry(24,24,60,56,16,4));
 if(type==='plate'){
  const d=dimensions||{length:100,width:60,thickness:6,hole:5,offset:8};
  window.TeknEngineeringModels.mountingPlate(d);
  const {length,width,thickness,hole,offset}=d;
  const shape=new THREE.Shape(),x=length/2,y=width/2;
  shape.moveTo(-x,-y);shape.lineTo(x,-y);shape.lineTo(x,y);shape.lineTo(-x,y);shape.closePath();
  for(const xx of [-x+offset,x-offset]){
   for(const yy of [-y+offset,y-offset]){
    const opening=new THREE.Path();opening.absarc(xx,yy,hole/2,0,Math.PI*2,true);shape.holes.push(opening);
   }
  }
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,steps:1,curveSegments:48,bevelEnabled:false});
  geometry.translate(0,0,-thickness/2);
  return surfaceMesh(geometry);
 }
 throw Error('Unknown starting shape.');
}
function modelSummary(model){
 let vertices=0,meshes=0;
 model.traverse(object=>{
  if(!object.isMesh)return;
  const position=object.geometry?.attributes?.position;
  if(!position||!position.count)throw Error('A mesh has no triangle positions.');
  vertices+=position.count;meshes++;
  if(vertices>MAX_VERTICES)throw Error('Mesh exceeds safe interactive vertex budget. Simplify it in a desktop modelling tool.');
  for(let i=0;i<position.array.length;i++){
   if(!Number.isFinite(position.array[i]))throw Error('Mesh contains NaN or infinite coordinates.');
  }
 });
 if(!meshes)throw Error('No renderable triangle surfaces found.');
 model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model);
 if(bounds.isEmpty())throw Error('Empty model bounds.');
 const size=bounds.getSize(new THREE.Vector3());
 const center=bounds.getCenter(new THREE.Vector3());
 const maxDimension=Math.max(size.x,size.y,size.z);
 if(!Number.isFinite(maxDimension)||maxDimension<=0||maxDimension>10000000)
  throw Error('Model bounds cannot be displayed safely.');
 return {vertices,meshes,size:size.toArray(),center,maxDimension};
}
function reportMesh(model){
 const reports=[];
 model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.attributes?.position)return;
  try{
   const g=mesh.geometry;
   reports.push(inspectTriangleGeometry(g.attributes.position.array,g.index?.array||null,50000));
  }catch(_){}
 });
 const report=$('fab-mesh-report');if(!report)return;
 if(!reports.length){report.textContent='No valid triangle surfaces available for inspection.';return;}
 const sum=key=>reports.reduce((n,x)=>n+x[key],0);
 report.textContent='Local mesh inspection · '+sum('triangleCount').toLocaleString()+' triangles · '+
  sum('approximateBoundaryEdges')+' possible open edges · '+
  sum('approximateNonManifoldEdges')+' possible non-manifold edges · '+
  sum('degenerateTriangles')+' degenerate triangles. '+
  (reports.some(x=>x.partial)?'Large mesh was only partially sampled. ':'')+
  'Heuristic topology check only; geometry units, volume, fit and safety require qualified validation.';
}
function disposeModel(model){
 model?.traverse?.(mesh=>{
  if(!mesh.isMesh)return;
  mesh.geometry?.dispose?.();
  for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))m?.dispose?.();
 });
}
function disposeSession(){
 if(!session)return;
 const s=session;
 if(s.frame)cancelAnimationFrame(s.frame);
 s.observer?.disconnect();
 if(!s.observer)window.removeEventListener('resize',s.resize);
 s.editor?.dispose();
 if(s.model){s.scene.remove(s.model);disposeModel(s.model);}
 s.orbit.dispose();
 s.renderer.dispose();
 s.renderer.domElement.remove();
 session=null;currentView=null;
}
function createSession(container){
 if(session?.container===container)return session;
 disposeSession();
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});}
 catch(e){describe('WebGL unavailable. Use OpenSCAD or desktop CAD to inspect the design.');throw e;}
 rendererCreated++;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
 renderer.setClearColor(0x0b1e21);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.tabIndex=0;
 renderer.domElement.setAttribute('aria-label','Active engineering 3D model: drag to orbit, wheel to zoom');
 container.querySelectorAll('canvas').forEach(c=>c.remove());
 container.append(renderer.domElement);
 const scene=new THREE.Scene();
 scene.add(new THREE.HemisphereLight(0xe9fffa,0x204540,2.4));
 const light=new THREE.DirectionalLight(0xffffff,2.7);light.position.set(8,-7,10);scene.add(light);
 const camera=new THREE.PerspectiveCamera(45,1,.01,100000);
 camera.up.set(0,0,1);
 const orbit=new OrbitControls(camera,renderer.domElement);
 orbit.enableDamping=false;
 let s;
 const redraw=()=>{if(s&&!s.frame)s.frame=requestAnimationFrame(()=>{
  s.frame=0;if(document.visibilityState!=='hidden'&&!s.lost)renderer.render(scene,camera);
 });};
 const resize=()=>{
  const w=Math.max(10,container.clientWidth),h=Math.max(10,container.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();redraw();
 };
 s={container,renderer,scene,camera,orbit,redraw,resize,editor:null,model:null,
  source:null,maxDimension:0,frame:0,observer:null,lost:false};
 orbit.addEventListener('change',redraw);
 if('ResizeObserver' in window){s.observer=new ResizeObserver(resize);s.observer.observe(container);}
 else window.addEventListener('resize',resize,{passive:true});
 renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();s.lost=true;describe('Graphics context lost. Reload the page to recover; no model was uploaded.');
 });
 session=s;resize();return s;
}
function clearOverlay(model){
 model.traverse(mesh=>{if(mesh.isMesh){
  for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){
   if(m?.vertexColors){m.vertexColors=false;m.needsUpdate=true;}
  }
 }});
}
function fitCamera(s,maxDimension,preserveDirection=false){
 const d=maxDimension*2;
 if(preserveDirection&&s.maxDimension>0){
  const direction=s.camera.position.clone().sub(s.orbit.target).normalize();
  s.camera.position.copy(direction.multiplyScalar(d));
 }else s.camera.position.set(d*1.1,-d*1.25,d*.9);
 s.camera.up.set(0,0,1);s.camera.lookAt(0,0,0);
 s.camera.near=Math.max(.001,maxDimension/10000);s.camera.far=Math.max(1000,maxDimension*100);
 s.camera.updateProjectionMatrix();
 s.orbit.target.set(0,0,0);s.orbit.minDistance=maxDimension*.25;s.orbit.maxDistance=maxDimension*30;
 s.orbit.update();
}
async function showModel(model,container,label,source='imported',ticket=++requestVersion){
 if(ticket!==requestVersion){disposeModel(model);return null;}
 // Validate before evicting the last valid model.
 const summary=modelSummary(model);
 if(ticket!==requestVersion){disposeModel(model);return null;}
 const s=createSession(container);
 if(s.lost){disposeModel(model);throw Error('Graphics context is lost. Reload to continue editing.');}
 const preserveCamera=s.source==='parametric'&&source==='parametric';
 s.editor?.dispose();s.editor=null;
 if(s.model){s.scene.remove(s.model);disposeModel(s.model);}
 const center=summary.center;
 model.position.sub(center);
 s.scene.add(model);s.model=model;
 fitCamera(s,summary.maxDimension,preserveCamera);
 s.maxDimension=summary.maxDimension;s.source=source;
 const editor=createMeshEditor({model,scene:s.scene,camera:s.camera,renderer:s.renderer,orbit:s.orbit,
  redraw:s.redraw,onDirty:()=>{
   clearOverlay(model);s.redraw();
   document.dispatchEvent(new CustomEvent('fab:sculpt-changed'));
   reportMesh(model);
  },onMessage:describe});
 s.editor=editor;
 reportMesh(model);
 container.querySelector('.eng-fab-model-badge')?.remove();
 const badge=document.createElement('span');badge.className='eng-fab-model-badge';
 badge.textContent=label+' · editing local · imported units must be verified before fabrication. STL drops color and texture.';
 container.append(badge);
 currentView={
  model,source,
  setCamera(view){
   const d=Math.max(s.maxDimension,1)*2;
   if(view==='top')s.camera.position.set(0,0,d);
   else if(view==='side')s.camera.position.set(0,-d,.01);
   else s.camera.position.set(d*1.1,-d*1.25,d*.9);
   s.camera.up.set(0,0,1);s.camera.lookAt(0,0,0);s.orbit.target.set(0,0,0);s.orbit.update();s.redraw();
  },
  setWireframe(enabled){
   model.traverse(mesh=>{if(mesh.isMesh){
    for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){
     if(m){m.wireframe=Boolean(enabled);m.needsUpdate=true;}
    }
   }});
   s.redraw();
  },
  applyPlateOverlay(snapshot){
   if(source!=='parametric'||!snapshot?.simulation)return false;
   const length=Number(snapshot.values?.length);
   if(!Number.isFinite(length)||length<=0)return false;
   let applied=false;
   model.traverse(mesh=>{
    if(applied||!mesh.isMesh||!mesh.geometry?.attributes?.position)return;
    const g=mesh.geometry,pos=g.attributes.position,colors=new Float32Array(pos.count*3);
    const peak=Math.max(snapshot.simulation.nominalMaximumMpa,1e-8);
    const cold=new THREE.Color(0x35b6dc),warm=new THREE.Color(0xffbb50),plain=new THREE.Color(0x62dec1),pixel=new THREE.Color();
    for(let i=0;i<pos.count;i++){
     const t=Math.min(1,Math.max(0,(pos.getX(i)+length/2)/length));
     const stress=Math.max(0,snapshot.simulation.rootNominalStressMpa*(1-t));
     if(snapshot.overlay==='stress')pixel.lerpColors(cold,warm,Math.min(1,stress/peak));
     else pixel.copy(plain);
     colors[3*i]=pixel.r;colors[3*i+1]=pixel.g;colors[3*i+2]=pixel.b;
    }
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))if(m){m.vertexColors=true;m.needsUpdate=true;}
    applied=true;
   });
   s.redraw();return applied;
  }
 };
 s.resize();s.redraw();
 document.dispatchEvent(new CustomEvent('eng:geometry-loaded',{detail:{
  source,label,bounds:summary.size,vertices:summary.vertices,meshes:summary.meshes,rendererGeneration:rendererCreated
 }}));
 return {label,bounds:summary.size,vertices:summary.vertices};
}
export async function previewPrimitive(shape,container,dimensions){
 const ticket=++requestVersion;
 const model=defaultShape(shape,dimensions);
 return showModel(model,container,'Editable '+shape,shape==='plate'?'parametric':'primitive',ticket);
}
export async function previewFile(file,container,options={}){
 const ticket=++requestVersion;
 const ext=file.name.split('.').pop().toLowerCase();
 if(!['stl','obj','glb'].includes(ext)){
  describe(ext.toUpperCase()+' cannot be edited locally. Submit for human review or use desktop CAD tools.');
  return null;
 }
 if(!file.size||file.size>MAX_FILE_BYTES)throw Error('File must be between 1 byte and 15 MB.');
 const bytes=await file.arrayBuffer();
 if(ticket!==requestVersion)return null;
 let model=null;
 if(ext==='stl'){
  const geometry=new STLLoader().parse(bytes);
  geometry.computeVertexNormals();model=surfaceMesh(geometry);
 }else if(ext==='obj'){
  model=new OBJLoader().parse(new TextDecoder().decode(bytes));
  model.traverse(mesh=>{if(mesh.isMesh){
   if(mesh.material?.dispose)mesh.material.dispose();
   mesh.material=new THREE.MeshStandardMaterial({color:0x63dcca,roughness:.6,side:THREE.DoubleSide});
  }});
 }else{
  if(glbHasExternalUris(bytes))throw Error('GLB has external linked resources; use a self-contained GLB.');
  const parsed=await new Promise((resolve,reject)=>new GLTFLoader().parse(bytes,'',resolve,reject));
  model=parsed.scene;
 }
 if(ticket!==requestVersion){disposeModel(model);return null;}
 return showModel(model,container,ext.toUpperCase()+' source',options.sourceType==='ai'?'ai':'imported',ticket);
}
export function selectUnifiedView(mode){
 if(!currentView)return false;
 if(['iso','top','side'].includes(mode)){currentView.setCamera(mode);return true;}
 if(mode==='wireframe'){currentView.setWireframe(true);return true;}
 if(mode==='solid'){currentView.setWireframe(false);return true;}
 return false;
}
export function showPlateSimulation(snapshot){
 return currentView?.applyPlateOverlay(snapshot)||false;
}
export function currentGeometrySource(){return currentView?.source||null;}
export function engineeringViewportDiagnostics(){
 return Object.freeze({active:!!currentView,rendererInstances:rendererCreated,
  activeSource:currentView?.source||null,visibleCanvases:session?.container?.querySelectorAll('canvas').length||0});
}