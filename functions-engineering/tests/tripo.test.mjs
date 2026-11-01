import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIPO_COST,TRIPO_MODEL,taskId,modelPrompt,imageBytes,safeUrl} from '../tripo-core.mjs';
test('Tripo is explicitly priced and version pinned',()=>{assert.equal(TRIPO_COST,10);assert.equal(TRIPO_MODEL,'v3.1-20260211');});
test('task and prompt validation',()=>{assert.equal(taskId('abc123456789123'),'abc123456789123');assert.throws(()=>taskId('../secret'));assert.throws(()=>modelPrompt('hi'));assert.throws(()=>modelPrompt('z'.repeat(1025)));});
test('image magic byte validation',()=>{const b=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(128)]);assert.equal(imageBytes(b.toString('base64'),'image/png').ext,'png');assert.throws(()=>imageBytes(b.toString('base64'),'image/jpeg'));});
test('GLB URL requires trusted HTTPS provider host',()=>{assert.equal(safeUrl('https://cdn.tripo3d.ai/result.glb'),'https://cdn.tripo3d.ai/result.glb');assert.throws(()=>safeUrl('http://cdn.tripo3d.ai/result.glb'));assert.throws(()=>safeUrl('https://tripo3d.ai.evil.com/p'));});
