export function issueCodes(observation){
 if(!observation?.reachable)return ['unreachable'];
 const alerts=[];
 if(Number(observation.httpStatus)>=500)alerts.push('http_server_error');
 if(!observation.hasHsts)alerts.push('hsts_missing');
 if(!observation.hasCsp)alerts.push('csp_missing');
 return alerts;
}
export function newIssueCodes(before,after){
 const previous=new Set(before?issueCodes(before):[]);
 return issueCodes(after).filter(x=>!previous.has(x));
}
