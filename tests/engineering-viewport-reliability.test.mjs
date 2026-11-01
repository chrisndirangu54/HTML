import test from 'node:test';
import assert from 'node:assert/strict';
import {INPUT_UNITS,modelUnitScale,convertedBounds,modelVerificationStatus} from '../assets/js/engineering-geometry-units.mjs';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('unit conversion uses explicit, scientifically correct metric factors',()=>{
 assert.equal(modelUnitScale('mm'),1);
 assert.equal(modelUnitScale('cm'),10);
 assert.equal(modelUnitScale('m'),1000);
 assert.equal(modelUnitScale('in'),25.4);
 assert.deepEqual(convertedBounds([10,20,3],'cm'),[100,200,30]);
 assert.deepEqual(convertedBounds([1,2,3],'in'),[25.4,50.8,76.19999999999999]);
 assert.equal(Object.hasOwn(INPUT_UNITS,'__proto__'),false);
 for(const invalid of ['feet','1e9','unknown',null,'__proto__',undefined])
  assert.throws(()=>modelUnitScale(invalid));
});
test('raw imports and AI meshes remain unverified until source units are explicitly declared',()=>{
 assert.equal(modelVerificationStatus('imported',null).needsExplicitUnitSelection,true);
 assert.equal(modelVerificationStatus('ai',null).unitsVerified,false);
 assert.equal(modelVerificationStatus('imported','mm').unitsVerified,true);
 assert.equal(modelVerificationStatus('ai','in').originalUnits,'in');
 assert.equal(modelVerificationStatus('ai','in').units,'mm');
 assert.equal(modelVerificationStatus('parametric',null).unitsVerified,true);
 assert.equal(modelVerificationStatus('primitive',null).units,'mm');
});
test('bounded, finite dimensions guard unit conversion',()=>{
 assert.throws(()=>convertedBounds([1,2,Infinity],'mm'));
 assert.throws(()=>convertedBounds([-1,2,3],'mm'));
 assert.throws(()=>convertedBounds([100000,1,1],'m'));
 assert.throws(()=>convertedBounds(['1',2,3],'mm'));
 assert.throws(()=>convertedBounds([1,2],'mm'));
});
test('only one active Three.js renderer is retained when replacing the model',()=>{
 const src=read('assets/js/engineering-fabrication-preview.js');
 assert.match(src,/function createSession\(container\)/);
 assert.match(src,/if\(session\?\.container===container\)return session/);
 assert.match(src,/rendererCreated\+\+/);
 assert.match(src,/s\.editor\?\.dispose\(\)/);
 assert.match(src,/if\(s\.model\)\{s\.scene\.remove\(s\.model\);disposeModel\(s\.model\);\}/);
 assert.match(src,/return Object\.freeze\(\{active:!!currentView,rendererInstances:rendererCreated/);
 assert.match(src,/return showModel\(model,container/);
 assert.match(src,/window\.addEventListener\('resize'/);
});
test('stale asynchronous file reads and parses cannot overwrite a newer selected model',()=>{
 const src=read('assets/js/engineering-fabrication-preview.js');
 assert.match(src,/let session=null,currentView=null,requestVersion=0/);
 assert.match(src,/const ticket=\+\+requestVersion/);
 assert.match(src,/if\(ticket!==requestVersion\)return null/);
 assert.match(src,/if\(ticket!==requestVersion\)\{disposeModel\(model\);return null;\}/);
 assert.match(src,/if\(vertices>MAX_VERTICES\)/);
 assert.match(src,/!Number\.isFinite\(position\.array\[i\]\)/);
});
test('unit change resets input file and blocks fabrication until explicit verified STL selection',()=>{
 const pipeline=read('assets/js/engineering-pipeline.js');
 const app=read('assets/js/engineering-fabrication.js');
 const src=read('assets/js/engineering-fabrication-preview.js');
 assert.match(pipeline,/unitsVerified=event\.detail\.unitsVerified===true/);
 assert.match(pipeline,/reopenCurrentModelWithUnits\(unitSelect\.value\)/);
 assert.match(pipeline,/new CustomEvent\('fab:sculpt-changed'\)/);
 assert.match(pipeline,/use\.disabled=!viewer\|\|!unitsVerified/);
 assert.match(app,/source\?\.requiresUnitVerification/);
 assert.match(app,/pendingFile=null;window\.TeknUploadedDesignFile=null/);
 assert.match(src,/model\.scale\.multiplyScalar\(modelUnitScale\(inputUnits\)\)/);
 assert.match(src,/unitBasis:verification\.units/);
 assert.match(pipeline,/activeBounds\.map\(n=>Number\(n\)\.toFixed\(2\)\)/);
});