const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const scope={};vm.runInNewContext(read('assets/js/engineering-models.js'),{globalThis:scope});
const geometry=scope.TeknEngineeringModels;
const page=read('engineering.html'),viewer=read('assets/js/engineering-cad-viewer.js');
const client=read('assets/js/engineering-studio.js'),css=read('assets/css/engineering-studio.css');

test('CAD page offers real 3D viewport rather than only source code',()=>{
 assert.match(page,/id="eng-cad-viewport"/);
 assert.match(page,/id="eng-cad-fallback"/);
 assert.match(page,/assets\/images\/engineering\/mounting-plate-placeholder\.svg/);
 assert.match(page,/id="eng-viewer-status"/);
 assert.match(page,/id="eng-view-iso"/);
 assert.match(page,/id="eng-view-top"/);
 assert.match(page,/id="eng-view-side"/);
 assert.match(page,/id="eng-view-reset"/);
 assert.match(page,/id="eng-view-edges"/);
 assert.match(page,/id="eng-download-stl"/);
 assert.match(page,/<details class="eng-cad-source-details" id="eng-cad-source-details">/);
 assert.match(page,/<pre class="eng-code" id="eng-scad-preview">/);
 const viewport=page.indexOf('id="eng-cad-viewport"'),source=page.indexOf('id="eng-scad-preview"');
 assert.ok(viewport<source,'real model must appear before collapsible source');
 assert.match(page,/role="region" aria-label="Interactive 3D mounting plate model"/);
});

test('Three.js is pinned with valid official module/addon import paths',()=>{
 assert.match(page,/<script type="importmap">/);
 assert.match(page,/three@0\.168\.0\/build\/three\.module\.js/);
 assert.match(page,/three@0\.168\.0\/examples\/jsm\//);
 assert.match(page,/type="module" src="assets\/js\/engineering-cad-viewer\.js"/);
 assert.match(viewer,/import \* as THREE from 'three'/);
 assert.match(viewer,/OrbitControls/);
 assert.match(viewer,/STLExporter/);
 assert.doesNotMatch(page,/three@latest|three@next/);
});

test('the actual 3D geometry has 4 proper through-holes and uses real plate thickness',()=>{
 assert.match(viewer,/new THREE\.Shape\(\)/);
 assert.match(viewer,/new THREE\.Path\(\)/);
 assert.match(viewer,/opening\.absarc\(x,y,hole\/2,0,Math\.PI\*2,true\)/);
 assert.match(viewer,/outline\.holes\.push\(opening\)/);
 assert.match(viewer,/for\(const x of \[left\+offset,right-offset\]\)/);
 assert.match(viewer,/for\(const y of \[bottom\+offset,top-offset\]\)/);
 assert.match(viewer,/new THREE\.ExtrudeGeometry\(outline/);
 assert.match(viewer,/depth:thickness/);
 assert.match(viewer,/bevelEnabled:false/);
 assert.match(viewer,/geometry\.translate\(0,0,-thickness\/2\)/);
 assert.match(viewer,/new THREE\.EdgesGeometry\(geometry,28\)/);
 assert.match(viewer,/new THREE\.WebGLRenderer/);
 assert.match(viewer,/renderer\.render\(scene,camera\)/);
 assert.match(viewer,/new OrbitControls\(camera,renderer\.domElement\)/);
 assert.match(viewer,/new ResizeObserver\(resize\)/);
});

test('model export and preview originate from the same dimension validation',()=>{
 const params={length:100,width:60,thickness:6,hole:5,offset:8};
 const m=geometry.mountingPlate(params);
 assert.match(m.scad,/length_mm = 100;/);
 assert.match(m.scad,/width_mm = 60;/);
 assert.match(m.scad,/thickness_mm = 6;/);
 assert.match(m.scad,/hole_diameter_mm = 5;/);
 assert.match(m.scad,/offset_mm = 8;/);
 assert.equal(m.holes,4);
 assert.ok(m.volumeMm3>35500 && m.volumeMm3<35600);
 assert.match(viewer,/const check=values=>cadModel\.mountingPlate\(values\)/);
 assert.match(client,/const updateCadSource=\(\)=>/);
 assert.match(client,/'eng-cad-form'\)\.addEventListener\('input',updateCadSource\)/);
 assert.match(client,/updateCadSource\(\);/);
 assert.match(viewer,/exporter\.parse\(original,\{binary:false\}\)/);
 assert.match(viewer,/tekntandao-mounting-plate-mm\.stl/);
 assert.match(viewer,/STL downloaded · dimensions in mm; validate mesh before manufacturing/);
});

test('reject overlapping or edge-breaking holes rather than drawing invalid geometry',()=>{
 assert.throws(()=>geometry.mountingPlate({length:100,width:40,thickness:6,hole:5,offset:18}));
 assert.throws(()=>geometry.mountingPlate({length:100,width:60,thickness:6,hole:10,offset:5}));
 assert.throws(()=>geometry.mountingPlate({length:100,width:60,thickness:6,hole:5,offset:31}));
 assert.doesNotThrow(()=>geometry.mountingPlate({length:100,width:60,thickness:6,hole:5,offset:8}));
});

test('realtime update, view presets, STL and fallback maintain usability',()=>{
 assert.match(viewer,/form\.addEventListener\('input'/);
 assert.match(viewer,/refresh\(false\)/);
 assert.match(viewer,/setView\('top'\)/);
 assert.match(viewer,/setView\('side'\)/);
 assert.match(viewer,/setView\('isometric'\)/);
 assert.match(viewer,/camera\.position\.multiplyScalar\(nextSpan\/previousSpan\)/);
 assert.match(viewer,/webglcontextlost/);
 assert.match(viewer,/WebGL unavailable — SVG preview and OpenSCAD source remain usable/);
 assert.match(css,/\.eng-cad-viewport/);
 assert.match(css,/\.eng-cad-source-details/);
 assert.match(css,/@media\(max-width:930px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 const svg=read('assets/images/engineering/mounting-plate-placeholder.svg');
 assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(svg,/<\/svg>$/);
 assert.doesNotMatch(svg,/<script|<foreignObject|<image|onload=/i);
});

test('view cannot actuate hardware or claim native STEP/BREP/FEA certification',()=>{
 assert.doesNotMatch(viewer,/fetch\(|XMLHttpRequest|eth_sendTransaction|serial\.requestPort|navigator\.usb|WebSocket/);
 assert.doesNotMatch(viewer,/STEPExporter|BRepExporter/);
 assert.match(page,/not manufacturing certification/);
 assert.match(page,/WebGL and pinned Three\.js modules/);
});