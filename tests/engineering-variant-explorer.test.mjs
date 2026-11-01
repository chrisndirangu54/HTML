import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {explorePlate} from '../assets/js/engineering-variant-core.mjs';
const require=createRequire(import.meta.url),M=require('../assets/js/engineering-models.js');
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