import {resolve4,resolve6,resolveTxt} from 'node:dns/promises';
import {connect} from 'node:tls';
import {isIP} from 'node:net';
export function allowedIp(ip){
 if(isIP(ip)===4){const a=ip.split('.').map(Number);return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===192&&a[1]===0||a[0]===198&&[18,19].includes(a[1])||a[0]===192&&a[1]===88||a[0]===198&&a[1]===51||a[0]===203&&a[1]===0&&a[2]===113)}
 if(isIP(ip)===6){const v=ip.toLowerCase();if(v.startsWith('::ffff:'))return false;const first=parseInt(v.split(':')[0]||'0',16);return !(v==='::'||v==='::1'||(first&0xfe00)===0xfc00||(first&0xffc0)===0xfe80||(first&0xff00)===0xff00||(first&0xffc0)===0x2001)}
 return false;
}
export async function monitor(domain,token,{dns4=resolve4,dns6=resolve6,txt=resolveTxt,dial=connect}={}){
 if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain))throw Error('Invalid domain');
 const proof=(await txt('_tekntandao-verify.'+domain)).map(v=>v.join(''));
 if(!proof.includes('tekntandao-verification='+token))throw Error('Ownership proof missing');
 const ips=[...(await dns4(domain).catch(()=>[])),...(await dns6(domain).catch(()=>[]))];
 if(!ips.length||ips.some(ip=>!allowedIp(ip)))throw Error('Unsafe DNS address');
 // Pin TCP/TLS to an already validated IP; no second DNS lookup or redirects.
 const ip=ips[0];
 return await new Promise((resolve,reject)=>{
  const socket=dial({host:ip,port:443,servername:domain,rejectUnauthorized:true,timeout:8000},()=>{
   socket.write('HEAD / HTTP/1.1\r\nHost: '+domain+'\r\nConnection: close\r\nUser-Agent: TeknTandao-Monitor/1.0\r\n\r\n');
  });
  let buffer='',settled=false;
  const fail=e=>{if(settled)return;settled=true;socket.destroy();reject(e)};
  socket.on('timeout',()=>fail(Error('Timeout')));
  socket.on('error',fail);
  socket.on('data',chunk=>{buffer+=chunk.toString('latin1');if(buffer.length>16384)return fail(Error('Response too large'));const p=buffer.indexOf('\r\n\r\n');if(p!==-1){settled=true;socket.destroy();const header=buffer.slice(0,p),first=header.split('\r\n')[0],status=Number((first.match(/^HTTP\/1\.[01] (\d{3})/)||[])[1]);resolve({reachable:true,httpStatus:status||null,hasHsts:/^strict-transport-security:/im.test(header),hasCsp:/^content-security-policy:/im.test(header),checkedAt:new Date().toISOString()})}});
  socket.on('end',()=>{if(!settled)fail(Error('Incomplete response'))});
 });
}
