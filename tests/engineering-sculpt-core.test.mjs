import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSculptTopology,sculptStroke,MAX_HISTORY,MAX_SCULPT_VERTICES}
 from '../assets/js/engineering-sculpt-core.mjs';

test('STL-style duplicate positions are welded so edits do not tear triangle seams',()=>{
 const positions=new Float32Array([
   0,0,0, 1,0,0, 0,1,0,
   0,0,0, 0,1,0, -1,0,0
 ]);
 const topo=buildSculptTopology(positions);
 assert.equal(topo.vertexCount,6);assert.equal(topo.groups.length,4);
 const changed=sculptStroke(positions,topo,{mode:'inflate',center:[0,0,0],
  normal:[0,0,1],radius:1.5,strength:.8});
 assert.ok(changed.affected>=1);
 assert.ok(positions[2]>0);
 assert.equal(positions[2],positions[11],'duplicate triangle vertex must be moved identically');
});
test('inflate/deflate, flatten and smoothing change vertex positions predictably',()=>{
 const starting=new Float32Array([0,0,1,1,0,0,0,1,0]);
 const topo=buildSculptTopology(starting);
 const afterInflate=new Float32Array(starting);
 sculptStroke(afterInflate,topo,{mode:'inflate',center:[0,0,1],
   normal:[0,0,1],radius:2,strength:1});
 assert.ok(afterInflate[2]>starting[2]);
 sculptStroke(afterInflate,topo,{mode:'deflate',center:[0,0,1],
   normal:[0,0,1],radius:2,strength:.5});
 assert.ok(afterInflate[2]<starting[2]+.32);
 const flattened=new Float32Array(starting);
 sculptStroke(flattened,topo,{mode:'flatten',center:[0,0,0],normal:[0,0,1],
   radius:3,strength:1});
 assert.ok(flattened[2]<starting[2]);
 const smooth=new Float32Array(starting);
 sculptStroke(smooth,topo,{mode:'smooth',center:[0,0,1],
   normal:[0,0,1],radius:3,strength:1});
 assert.ok(smooth[2]<starting[2]);
});
test('symmetry reflects brush effect across local x axis',()=>{
 const pts=new Float32Array([
  1,0,0, 0,1,0, 0,0,1,
  -1,0,0,0,1,0,0,0,1
 ]);
 const topology=buildSculptTopology(pts);
 const changed=sculptStroke(pts,topology,{mode:'inflate',center:[1,0,0],
  normal:[0,0,1],radius:.55,strength:1,symmetryX:true});
 assert.equal(changed.affected,2);
 assert.ok(pts[2]>0&&pts[11]>0);
 assert.equal(pts[2],pts[11]);
});
test('grab uses drag displacement and zero-strength brush is non-destructive',()=>{
 const pts=new Float32Array([0,0,0,2,0,0,0,2,0]);
 const topology=buildSculptTopology(pts);
 const none=sculptStroke(pts,topology,{mode:'inflate',center:[0,0,0],
   normal:[0,0,1],radius:1,strength:0});
 assert.equal(none.affected,0);
 const moved=sculptStroke(pts,topology,{mode:'grab',center:[0,0,0],
  direction:[.5,.25,0],radius:1,strength:1});
 assert.equal(moved.affected,1);
 assert.equal(pts[0],.5);assert.equal(pts[1],.25);
});
test('invalid input and excessive high-density meshes are rejected',()=>{
 assert.throws(()=>buildSculptTopology(new Float32Array(0)));
 assert.throws(()=>buildSculptTopology(new Float32Array([0,0,0,1,0,0,NaN,2,0])));
 const many=new Float32Array((MAX_SCULPT_VERTICES+1)*3);
 assert.throws(()=>buildSculptTopology(many),/limit/);
 const pts=new Float32Array([0,0,0,1,0,0,0,1,0]);
 const topology=buildSculptTopology(pts);
 assert.throws(()=>sculptStroke(pts,topology,{mode:'delete',center:[0,0,0]}));
 assert.throws(()=>sculptStroke(pts,topology,{mode:'inflate',center:[0,0,0],radius:-1}));
 assert.equal(MAX_HISTORY,12);
});