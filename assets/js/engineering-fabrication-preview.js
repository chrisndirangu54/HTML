/* Local-only STL, OBJ, GLB preview. No CAD file leaves the browser from this module. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {inspectTriangleGeometry} from './engineering-mesh-inspection.js';

let cleanup=null;
function glbHasExternalUris(buf){
  const data=new DataView(buf);
  if(data.byteLength<20||data.getUint32(0,true)!==0x46546c67)return true;
  const len=data.getUint32(12,true),type=data.getUint32(16,true);
  if(type!==0x4e4f534a||len>1_000_000||len+20>data.byteLength)return true;
  const text=new TextDecoder().decode(new Uint8Array(buf,20,len)).replace(/\0+$/,'');
  const json=JSON.parse(text);
  return [...(json.buffers||[]),...(json.images||[])].some(x=>x.uri&&!String(x.uri).startsWith('data:'));
}
export async function previewFile(file,container){
 if(cleanup){cleanup();cleanup=null;}
 container.replaceChildren();
 const ext=file.name.split('.').pop().toLowerCase();
 if(!['stl','obj','glb'].includes(ext)){
  container.textContent='This format is accepted for private quotation, but local 3D rendering is only available for STL, OBJ and self-contained GLB. Open STEP/SCAD in FreeCAD or OpenSCAD, DXF in FreeCAD, 3MF in a compatible slicer and PDF in a document viewer.';
  return;
 }
 if(file.size>15*1024*1024||file.size===0)throw Error('File must be 1 byte to 15 MB.');
 const bytes=await file.arrayBuffer();
 let model;
 if(ext==='stl'){
  const geom=new STLLoader().parse(bytes);geom.computeVertexNormals();
  model=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:0x63dcc9,metalness:.15,roughness:.65,side:THREE.DoubleSide}));
 }else if(ext==='obj'){
  model=new OBJLoader().parse(new TextDecoder().decode(bytes));
  model.traverse(x=>{if(x.isMesh)x.material=new THREE.MeshStandardMaterial({color:0x64dcc7,side:THREE.DoubleSide});});
 }else{
  if(glbHasExternalUris(bytes))throw Error('GLB references external resources; please supply a self-contained GLB.');
  const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(bytes,'',resolve,reject));
  model=gltf.scene;
 }
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
 renderer.setClearColor(0x0b1e21);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 container.append(renderer.domElement);
 const scene=new THREE.Scene();
 scene.add(new THREE.HemisphereLight(0xe9fffa,0x204540,2.4));
 const key=new THREE.DirectionalLight(0xffffff,2.7);key.position.set(8,-7,10);scene.add(key);
 const assessments=[];
 model.traverse(node=>{
   if(!node.isMesh||!node.geometry?.attributes?.position)return;
   try{
     const g=node.geometry,positions=g.attributes.position.array,idx=g.index?.array||null;
     assessments.push(inspectTriangleGeometry(positions,idx,Math.max(5000,Math.floor(50000/(assessments.length+1)))));
   }catch(_){ /* File may still be viewable even when mesh heuristics cannot inspect it. */ }
 });
 const report=document.getElementById('fab-mesh-report');
 if(report){
   const triangles=assessments.reduce((n,x)=>n+x.triangleCount,0);
   const boundaries=assessments.reduce((n,x)=>n+x.approximateBoundaryEdges,0);
   const nonManifold=assessments.reduce((n,x)=>n+x.approximateNonManifoldEdges,0);
   const degenerate=assessments.reduce((n,x)=>n+x.degenerateTriangles,0);
   report.textContent='Local mesh preflight: '+triangles.toLocaleString()+' triangles; '+
      boundaries+' approximate open edges; '+nonManifold+' non-manifold edges; '+
      degenerate+' degenerate triangles. '+(assessments.some(a=>a.partial)?'Partial scan: complex model. ':'')+
      'This does not certify watertightness, fit, strength, dimensions or fabrication readiness. Units must be verified.';
 }
 const box=new THREE.Box3().setFromObject(model);
 if(box.isEmpty())throw Error('No renderable 3D geometry found.');
 const size=box.getSize(new THREE.Vector3());
 if(!Number.isFinite(size.x+size.y+size.z)||Math.max(size.x,size.y,size.z)<=0)throw Error('Model dimensions are not valid.');
 const center=box.getCenter(new THREE.Vector3());model.position.sub(center);
 scene.add(model);
 const radius=Math.max(size.x,size.y,size.z,1);
 const camera=new THREE.PerspectiveCamera(45,1,0.1,radius*100);
 camera.position.set(radius*1.7,-radius*1.9,radius*1.4);camera.lookAt(0,0,0);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=false;controls.minDistance=radius*.25;controls.maxDistance=radius*30;
 let frame=0,observer=null;
 const draw=()=>{frame=0;renderer.render(scene,camera);};
 const render=()=>{if(!frame)frame=requestAnimationFrame(draw);};
 controls.addEventListener('change',render);
 const resize=()=>{
  const width=Math.max(10,container.clientWidth),height=Math.max(10,container.clientHeight);
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();
 };
 if('ResizeObserver' in window){observer=new ResizeObserver(resize);observer.observe(container);}
 else window.addEventListener('resize',resize);
 resize();
 cleanup=()=>{
  if(frame)cancelAnimationFrame(frame);
  if(observer)observer.disconnect();else window.removeEventListener('resize',resize);
  controls.dispose();
  model.traverse(x=>{if(x.geometry)x.geometry.dispose();if(x.material){
   const list=Array.isArray(x.material)?x.material:[x.material];list.forEach(mat=>mat.dispose());
  }});
  renderer.dispose();
 };
 const badge=document.createElement('span');badge.className='eng-fab-model-badge';
 badge.textContent=ext.toUpperCase()+' local inspection · not a watertightness or manufacturability certification';
 container.append(badge);
}