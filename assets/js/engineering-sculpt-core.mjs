/* Pure mesh editing algorithms; locally applied, no network or browser dependency.
 * Inspired by established open-source sculpt workflows, without copying their code.
 * Source and compiled assets stay under the existing site's distribution policy.
 */
export const MAX_SCULPT_VERTICES=150000;
export const MAX_HISTORY=12;
const modes=new Set(['inflate','deflate','smooth','flatten','grab']);
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const pointKey=(a,b,c)=>[a,b,c].map(v=>Math.round(v*1e5)).join(',');
const distance2=(a,b)=>{const x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return x*x+y*y+z*z;};
const normalise=v=>{const d=Math.hypot(...v);return d>1e-10?v.map(x=>x/d):[0,0,1];};

/** Build topological neighbors with positional welding for STL's duplicate triangle vertices. */
export function buildSculptTopology(positions,index=null){
 if(!positions||positions.length<9||positions.length%3!==0)throw new Error('A triangle mesh is required.');
 const count=positions.length/3;
 if(count>MAX_SCULPT_VERTICES)throw new Error('Mesh exceeds interactive sculpt vertex limit (150,000). Simplify externally first.');
 const lookup=new Map(),groups=[],groupOf=new Int32Array(count);
 for(let i=0;i<count;i++){
  const v=[Number(positions[i*3]),Number(positions[i*3+1]),Number(positions[i*3+2])];
  if(!finite3(v))throw new Error('Model contains invalid coordinates.');
  const key=pointKey(...v);let g=lookup.get(key);
  if(g===undefined){g=groups.length;lookup.set(key,g);groups.push({members:[],neighbors:new Set()});}
  groups[g].members.push(i);groupOf[i]=g;
 }
 const len=index?index.length:count;
 if(len%3!==0)throw new Error('Triangle indices are invalid.');
 for(let i=0;i<len;i+=3){
  const v=[0,1,2].map(j=>index?Number(index[i+j]):i+j);
  if(v.some(k=>!Number.isSafeInteger(k)||k<0||k>=count))throw new Error('Invalid triangle index.');
  const gs=v.map(k=>groupOf[k]);
  for(const [a,b] of [[0,1],[1,2],[2,0]]){
   if(gs[a]!==gs[b]){groups[gs[a]].neighbors.add(gs[b]);groups[gs[b]].neighbors.add(gs[a]);}
  }
 }
 return {groups:groups.map(g=>({members:g.members,neighbors:[...g.neighbors]})),vertexCount:count};
}

/** Apply a soft weighted stroke in local mesh coordinates. Mutates typed array only. */
export function sculptStroke(positions,topology,params){
 const {mode='inflate',center,normal=[0,0,1],radius=1,strength=.4,symmetryX=false,
  direction=[0,0,0]}=params||{};
 if(!modes.has(mode))throw new Error('Unsupported sculpt tool.');
 if(!finite3(center)||!finite3(normal)||!finite3(direction)||
    !Number.isFinite(radius)||radius<=0||!Number.isFinite(strength)||strength<0||strength>1)
   throw new Error('Invalid brush coordinates or settings.');
 if(positions.length/3!==topology.vertexCount)throw new Error('Mesh topology changed; rebuild before sculpting.');
 const unit=normalise(normal),centers=[{center,normal:unit,direction}];
 if(symmetryX&&Math.abs(center[0])>1e-6)
  centers.push({center:[-center[0],center[1],center[2]],
    normal:[-unit[0],unit[1],unit[2]],direction:[-direction[0],direction[1],direction[2]]});
 const source=topology.groups.map(g=>{
  const j=g.members[0]*3;return [positions[j],positions[j+1],positions[j+2]];
 });
 const destinations=source.map(v=>v.slice()),r2=radius*radius;
 let affected=0;
 for(let i=0;i<source.length;i++){
  const p=source[i],next=destinations[i];
  let touched=false;
  for(const brush of centers){
   const d2=distance2(p,brush.center);
   if(d2>=r2)continue;
   const t=Math.sqrt(d2)/radius;
   const falloff=(1-t*t)**2;
   const power=strength*falloff;
   if(power<1e-6)continue;
   let change;
   if(mode==='smooth'){
    const neighbors=topology.groups[i].neighbors;
    if(!neighbors.length)continue;
    const mean=[0,0,0];
    for(const n of neighbors)for(let k=0;k<3;k++)mean[k]+=source[n][k]/neighbors.length;
    change=mean.map((v,k)=>(v-p[k])*power*.45);
   }else if(mode==='flatten'){
    const offset=(p[0]-brush.center[0])*brush.normal[0]+
      (p[1]-brush.center[1])*brush.normal[1]+(p[2]-brush.center[2])*brush.normal[2];
    change=brush.normal.map(v=>-v*offset*power*.45);
   }else if(mode==='grab'){
    change=brush.direction.map(v=>v*power);
   }else{
    const sign=mode==='inflate'?1:-1;
    change=brush.normal.map(v=>v*radius*power*.16*sign);
   }
   if(change.some(v=>Math.abs(v)>1e-12)){touched=true;for(let k=0;k<3;k++)next[k]+=change[k];}
  }
  if(touched)affected++;
 }
 if(!affected)return {affected:0,groups:topology.groups.length};
 for(let i=0;i<topology.groups.length;i++){
  const values=destinations[i];
  for(const vertex of topology.groups[i].members)
   for(let k=0;k<3;k++)positions[vertex*3+k]=values[k];
 }
 return {affected,groups:topology.groups.length};
}
