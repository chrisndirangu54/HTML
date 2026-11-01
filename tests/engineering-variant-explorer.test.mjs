import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {explorePlate} from '../assets/js/engineering-variant-core.mjs';
const scope={};
runInNewContext(readFileSync(new URL('../assets/js/engineering-models.js',import.meta.url),'utf8'),{globalThis:scope});
const M=scope.TeknEngineeringModels;
const scenario={geometry:{length:100,width:60,thickness:6,hole:5,offset:8},process:'cnc-milling',material:'Aluminium',modelMaterial:'aluminum',forceN:25};
test('seven valid thickness options are evaluated reproducibly with the existing physics model',()=>{
 const r=explorePlate(scenario,params=>M.plateSimulation(params),{maxDeflectionMm:1,minMargin:1.5});
 assert.equal(r.results.length,7);
 assert.ok(r.results.every(x=>x.massGrams>0&&!x.approved));
 assert.ok(r.results.every((x,i)=>!i||x.massGrams>=r.results[i-1].massGrams));
 assert.equal(r.limitations.includes('No strength'),true);
});
test('zero load cannot satisfy stress screening, and targets must be finite and bounded',()=>{
 const r=explorePlate({...scenario,forceN:0},params=>M.plateSimulation(params));
 assert.equal(r.lightestScreened,null);
 assert.throws(()=>explorePlate(scenario,x=>M.plateSimulation(x),{maxDeflectionMm:NaN}));
 assert.throws(()=>explorePlate(scenario,x=>M.plateSimulation(x),{minMargin:0}));
});