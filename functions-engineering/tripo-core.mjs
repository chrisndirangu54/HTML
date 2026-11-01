export const TRIPO_COST=10,TRIPO_MODEL='v3.1-20260211',MAX_IMAGE=4*1024*1024,MAX_GLB=15*1024*1024;
export function taskId(x){const id=String(x||'');if(!/^[a-zA-Z0-9_-]{12,80}$/.test(id))throw Error('Invalid task identifier');return id;}
export function modelPrompt(x){const s=String(x||'').trim();if(s.length<8||s.length>1024)throw Error('Describe the model in 8–1024 characters');return s;}
export function imageBytes(data,mime){
 if(typeof data!=='string'||data.length>Math.ceil(MAX_IMAGE*4/3)+8||!/^[a-zA-Z0-9+/]+={0,2}$/.test(data))throw Error('Invalid image');
 const bytes=Buffer.from(data,'base64'),png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(bytes.length<100||bytes.length>MAX_IMAGE||!((png&&mime==='image/png')||(jpeg&&mime==='image/jpeg')))throw Error('Use PNG/JPEG up to 4MB');
 return {bytes,mime,ext:png?'png':'jpg'};
}
export function safeUrl(input){const url=new URL(String(input||''));if(url.protocol!=='https:'||url.username||url.password||!/(^|\.)tripo3d\.(ai|com)$/.test(url.hostname))throw Error('Untrusted GLB URL');return url.href;}
