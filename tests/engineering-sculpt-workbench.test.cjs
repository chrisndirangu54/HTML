const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('engineering.html');
const app=read('assets/js/engineering-fabrication.js');
const editor=read('assets/js/engineering-sculpt-editor.js');
const loader=read('assets/js/engineering-fabrication-preview.js');

test('Fabrication Hub exposes actual sculpt brushes, object transforms and editable primitive starters',()=>{
 for(const id of ['fab-sculpt-workbench','fab-sculpt-plate','fab-sculpt-tool',
  'fab-brush-radius','fab-brush-strength','fab-sculpt-symmetry',
  'fab-sculpt-undo','fab-sculpt-redo','fab-sculpt-reset','fab-sculpt-export',
  'fab-sculpt-use','fab-sculpt-status']){
   assert.ok(html.includes('id="'+id+'"'),id);
 }
 for(const mode of ['orbit','translate','rotate','scale','inflate','deflate','smooth','flatten','grab'])
  assert.ok(html.includes('value="'+mode+'"'),mode);
 for(const shape of ['sphere','box','cylinder'])
  assert.ok(html.includes('data-sculpt-shape="'+shape+'"'),shape);
 assert.match(html,/Use edited STL for quote/);
 assert.match(html,/local/);
});

test('actual 3D editor uses Three.js transform gizmos, raycast brush strokes and undo/redo',()=>{
 assert.match(editor,/TransformControls/);
 assert.match(editor,/STLExporter/);
 assert.match(editor,/new THREE\.Raycaster/);
 assert.match(editor,/canvas\.addEventListener\('pointerdown'/);
 assert.match(editor,/canvas\.addEventListener\('pointermove'/);
 assert.match(editor,/canvas\.addEventListener\('pointerup'/);
 assert.match(editor,/sculptStroke\(/);
 assert.match(editor,/buildSculptTopology/);
 assert.match(editor,/MAX_HISTORY/);
 assert.match(editor,/undo\.push\(/);
 assert.match(editor,/redo\.push\(/);
 assert.match(editor,/restore\(baseline\)/);
 assert.match(editor,/gizmo\.setMode\(mode\)/);
 assert.match(editor,/model\.updateMatrixWorld\(true\)/);
 assert.match(editor,/new STLExporter\(\)\.parse\(model,\{binary:true\}\)/);
});

test('edited geometry is never automatically uploaded and must be explicitly selected for review',()=>{
 assert.match(editor,/fab:edited-stl-ready/);
 assert.match(loader,/fab:sculpt-changed/);
 assert.match(editor,/onDirty\(\)/);
 assert.match(editor,/fab-sculpt-use/);
 assert.match(app,/document\.addEventListener\('fab:edited-stl-ready'/);
 assert.match(app,/document\.addEventListener\('fab:sculpt-changed'/);
 assert.match(app,/pendingFile=null/);
 assert.match(app,/pendingFile=file/);
 assert.match(app,/upload\.checked=true/);
 assert.match(app,/createProject|engineeringCreateProject/);
 assert.match(app,/fab-consent/);
 assert.doesNotMatch(editor,/fetch\(|XMLHttpRequest|httpsCallable|uploadBytes|PAYSTACK|localStorage/);
 assert.match(editor,/file\.size>15\*1024\*1024/);
});

test('browser preview supplies primitives and imports real STL OBJ GLB',()=>{
 assert.match(loader,/export async function previewPrimitive/);
 assert.match(loader,/export async function previewFile/);
 assert.match(loader,/SphereGeometry/);
 assert.match(loader,/BoxGeometry/);
 assert.match(loader,/CylinderGeometry/);
 assert.match(loader,/ExtrudeGeometry/);
 assert.match(loader,/STLLoader/);
 assert.match(loader,/OBJLoader/);
 assert.match(loader,/GLTFLoader/);
 assert.match(loader,/glbHasExternalUris/);
 assert.match(loader,/createMeshEditor\(/);
 assert.match(loader,/reportMesh\(model\)/);
});

test('editing must not call paid AI, save to public storage or control physical fabrication',()=>{
 assert.doesNotMatch(editor,/navigator\.usb|navigator\.serial|WebSocket|onCall|requestFabOrder/);
 assert.doesNotMatch(loader,/firebase\/|fetch\(|axios|uploadBytes|httpsCallable/);
 assert.match(html,/Confirm the unit system and model integrity/);
 assert.match(html,/no AI credits are consumed/);
 assert.match(read('assets/css/engineering-fabrication.css'),/\.eng-sculpt-workbench/);
});
