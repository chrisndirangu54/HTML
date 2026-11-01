/* Pure, dependency-free concept-design preflight and revision schema.
 * Advisory only: NOT CAM, FEA, certification, material validation or factory capacity.
 * No geometry, personal data or model prompts transmitted or stored by this module.
 */
export const REVISION_SCHEMA='tekntandao.engineering.plate.v1';
export const MAX_REVISIONS=12;
const fields=['length','width','thickness','hole','offset'];
const materials=['PLA','PETG','ABS','Aluminium','Steel','Acrylic','PCB-FR4','Other'];
const processes=['3d-printing','cnc-milling','laser-cutting','pcb-assembly','other'];
const mechanical=['aluminum','steel','abs','petg'];
const finite=(x,label,min,max)=>{
 const n=typeof x==='number'?x:Number(x);
 if(x===null||x===undefined||x===''||!Number.isFinite(n)||n<min||n>max)
  throw new RangeError(label+' must be between '+min+' and '+max);
 return n;
};
export function normalizePlate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Plate dimensions required');
 const g={
  length:finite(input.length,'Length',20,1000),
  width:finite(input.width,'Width',20,1000),
  thickness:finite(input.thickness,'Thickness',.5,100),
  hole:finite(input.hole,'Hole diameter',1,50),
  offset:finite(input.offset,'Hole center offset',2,100)
 };
 if(g.offset<=g.hole/2||g.offset>=Math.min(g.length,g.width)/2||
   g.hole>=Math.min(g.length,g.width)/2||
   g.length-2*g.offset<=g.hole||g.width-2*g.offset<=g.hole)
  throw new RangeError('Hole geometry intersects edges or adjacent holes');
 return g;
}
export function normalizeScenario(input){
 if(!input||typeof input!=='object')throw new TypeError('Design scenario required');
 const geometry=normalizePlate(input.geometry||input);
 const process=String(input.process||'other'),material=String(input.material||'Other');
 const modelMaterial=String(input.modelMaterial||'aluminum');
 if(!processes.includes(process)||!materials.includes(material)||!mechanical.includes(modelMaterial))
  throw new RangeError('Unsupported material, process or illustrative simulator material');
 const forceN=finite(input.forceN??0,'Tip load N',0,5000);
 return {geometry,process,material,modelMaterial,forceN};
}
const finding=(id,severity,title,detail)=>({id,severity,title,detail});
export function assessDesign(input){
 const scenario=normalizeScenario(input),g=scenario.geometry;
 const nearEdge=Number((g.offset-g.hole/2).toFixed(5));
 const spacingX=Number((g.length-2*g.offset-g.hole).toFixed(5));
 const spacingY=Number((g.width-2*g.offset-g.hole).toFixed(5));
 const volumeMm3=g.length*g.width*g.thickness-Math.PI*g.hole*g.hole*g.thickness;
 const findings=[];
 const add=(...args)=>findings.push(finding(...args));
 if(nearEdge<g.hole/2)
  add('edge-ligament','review','Narrow hole-to-edge ligament','The remaining material from the circular hole to the nearest external edge is '+nearEdge+' mm, less than half the hole diameter. Check fastening loads, edge break-out, tooling and the manufacturing drawing.');
 else add('edge-ligament','info','Hole-to-edge material remains','Computed edge ligament: '+nearEdge+' mm. This geometry calculation is not a strength or process clearance approval.');
 const bridge=Math.min(spacingX,spacingY);
 if(bridge<g.hole)
  add('hole-spacing','review','Limited space between neighboring holes','The shortest clear spacing between circular holes is '+bridge+' mm, smaller than one hole diameter. Check bolt access, load paths and machining operations.');
 else add('hole-spacing','info','Hole spacing measured','Minimum clear distance between neighboring hole perimeters is '+bridge+' mm.');
 if(scenario.process==='cnc-milling'){
  if(g.thickness/g.hole>6)
   add('drill-aspect','review','Deep through-hole machining','Thickness / diameter is '+(g.thickness/g.hole).toFixed(2)+':1. Check drill reach, chip evacuation, process setup and supplier capability.');
  add('cnc-finish','review','CNC finishing and drawing requirements','Specify fits, hole diameter tolerance, deburring, edge breaks, surface finish, datum scheme and suitable clamping. This model has no GD&T or toolpaths.');
 }
 if(scenario.process==='laser-cutting'){
  add('laser-kerf','review','Laser-cut feature accuracy unverified','Confirm machine kerf compensation, cut-edge quality, minimum feature size and actual material/thickness capabilities; this preview is not a cutting path.');
 }
 if(scenario.process==='3d-printing'){
  add('print-parameters','review','Build orientation and print properties unknown','Check overhangs, layer direction, infill, support strategy, hole shrinkage, wall thickness and temperature; a bulk-property beam estimate does not represent printed anisotropy.');
 }
 if(scenario.process==='pcb-assembly'){
  add('pcb-design','review','Mechanical plate is not a PCB layout','The parametric plate does not include copper layers, nets, drill classes, component placement, Gerbers or assembly files; provide an electrical CAD project for PCB fabrication.');
 }
 if(scenario.process==='other')
  add('process-unspecified','review','Manufacturing route not selected','Select a manufacturing process and confirm material stock, tolerances, inspection and supplier feasibility.');
 if(['PLA','PETG','ABS'].includes(scenario.material)&&scenario.process==='cnc-milling')
  add('polymer-machining','review','Machining polymer stock','Check availability of suitable polymer stock, fixturing and heat-induced distortion. 3D printer properties cannot be substituted for machining data.');
 if(['Aluminium','Steel'].includes(scenario.material)&&scenario.process==='3d-printing')
  add('metal-am','review','Metal additive manufacturing requires specialist review','Metal printing differs substantially from desktop polymer printing; confirm process, feedstock, supports, post-processing and qualification requirements.');
 if(['PCB-FR4'].includes(scenario.material)&&scenario.process==='3d-printing')
  add('fr4-print','review','FR4 is not a typical printable filament','Verify feedstock and manufacturing method with a PCB or composite specialist.');
 if(scenario.forceN>0){
  add('load-model','review','Nominal load screening is not structural approval','The selected '+scenario.modelMaterial+' simulation uses an idealized cantilever and illustrative properties; hole stress concentrations, fixation, fatigue and actual material data require assessment.');
 }else{
  add('load-missing','review','No mechanical load case supplied','A zero-load preview cannot establish strength or service suitability. Specify operating loads and boundary conditions before review.');
 }
 add('tolerancing','review','Inspectability and fit are not verified','Provide functional tolerances, datum references, part units in millimetres, fastener specification, mating-part fits and quality inspection plan.');
 return {
  schema:'tekntandao.engineering.preflight.v1',
  status:'human-review-required',
  scenario,
  geometry:{edgeLigamentMm:nearEdge,holeSpacingXMm:spacingX,holeSpacingYMm:spacingY,clearanceMinMm:Math.min(spacingX,spacingY),solidVolumeMm3:volumeMm3,holeCount:4},
  findings,
  limitations:['Geometry only: no manufacturing toolpath, machine availability or price.',
   'No certified FEM, material allowables, load-path validation, dimensional metrology or regulatory sign-off.',
   'AI-generated meshes, uploaded designs and parametric designs require separate inspection.'],
  approvedForManufacture:false,
  standardReferences:[
   {title:'NIST additive manufacturing part qualification',url:'https://www.nist.gov/programs-projects/additive-manufacturing-part-qualification'},
   {title:'Autodesk: Designing for Manufacture',url:'https://www.autodesk.com/autodesk-university/article/Designing-Manufacture-Keeping-Production-Team-Happy-2020'}
  ]
 };
}
export function makeRevision(scenario,{id,createdAt}={}){
 const normalized=normalizeScenario(scenario);
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(id))throw new RangeError('Invalid revision identifier');
 const stamp=createdAt||new Date().toISOString();
 if(typeof stamp!=='string'||!Number.isFinite(Date.parse(stamp))||stamp.length>50)
  throw new RangeError('Invalid revision time');
 return {schema:REVISION_SCHEMA,id,createdAt:stamp,scenario:normalized};
}
export function validateArchive(candidate){
 const value=typeof candidate==='string'?JSON.parse(candidate):candidate;
 if(!value||value.schema!==REVISION_SCHEMA||!Array.isArray(value.revisions)||value.revisions.length>MAX_REVISIONS)
  throw new TypeError('Unsupported design revision archive');
 const ids=new Set();
 const revisions=value.revisions.map(item=>{
  if(!item||item.schema!==REVISION_SCHEMA)throw new TypeError('Invalid revision entry');
  const revision=makeRevision(item.scenario,{id:item.id,createdAt:item.createdAt});
  if(ids.has(revision.id))throw new TypeError('Revision identifiers must be unique');
  ids.add(revision.id);return revision;
 });
 return {schema:REVISION_SCHEMA,revisions};
}
export function compareRevisions(base,target){
 const before=normalizeScenario(base.scenario||base),after=normalizeScenario(target.scenario||target);
 const keys=[...fields,'forceN'];
 const changes=[];
 for(const key of keys){
  const b=key==='forceN'?before.forceN:before.geometry[key],a=key==='forceN'?after.forceN:after.geometry[key];
  if(a!==b)changes.push({field:key,from:b,to:a,delta:a-b,unit:key==='forceN'?'N':'mm'});
 }
 for(const key of ['process','material','modelMaterial']){
  if(before[key]!==after[key])changes.push({field:key,from:before[key],to:after[key],delta:null,unit:null});
 }
 const volume=g=>g.length*g.width*g.thickness-Math.PI*g.hole*g.hole*g.thickness;
 const volumeDeltaMm3=volume(after.geometry)-volume(before.geometry);
 return {changes,volumeDeltaMm3,percentVolumeDelta:volume(before.geometry)?100*volumeDeltaMm3/volume(before.geometry):null,
  limitation:'Volume comparison uses the idealized four-hole plate, not a verified CAD solid or toolpath.'};
}
export function evidencePackage(scenario,{revisionId=null,createdAt}={}){
 const report=assessDesign(scenario);
 return {schema:'tekntandao.engineering.evidence.v1',createdAt:createdAt||new Date().toISOString(),
  revisionId,units:'mm / N / mm^3',method:'deterministic preliminary geometry and DFM screening',
  preflight:report,generatedBy:'TeknTandao local engineering dashboard',automatedApproval:false};
}