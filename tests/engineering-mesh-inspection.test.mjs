import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectTriangleGeometry as inspect} from '../assets/js/engineering-mesh-inspection.js';

test('closed tetrahedral triangle mesh has no exposed or non-manifold edges',()=>{
 const A=[0,0,0],B=[1,0,0],C=[0,1,0],D=[0,0,1];
 const faces=[[A,B,C],[A,D,B],[A,C,D],[B,D,C]];
 const pos=new Float32Array(faces.flat(2));
 const r=inspect(pos);
 assert.equal(r.triangleCount,4);
 assert.equal(r.approximateBoundaryEdges,0);
 assert.equal(r.approximateNonManifoldEdges,0);
 assert.equal(r.degenerateTriangles,0);
 assert.equal(r.potentiallyClosed,true);
});
test('a single triangle has three exposed boundary edges and is not watertight',()=>{
 const r=inspect(new Float32Array([0,0,0,1,0,0,0,1,0]));
 assert.equal(r.approximateBoundaryEdges,3);
 assert.equal(r.potentiallyClosed,false);
});
test('degenerate and nonfinite triangles are explicitly reported',()=>{
 const r=inspect(new Float32Array([0,0,0,1,0,0,2,0,0]));
 assert.equal(r.degenerateTriangles,1);
 assert.equal(r.potentiallyClosed,false);
 const bad=inspect(new Float32Array([0,0,0,1,0,0,NaN,1,0]));
 assert.equal(bad.invalidVertices,1);
});
test('large meshes use a bounded sample with an explicit partial warning',()=>{
 const r=inspect(new Float32Array([0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,0,1]),null,1);
 assert.equal(r.partial,true);
 assert.equal(r.inspectedTriangles,1);
 assert.equal(r.potentiallyClosed,false);
});
