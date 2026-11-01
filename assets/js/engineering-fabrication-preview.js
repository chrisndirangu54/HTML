/* Browser-only STL/OBJ/GLB loading and primitives, extended with local mesh sculpting.
   Files do not leave the browser until the user explicitly submits a fabrication request. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {inspectTriangleGeometry} from './engineering-mesh-inspection.js';
import {createMeshEditor} from './engineering-sculpt-editor.js';

let cleanup=null;
let currentView=null;
const $=id=>document.getElementById(id);
function glbHasExternalUris(buffer){
 const data=new DataView(buffer);
 if(data.byteLength<20||data.getUint32(0,true)!==0x46546c67)return true;
 const n=data.getUint32(12,true),kind=data.getUint32(16,true);
 if(kind!==0x4e4f534a||n>1000000||n+20>data.byteLength)return true;
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,n)).replace(/\0+$/,''));
 return [...(json.buffers||[]),...(json.images||[])].some(item=>item.uri&&!String(item.uri).startsWith('data:'));
}
function reportMesh(model){
 const assessments=[];
 model.traverse(node=>{
  if(!node.isMesh||!node.geometry?.attributes?.position)return;
  try{
   const g=node.geometry;
   assessments.push(inspectTriangleGeometry(g.attributes.position.array,g.index?.array||null,50000));
  }catch(_){}
 });
 const report=$('fab-mesh-report');
 if(!report)return;
 if(!assessments.length){report.textContent='Mesh inspection unavailable: no triangles found.';return;}
 const total=k=>assessments.reduce((sum,a)=>sum+a[k],0);
 report.textContent='Local mesh preflight: '+total('triangleCount').toLocaleString()+
  ' triangles; '+total('approximateBoundaryEdges')+' approximate open edges; '+
  total('approximateNonManifoldEdges')+' non-manifold edges; '+
  total('degenerateTriangles')+' degenerate triangles. '+
  (assessments.some(a=>a.partial)?'Large mesh was only partially inspected. ':'')+
  'Topology test is heuristic. Model unit system, watertightness, fit and safety require independent validation.';
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
  for(const xx of [-x+offset,x-offset])
   for(const yy of [-y+offset,y-offset]){
    const path=new THREE.Path();path.absarc(xx,yy,hole/2,0,Math.PI*2,true);shape.holes.push(path);
   }
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,steps:1,curveSegments:48,bevelEnabled:false});
  geometry.translate(0,0,-thickness/2);
  return surfaceMesh(geometry);
 }
 throw Error('Unknown starting shape.');
}
function clearViewer(){
 if(cleanup){cleanup();cleanup=null;}
}
async function showModel(model,container,label,source='imported'){
 clearViewer();
 container.replaceChildren();
 let renderer;
 try{
  renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
 }catch(e){
  container.textContent='WebGL is unavailable. Use a local CAD tool to edit this file.';
  throw e;
 }
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
 renderer.setClearColor(0x0b1e21);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 container.append(renderer.domElement);
 const scene=new THREE.Scene();
 scene.add(new THREE.HemisphereLight(0xe9fffa,0x204540,2.4));
 const light=new THREE.DirectionalLight(0xffffff,2.7);
 light.position.set(8,-7,10);scene.add(light);
 const box=new THREE.Box3().setFromObject(model);
 if(box.isEmpty()){
  renderer.dispose();throw Error('No renderable triangle surfaces found.');
 }
 const span=box.getSize(new THREE.Vector3()),maxDimension=Math.max(span.x,span.y,span.z,1);
 if(!Number.isFinite(span.x+span.y+span.z)||maxDimension<=0){
  renderer.dispose();throw Error('Model geometry is invalid.');
 }
 const center=box.getCenter(new THREE.Vector3());
 model.position.sub(center);
 scene.add(model);
 const camera=new THREE.PerspectiveCamera(45,1,.01,maxDimension*100);
 camera.position.set(maxDimension*1.5,-maxDimension*1.8,maxDimension*1.4);
 camera.lookAt(0,0,0);
 const orbit=new OrbitControls(camera,renderer.domElement);
 orbit.enableDamping=false;orbit.minDistance=maxDimension*.25;orbit.maxDistance=maxDimension*30;
 let frame=0,observer=null;
 const redraw=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;renderer.render(scene,camera);});};
 orbit.addEventListener('change',redraw);
 const resize=()=>{
  const w=Math.max(10,container.clientWidth),h=Math.max(10,container.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();redraw();
 };
 if('ResizeObserver' in window){observer=new ResizeObserver(resize);observer.observe(container);}
 else window.addEventListener('resize',resize);
 const message=t=>{$('fab-sculpt-status').textContent=t;};
 const clearOverlay=()=>{
  model.traverse(mesh=>{if(mesh.isMesh){
   const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   for(const m of materials)if(m?.vertexColors){m.vertexColors=false;m.needsUpdate=true;}
  }});
 };
 const editor=createMeshEditor({model,scene,camera,renderer,orbit,redraw,
  onDirty:()=>{
   clearOverlay();redraw();
   document.dispatchEvent(new CustomEvent('fab:sculpt-changed'));
   reportMesh(model);
  },onMessage:message});
 currentView={
  model,source,redraw,
  setCamera(view){
   const d=maxDimension*2;
   camera.up.set(0,0,1);
   if(view==='top')camera.position.set(0,0,d);
   else if(view==='side')camera.position.set(0,-d,.01);
   else camera.position.set(d*1.1,-d*1.25,d*.9);
   camera.lookAt(0,0,0);orbit.target.set(0,0,0);orbit.update();redraw();
  },
  setWireframe(enabled){
   model.traverse(mesh=>{if(mesh.isMesh){
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(const m of mats)if(m){m.wireframe=Boolean(enabled);m.needsUpdate=true;}
   }});
   redraw();
  },
  applyPlateOverlay(snapshot){
   if(source!=='parametric'||!snapshot?.simulation)return false;
   const length=Number(snapshot.values?.length);
   if(!Number.isFinite(length)||length<=0)return false;
   let applied=false;
   model.traverse(mesh=>{
    if(applied||!mesh.isMesh||!mesh.geometry?.attributes?.position)return;
    const geometry=mesh.geometry,positions=geometry.attributes.position,colors=new Float32Array(positions.count*3);
    const peak=Math.max(snapshot.simulation.nominalMaximumMpa,1e-8);
    const cold=new THREE.Color(0x35b6dc),warm=new THREE.Color(0xffbb50),plain=new THREE.Color(0x62dec1),pixel=new THREE.Color();
    for(let i=0;i<positions.count;i++){
     const t=Math.max(0,Math.min(1,(positions.getX(i)+length/2)/length));
     const stress=Math.max(0,snapshot.simulation.rootNominalStressMpa*(1-t));
     if(snapshot.overlay==='stress')pixel.lerpColors(cold,warm,Math.min(1,stress/peak));
     else pixel.copy(plain);
     colors[i*3]=pixel.r;colors[i*3+1]=pixel.g;colors[i*3+2]=pixel.b;
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))if(m){m.vertexColors=true;m.needsUpdate=true;}
    applied=true;
   });
   redraw();return applied;
  }
 };
 reportMesh(model);
 resize();
 const badge=document.createElement('span');badge.className='eng-fab-model-badge';
 badge.textContent=label+' — editing is local. STL exports may discard colors, materials, textures and original source parameters.';
 container.append(badge);
 cleanup=()=>{
  if(frame)cancelAnimationFrame(frame);
  if(observer)observer.disconnect();else window.removeEventListener('resize',resize);
  editor.dispose();orbit.dispose();
  model.traverse(node=>{if(node.isMesh){node.geometry?.dispose();
   const materials=Array.isArray(node.material)?node.material:[node.material];
   for(const mat of materials)mat?.dispose?.();
  }});
  renderer.dispose();
  if(currentView?.model===model)currentView=null;
  container.replaceChildren();
 };
 document.dispatchEvent(new CustomEvent('eng:geometry-loaded',{detail:{source,label}}));
 return {label};
}
export async function previewPrimitive(shape,container,dimensions){
 const model=defaultShape(shape,dimensions);
 await showModel(model,container,'Editable '+shape,shape==='plate'?'parametric':'primitive');
}
export async function previewFile(file,container,options={}){
 const ext=file.name.split('.').pop().toLowerCase();
 if(!['stl','obj','glb'].includes(ext)){
  // Preserve the active viewport if a CAD file cannot be previewed as a mesh.
  $('fab-sculpt-status').textContent='Editing unavailable for '+ext.toUpperCase()+'. Upload is still supported.';
  return;
 }
 if(file.size>15*1024*1024||!file.size)throw Error('Model must be 1 byte to 15 MB.');
 const bytes=await file.arrayBuffer();
 let model;
 if(ext==='stl'){
  const geometry=new STLLoader().parse(bytes);
  geometry.computeVertexNormals();model=surfaceMesh(geometry);
 }else if(ext==='obj'){
  model=new OBJLoader().parse(new TextDecoder().decode(bytes));
  model.traverse(node=>{if(node.isMesh){
   if(node.material?.dispose)node.material.dispose();
   node.material=new THREE.MeshStandardMaterial({color:0x63dcca,roughness:.6,side:THREE.DoubleSide});
  }});
 }else{
  if(glbHasExternalUris(bytes))throw Error('GLB has external linked resources; use a self-contained GLB.');
  const result=await new Promise((resolve,reject)=>new GLTFLoader().parse(bytes,'',resolve,reject));
  model=result.scene;
 }
 await showModel(model,container,ext.toUpperCase()+' source',options.sourceType==='ai'?'ai':'imported');
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

