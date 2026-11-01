const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const scope={};vm.runInNewContext(read('assets/js/engineering-models.js'),{globalThis:scope});
const M=scope.TeknEngineeringModels;
const dims={length:100,width:60,thickness:6,hole:5,offset:8};
const near=(a,b,rel=1e-9)=>assert.ok(Math.abs(a-b)<=Math.max(1e-12,Math.abs(b)*rel),a+' differs from '+b);

test('plate screening matches analytical Euler-Bernoulli end-load deflection and root stress',()=>{
 const r=M.plateSimulation({...dims,material:'aluminum',forceN:25});
 const E=69e9,I=.06*Math.pow(.006,3)/12;
 const expectedDef=25*.1**3/(3*E*I)*1000;
 const expectedStress=6*25*.1/(.06*.006**2)/1e6;
 near(r.tipDeflectionMm,expectedDef);
 near(r.rootNominalStressMpa,expectedStress);
 near(r.massKg,(36000-4*Math.PI*2.5**2*6)*1e-9*2700);
 assert.equal(r.model,'Euler-Bernoulli cantilever surrogate — not FEM');
 assert.equal(r.notCertified,true);assert.equal(r.noFEM,true);
 assert.equal(r.profile.length,21);
 near(r.profile[0].deflectionMm,0);
 near(r.profile[20].deflectionMm,r.tipDeflectionMm);
 assert.ok(r.nominalMaximumMpa>=r.rootNominalStressMpa);
 assert.ok(r.warnings.some(v=>v.includes('not plate FEA')));
 assert.ok(r.warnings.some(v=>v.includes('notch concentrations')));
});

test('force scales linearly and zero force yields zero stress and deflection',()=>{
 const zero=M.plateSimulation({...dims,material:'aluminum',forceN:0});
 assert.equal(zero.tipDeflectionMm,0);assert.equal(zero.nominalMaximumMpa,0);
 assert.equal(zero.nominalYieldMargin,null);
 const a=M.plateSimulation({...dims,material:'aluminum',forceN:15});
 const b=M.plateSimulation({...dims,material:'aluminum',forceN:30});
 near(b.tipDeflectionMm,2*a.tipDeflectionMm);
 near(b.nominalMaximumMpa,2*a.nominalMaximumMpa);
 near(a.nominalYieldMargin,2*b.nominalYieldMargin);
 near(M.plateBeamDeflectionMm(15,100,60,6,69,50)/a.tipDeflectionMm, .5**2*(3-.5)/2);
 near(M.plateStressAtMm(15,100,60,6,50)/a.rootNominalStressMpa,.5);
});

test('stiffer materials deflect less and slimmer geometries deflect more',()=>{
 const alu=M.plateSimulation({...dims,material:'aluminum',forceN:30});
 const steel=M.plateSimulation({...dims,material:'steel',forceN:30});
 const petg=M.plateSimulation({...dims,material:'petg',forceN:30});
 assert.ok(steel.tipDeflectionMm<alu.tipDeflectionMm);
 assert.ok(alu.tipDeflectionMm<petg.tipDeflectionMm);
 const thinner=M.plateSimulation({...dims,thickness:3,material:'aluminum',forceN:30});
 near(thinner.tipDeflectionMm,alu.tipDeflectionMm*8);
 assert.ok(thinner.nominalMaximumMpa>alu.nominalMaximumMpa);
 assert.ok(petg.warnings.some(v=>v.includes('build direction')));
});

test('invalid holes, materials, loads and dimensions never create results',()=>{
 assert.throws(()=>M.plateSimulation({...dims,offset:50,material:'aluminum',forceN:20}));
 assert.throws(()=>M.plateSimulation({...dims,offset:2,material:'aluminum',forceN:20}));
 assert.throws(()=>M.plateSimulation({...dims,material:'invalid',forceN:20}));
 assert.throws(()=>M.plateSimulation({...dims,material:'aluminum',forceN:-1}));
 assert.throws(()=>M.plateSimulation({...dims,material:'aluminum',forceN:5001}));
 assert.throws(()=>M.plateSimulation({...dims,thickness:0,material:'aluminum',forceN:5}));
});

test('page exposes genuine interactive load and material controls, results and export',()=>{
 const html=read('engineering.html'),ui=read('assets/js/engineering-simulator.js');
 for(const id of ['eng-sim-controls','eng-cad-reset','eng-offset-help',
   'eng-sim-material','eng-sim-load','eng-sim-load-number','eng-sim-scale','eng-sim-view',
   'eng-sim-play','eng-sim-stop','eng-sim-export','eng-sim-time',
   'eng-sim-kpis','eng-sim-warnings','eng-sim-plot','eng-sim-error']) {
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/assets\/js\/engineering-simulator\.js/);
 assert.match(html,/Load sweep position/);
 assert.match(html,/not plate finite-element analysis/);
 assert.match(ui,/M\.plateSimulation/);
 assert.match(ui,/new CustomEvent\('eng:plate-simulation'/);
 assert.match(ui,/requestAnimationFrame\(frame\)/);
 assert.match(ui,/cancelAnimationFrame\(frameId\)/);
 assert.match(ui,/eng-cad-reset/);
 assert.match(ui,/Offset|offset/i);
 assert.match(ui,/application\/json/);
 assert.match(ui,/prefers-reduced-motion: reduce/);
 const style=read('assets/css/engineering-studio.css');
 assert.match(style,/\.eng-sim-kpis/);
 assert.match(style,/\.eng-sim-controls/);
 assert.match(style,/@media\(max-width:960px\)/);
});

test('3D viewer computes deformation from nominal beam solution and keeps CAD STL undeformed',()=>{
 const code=read('assets/js/engineering-cad-viewer.js');
 assert.match(code,/addEventListener\('eng:plate-simulation'/);
 assert.match(code,/Float32Array\.from\(plate\.geometry\.attributes\.position\.array\)/);
 assert.match(code,/position\.array\[k\+2\]=originalPositions\[k\+2\]-deflection/);
 assert.match(code,/t\*t\*\(3-t\)\/2/);
 assert.match(code,/new THREE\.BufferAttribute\(colors,3\)/);
 assert.match(code,/new THREE\.ArrowHelper/);
 assert.match(code,/new THREE\.BoxGeometry/);
 assert.match(code,/const original=new THREE\.Mesh\(lastSolid\)/);
 assert.match(code,/exporter\.parse\(original,\{binary:false\}\)/);
 assert.doesNotMatch(code,/STEPExporter|BRepExporter|fetch\(|WebSocket|navigator\.serial/);
});
