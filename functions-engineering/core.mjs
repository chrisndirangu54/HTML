// Engineering service public, deterministic policy. No secrets or DB calls.
export const FREE_CREDITS=3;
export const AI_COST=1;
export const PACKAGES=Object.freeze({
  starter:Object.freeze({credits:10,amountKes:250}),
  maker:Object.freeze({credits:50,amountKes:1000})
});
export const MAX_FILE_BYTES=15*1024*1024;
export const ALLOWED_TYPES=Object.freeze({
  stl:'model/stl',obj:'text/plain',step:'application/octet-stream',stp:'application/octet-stream',
  scad:'text/plain',dxf:'application/dxf',3mf:'application/octet-stream',
  glb:'model/gltf-binary',pdf:'application/pdf'
});
export const trim=(v,n=200)=>String(v??'').trim().slice(0,n);
export const validEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||''));
export function validateDesign(raw){
  const d=raw||{},kind=trim(d.kind,20);
  if(!['generated','upload'].includes(kind))throw Error('Choose generated or uploaded design.');
  const title=trim(d.title,100);
  if(title.length<3)throw Error('Design title must have at least three characters.');
  const process=trim(d.process,25),material=trim(d.material,30);
  if(!['3d-printing','cnc-milling','laser-cutting','pcb-assembly','other'].includes(process))throw Error('Choose a valid manufacturing process.');
  if(!['PLA','PETG','ABS','Aluminium','Steel','Acrylic','PCB-FR4','Other'].includes(material))throw Error('Choose a listed material.');
  const quantity=Number(d.quantity);
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1000)throw Error('Quantity must be from 1 to 1000.');
  const notes=trim(d.notes,1800),contactEmail=trim(d.contactEmail,254).toLowerCase();
  if(!validEmail(contactEmail))throw Error('A valid contact email is required.');
  const spec={kind,title,process,material,quantity,notes,contactEmail,deliveryLocation:trim(d.deliveryLocation,160)};
  if(kind==='generated'){
    const x=d.dimensions||{},nums={};
    for(const k of ['length','width','thickness','hole','offset']){
      const n=Number(x[k]);
      if(!Number.isFinite(n))throw Error('Invalid plate dimension: '+k);
      nums[k]=n;
    }
    const {length,width,thickness,hole,offset}=nums;
    if(length<20||length>1000||width<20||width>1000||
      thickness<.5||thickness>100||hole<1||hole>50||offset<2||offset>100||
      offset<=hole/2||offset>=Math.min(length,width)/2||
      hole>=Math.min(length,width)/2||length-2*offset<=hole||width-2*offset<=hole)
      throw Error('Generated plate dimensions or mounting-hole positions are invalid.');
    spec.dimensions=nums;
  }
  return spec;
}
export function validateUploadMeta(path,uid,projectId,obj){
  const ext=trim(obj?.ext,10).toLowerCase();
  if(!path||path!=='engineeringFiles/'+uid+'/'+projectId+'/design.'+ext)throw Error('File must be in the customer project storage path.');
  if(!Object.hasOwn(ALLOWED_TYPES,ext))throw Error('File format is not allowed.');
  const size=Number(obj?.size);
  if(!Number.isSafeInteger(size)||size<=0||size>MAX_FILE_BYTES)throw Error('File exceeds the 15 MB cap.');
  return {path,ext,size,scanStatus:'unscanned_requires_operator_review'};
}
export function verifyPaidPurchase(order,provider){
  if(!order||!provider||provider.status!=='success'||provider.currency!=='KES')return false;
  return Number(provider.amount)===Number(order.amountKes)*100 &&
    String(provider.reference)===String(order.reference) &&
    order.status==='awaiting_payment';
}
export function allowAIQuestion(q){
  const s=trim(q,1800);
  if(s.length<12||s.length>1800)throw Error('Describe your engineering question in at least 12 characters.');
  return s;
}
