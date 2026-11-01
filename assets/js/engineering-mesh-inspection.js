/* Lightweight preflight diagnostics. Mesh coordinate units and repairs require independent confirmation. */
export function inspectTriangleGeometry(positions,indices=null,maxTriangles=50000){
 if(!positions||positions.length<9||positions.length%3!==0)throw Error('Invalid triangle position buffer');
 const count=indices?indices.length/3:positions.length/9;
 if(!Number.isInteger(count)||count<=0)throw Error('No triangle faces to inspect');
 const inspected=Math.min(count,Math.max(1,Math.min(maxTriangles,50000)));
 const edgeUse=new Map();
 const key=point=>point.map(x=>Math.round(x*10000)/10000).join(',');
 const edge=(a,b)=>{
  const k=a<b?a+'|'+b:b+'|'+a;
  edgeUse.set(k,(edgeUse.get(k)||0)+1);
 };
 let degenerate=0,invalid=0;
 for(let i=0;i<inspected;i++){
  const pts=[];
  for(let v=0;v<3;v++){
   const vertex=indices?indices[i*3+v]:(i*3+v),j=vertex*3;
   pts.push([positions[j],positions[j+1],positions[j+2]]);
  }
  if(pts.some(p=>p.some(v=>!Number.isFinite(v)))){invalid++;continue;}
  const [a,b,c]=pts;
  const u=b.map((v,i)=>v-a[i]),w=c.map((v,i)=>v-a[i]);
  const cross=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
  if(cross.reduce((sum,v)=>sum+v*v,0)<1e-16){degenerate++;continue;}
  const names=pts.map(key);
  edge(names[0],names[1]);edge(names[1],names[2]);edge(names[2],names[0]);
 }
 let boundaryEdges=0,nonManifoldEdges=0;
 for(const uses of edgeUse.values()){
  if(uses===1)boundaryEdges++;
  if(uses>2)nonManifoldEdges++;
 }
 return {triangleCount:count,inspectedTriangles:inspected,
  partial:inspected<count,degenerateTriangles:degenerate,invalidVertices:invalid,
  approximateBoundaryEdges:boundaryEdges,approximateNonManifoldEdges:nonManifoldEdges,
  potentiallyClosed:inspected===count&&!invalid&&!degenerate&&!boundaryEdges&&!nonManifoldEdges,
  limitation:'Heuristic only; approximate vertex welding, disconnected shells and unknown units. Not a watertightness, tolerance or fabrication certification.'};
}
