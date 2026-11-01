import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlate,normalizeScenario,assessDesign,makeRevision,compareRevisions,validateArchive,evidencePackage,REVISION_SCHEMA,MAX_REVISIONS} from '../assets/js/engineering-design-intelligence-core.mjs';
const scenario={geometry:{length:100,width:60,thickness:6,hole:5,offset:8},process:'cnc-milling',material:'Aluminium',modelMaterial:'aluminum',forceN:25};
test('valid plate produces independently reproducible measured solid volume and hole clearances',()=>{
 const x=assessDesign(scenario);
 assert.equal(x.geometry.edgeLigamentMm,5.5);
 assert.equal(x.geometry.holeSpacingXMm,79);
 assert.equal(x.geometry.holeSpacingYMm,39);
 assert.ok(Math.abs(x.geometry.solidVolumeMm3-(36000-4*Math.PI*2.5**2*6))<1e-8);
 assert.equal(x.status,'human-review-required');
 assert.equal(x.approvedForManufacture,false);
 assert.ok(x.findings.some(f=>f.id==='cnc-finish'));
 assert.ok(x.limitations.some(x=>x.includes('No certified FEM')));
});
test('geometrically valid thin ligament triggers review rather than unsupported approval',()=>{
 const x=assessDesign({...scenario,geometry:{...scenario.geometry,offset:3.5}});
 assert.equal(x.geometry.edgeLigamentMm,1);
 assert.ok(x.findings.some(f=>f.id==='edge-ligament'&&f.severity==='review'));
});
test('deep CNC hole and incompatible process assumptions are flagged',()=>{
 const x=assessDesign({...scenario,geometry:{...scenario.geometry,thickness:40,hole:5}});
 assert.ok(x.findings.some(f=>f.id==='drill-aspect'));
 const pcb=assessDesign({...scenario,process:'pcb-assembly',material:'PCB-FR4'});
 assert.ok(pcb.findings.some(f=>f.id==='pcb-design'));
 const print=assessDesign({...scenario,process:'3d-printing',material:'Steel'});
 assert.ok(print.findings.some(f=>f.id==='metal-am'));
});
test('input strictness rejects invalid or potentially malicious revision data',()=>{
 for(const bad of [{...scenario,geometry:{...scenario.geometry,hole:49}}, {...scenario,forceN:Infinity},
  {...scenario,process:'__proto__'},{...scenario,modelMaterial:'unlicensed'}])
  assert.throws(()=>normalizeScenario(bad));
 assert.throws(()=>normalizePlate({length:100,width:60,thickness:6,hole:5,offset:2.5}));
});
test('snapshots round-trip through bounded schema and compare geometry and process',()=>{
 const a=makeRevision(scenario,{id:'rev_aaaaaaaaaa',createdAt:'2026-11-01T00:00:00.000Z'});
 const b=makeRevision({...scenario,geometry:{...scenario.geometry,length:120},process:'laser-cutting'},{id:'rev_bbbbbbbbbb',createdAt:'2026-11-01T01:00:00.000Z'});
 const archive=validateArchive(JSON.stringify({schema:REVISION_SCHEMA,revisions:[a,b]}));
 assert.equal(archive.revisions.length,2);
 const difference=compareRevisions(a,b);
 assert.equal(difference.changes.find(c=>c.field==='length').delta,20);
 assert.ok(difference.changes.some(c=>c.field==='process'));
 assert.equal(difference.volumeDeltaMm3,20*scenario.geometry.width*scenario.geometry.thickness);
 assert.throws(()=>validateArchive({schema:REVISION_SCHEMA,revisions:Array(MAX_REVISIONS+1).fill(a)}));
 assert.throws(()=>validateArchive({schema:REVISION_SCHEMA,revisions:[a,a]}));
});
test('evidence package is explicit about units and lack of certification',()=>{
 const report=evidencePackage(scenario,{revisionId:'rev_aaaaaaaaaa',createdAt:'2026-11-01T00:00:00.000Z'});
 assert.equal(report.units,'mm / N / mm^3');
 assert.equal(report.preflight.scenario.material,'Aluminium');
 assert.equal(report.automatedApproval,false);
 assert.equal(report.preflight.approvedForManufacture,false);
 assert.equal(JSON.stringify(report).includes('contactEmail'),false);
});