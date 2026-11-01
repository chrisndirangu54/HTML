/* Local mesh sculpting + object editing with pinned open-source Three.js.
   No network uploads, AI billing or manufacturing actions are performed here. */
import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {STLExporter} from 'three/addons/exporters/STLExporter.js';
import {buildSculptTopology,sculptStroke,MAX_HISTORY} from './engineering-sculpt-core.mjs';

const $=id=>document.getElementById(id);
const brushModes=new Set(['inflate','deflate','smooth','flatten','grab']);
const transformModes=new Set(['translate','rotate','scale']);
const EPS=1e-7;

export function createMeshEditor({model,scene,camera,renderer,orbit,redraw,onDirty,onMessage}){
 const canvas=renderer.domElement;
 const tool=$('fab-sculpt-tool'),radius=$('fab-brush-radius'),
  strength=$('fab-brush-strength'),symmetry=$('fab-sculpt-symmetry');
 const undoButton=$('fab-sculpt-undo'),redoButton=$('fab-sculpt-redo'),
  resetButton=$('fab-sculpt-reset'),exportButton=$('fab-sculpt-export'),
  useButton=$('fab-sculpt-use');
 const meshes=[];let meshVertices=0,disposed=false;
 model.traverse(object=>{
  if(object.isMesh&&object.geometry?.attributes?.position){
   meshes.push(object);
   meshVertices+=object.geometry.attributes.position.count;
  }
 });
 if(!meshes.length)throw Error('Model has no editable triangle surfaces.');
 // Mesh edits are limited to protect modest browsers from extreme memory usage.
 const limit=meshVertices>150000;
 const originalMaterials=[];
 for(const mesh of meshes){
  if(Array.isArray(mesh.material)){
   // STL/OBJ edits do not require material groups; a shared simple surface is easier to inspect.
   originalMaterials.push([mesh,mesh.material]);
   mesh.material=new THREE.MeshStandardMaterial({color:0x6fdbca,roughness:.55,side:THREE.DoubleSide});
  }
 }
 const topology=new Map();
 if(!limit){
  for(const mesh of meshes){
   const g=mesh.geometry;
   // Clone to avoid mutating an imported file's source geometry in place.
   mesh.geometry=g.clone();
   g.dispose(); // Original GPU buffers are no longer referenced after the editor takes its clone.
   try{topology.set(mesh,buildSculptTopology(mesh.geometry.attributes.position.array,mesh.geometry.index?.array||null));}
   catch(e){onMessage('Sculpt unavailable for this mesh: '+e.message);}
  }
 }
 const bounds=new THREE.Box3().setFromObject(model);
 const diagonal=Math.max(bounds.getSize(new THREE.Vector3()).length(),1);
 let undo=[],redo=[],stroke=null,dragging=false,lastStamp=0,baseline=null,transformStart=null;
 const snapshot=()=>({
  parts:meshes.map(m=>Float32Array.from(m.geometry.attributes.position.array)),
  position:model.position.toArray(),rotation:model.quaternion.toArray(),scale:model.scale.toArray()
 });
 const same=(a,b)=>{
  if(!a||!b)return false;
  if(a.parts.length!==b.parts.length)return false;
  for(const p of ['position','rotation','scale'])
   if(a[p].some((v,i)=>Math.abs(v-b[p][i])>EPS))return false;
  return a.parts.every((part,i)=>part.length===b.parts[i].length&&part.every((v,j)=>v===b.parts[i][j]));
 };
 const updateGeometry=()=>{
  for(const mesh of meshes){
   const g=mesh.geometry;
   g.attributes.position.needsUpdate=true;
   g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();
  }
  redraw();
 };
 const restore=state=>{
  if(!state)return;
  for(let i=0;i<meshes.length;i++){
   const attr=meshes[i].geometry.attributes.position;
   if(attr.array.length!==state.parts[i].length)throw Error('Incompatible geometry history.');
   attr.array.set(state.parts[i]);
  }
  model.position.fromArray(state.position);
  model.quaternion.fromArray(state.rotation);
  model.scale.fromArray(state.scale);
  model.updateMatrixWorld(true);
  updateGeometry();
 };
 baseline=snapshot();
 const announce=message=>{if(!disposed)onMessage(message);};
 const historyButtons=()=>{
  undoButton.disabled=!undo.length;redoButton.disabled=!redo.length;
  resetButton.disabled=false;exportButton.disabled=false;useButton.disabled=false;
 };
 const markChanged=before=>{
  if(!before||same(before,snapshot()))return false;
  undo.push(before);if(undo.length>MAX_HISTORY)undo.shift();
  redo=[];historyButtons();onDirty();return true;
 };
 const gizmo=new TransformControls(camera,canvas);
 const helper=gizmo.getHelper();scene.add(helper);gizmo.attach(model);gizmo.detach();
 gizmo.addEventListener('change',redraw);
 gizmo.addEventListener('dragging-changed',ev=>{orbit.enabled=!ev.value;});
 gizmo.addEventListener('mouseDown',()=>{transformStart=snapshot();});
 gizmo.addEventListener('mouseUp',()=>{if(markChanged(transformStart))announce('Object transformed. Export STL to preserve this edit.');transformStart=null;});
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),normalMatrix=new THREE.Matrix3();
 const hitAt=ev=>{
  const box=canvas.getBoundingClientRect();
  pointer.set(((ev.clientX-box.left)/box.width)*2-1,-((ev.clientY-box.top)/box.height)*2+1);
  raycaster.setFromCamera(pointer,camera);
  const intersections=raycaster.intersectObjects(meshes,false);
  return intersections.find(h=>topology.has(h.object))||null;
 };
 const brushSettings=()=>{
  $('fab-brush-radius-label').textContent=radius.value+'%';
  $('fab-brush-strength-label').textContent=strength.value+'%';
 };
 brushSettings();
 const brushStamp=(hit,ev)=>{
  if(!hit||!stroke)return false;
  const mesh=hit.object;
  const topo=topology.get(mesh);if(!topo)return false;
  mesh.updateMatrixWorld(true);
  const p=mesh.worldToLocal(hit.point.clone());
  const localNormal=hit.face?.normal?.clone()||new THREE.Vector3(0,0,1);
  localNormal.normalize();
  const worldScale=mesh.getWorldScale(new THREE.Vector3());
  const avgScale=Math.max(0.00001,(Math.abs(worldScale.x)+Math.abs(worldScale.y)+Math.abs(worldScale.z))/3);
  const size=diagonal*(Number(radius.value)/100)/avgScale;
  const power=Number(strength.value)/100;
  let direction=[0,0,0];
  if(tool.value==='grab'){
   const dx=ev.clientX-stroke.lastX,dy=ev.clientY-stroke.lastY;
   const cameraRight=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
   const cameraUp=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
   const worldDelta=cameraRight.multiplyScalar(dx*diagonal/Math.max(300,canvas.clientWidth)).add(
    cameraUp.multiplyScalar(-dy*diagonal/Math.max(300,canvas.clientHeight)));
   const transform=normalMatrix.setFromMatrix4(mesh.matrixWorld).invert();
   worldDelta.applyMatrix3(transform);
   direction=worldDelta.toArray();
  }
  const result=sculptStroke(mesh.geometry.attributes.position.array,topo,{
   mode:tool.value,center:p.toArray(),normal:localNormal.toArray(),direction,
   radius:Math.max(.00001,size),strength:power,symmetryX:symmetry.checked
  });
  stroke.lastX=ev.clientX;stroke.lastY=ev.clientY;
  if(result.affected){stroke.changed=true;updateGeometry();return true;}
  return false;
 };
 const onPointerDown=ev=>{
  if(disposed||!brushModes.has(tool.value)||ev.button!==0||limit)return;
  const hit=hitAt(ev);if(!hit)return;
  ev.stopImmediatePropagation();ev.preventDefault();
  orbit.enabled=false;
  dragging=true;stroke={before:snapshot(),lastX:ev.clientX,lastY:ev.clientY,changed:false,lastHit:hit};
  canvas.setPointerCapture?.(ev.pointerId);
  if(tool.value!=='grab')brushStamp(hit,ev);
 };
 const onPointerMove=ev=>{
  if(!dragging||!stroke)return;
  ev.stopImmediatePropagation();ev.preventDefault();
  const now=performance.now();
  if(now-lastStamp<24)return;
  lastStamp=now;
  const hit=hitAt(ev)||stroke.lastHit;
  if(hit){stroke.lastHit=hit;brushStamp(hit,ev);}
 };
 const onPointerUp=ev=>{
  if(!dragging)return;
  ev.stopImmediatePropagation();
  dragging=false;
  if(stroke?.changed){
   if(markChanged(stroke.before))announce('Sculpt stroke applied. Choose Use edited STL before submitting for fabrication.');
  }
  stroke=null;
  if(canvas.hasPointerCapture?.(ev.pointerId))canvas.releasePointerCapture(ev.pointerId);
 };
 canvas.addEventListener('pointerdown',onPointerDown,true);
 canvas.addEventListener('pointermove',onPointerMove,true);
 canvas.addEventListener('pointerup',onPointerUp,true);
 canvas.addEventListener('pointercancel',onPointerUp,true);
 const changeMode=()=>{
  const mode=tool.value;
  gizmo.detach();
  orbit.enabled=!brushModes.has(mode);
  if(transformModes.has(mode)){gizmo.attach(model);gizmo.setMode(mode);}
  if(brushModes.has(mode)&&limit)announce('This model is too dense for interactive brushes. Use Move/Rotate/Scale, or simplify externally.');
  else announce(brushModes.has(mode)?'Drag on the surface to '+mode+'. Orbit is paused while sculpting.':mode==='orbit'?'Orbit and zoom the model.':mode+' mode: drag the colored gizmo handles.');
  redraw();
 };
 tool.addEventListener('change',changeMode);
 radius.addEventListener('input',brushSettings);
 strength.addEventListener('input',brushSettings);
 const onUndo=()=>{
  if(!undo.length)return;
  redo.push(snapshot());restore(undo.pop());historyButtons();onDirty();announce('Undo complete.');
 };
 const onRedo=()=>{
  if(!redo.length)return;
  undo.push(snapshot());restore(redo.pop());historyButtons();onDirty();announce('Redo complete.');
 };
 const onReset=()=>{
  const before=snapshot();
  restore(baseline);
  if(markChanged(before))announce('Model restored to its original imported or primitive geometry.');
 };
 undoButton.addEventListener('click',onUndo);
 redoButton.addEventListener('click',onRedo);
 resetButton.addEventListener('click',onReset);
 const exportedFile=()=>{
  // Includes object transforms; conversion to STL loses original textures/materials.
  model.updateMatrixWorld(true);
  const data=new STLExporter().parse(model,{binary:true});
  const bytes=data instanceof DataView?data.buffer:data;
  const blob=new Blob([bytes],{type:'model/stl'});
  return new File([blob],'tekntandao-sculpted-model.stl',{type:'model/stl'});
 };
 const saveFile=file=>{
  const url=URL.createObjectURL(file),a=document.createElement('a');
  a.href=url;a.download=file.name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 const onDownload=()=>{
  try{
   const file=exportedFile();saveFile(file);
   announce('STL downloaded. Check units, manifold integrity and fit before fabrication.');
  }catch(e){announce('Could not export STL: '+e.message);}
 };
 const onUse=()=>{
  try{
   const file=exportedFile();
   if(file.size>15*1024*1024)throw Error('Export exceeds the 15 MB upload limit. Simplify the mesh or download it.');
   document.dispatchEvent(new CustomEvent('fab:edited-stl-ready',{detail:{file}}));
   announce('Edited STL selected for the fabrication request. Review the material, tolerances and file before submission.');
  }catch(e){announce('Could not prepare edited STL: '+e.message);}
 };
 exportButton.addEventListener('click',onDownload);
 useButton.addEventListener('click',onUse);
 const hotkeys=ev=>{
  if(disposed||!(ev.ctrlKey||ev.metaKey)||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if(ev.key.toLowerCase()==='z'){ev.preventDefault();ev.shiftKey?onRedo():onUndo();}
 };
 canvas.addEventListener('keydown',hotkeys);
 canvas.tabIndex=0;
 historyButtons();changeMode();
 if(limit)announce('Large model ('+meshVertices.toLocaleString()+' vertices). Transform/export enabled; sculpt brushes disabled to protect browser memory.');
 return {dispose(){
  disposed=true;canvas.removeEventListener('pointerdown',onPointerDown,true);
  canvas.removeEventListener('pointermove',onPointerMove,true);
  canvas.removeEventListener('pointerup',onPointerUp,true);
  canvas.removeEventListener('pointercancel',onPointerUp,true);
  canvas.removeEventListener('keydown',hotkeys);
  tool.removeEventListener('change',changeMode);
  radius.removeEventListener('input',brushSettings);
  strength.removeEventListener('input',brushSettings);
  undoButton.removeEventListener('click',onUndo);
  redoButton.removeEventListener('click',onRedo);
  resetButton.removeEventListener('click',onReset);
  exportButton.removeEventListener('click',onDownload);
  useButton.removeEventListener('click',onUse);
  gizmo.detach();scene.remove(helper);gizmo.dispose();
  for(const [mesh,mat] of originalMaterials){mesh.material.dispose();mesh.material=mat;}
  orbit.enabled=true;
 }};
}
