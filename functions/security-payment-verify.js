// Pure validation helpers for verified Paystack monitoring payments.
export const MONITORING_PRICE_KSH=2500;
export function validMonitoringCharge(data,reference,customerEmail){
 if(!data||data.status!=='success'||data.reference!==reference)return false;
 if(data.currency!=='KES'||Number(data.amount)!==MONITORING_PRICE_KSH*100)return false;
 if(data.metadata?.purpose!=='security_monitoring')return false;
 if(customerEmail&&String(data.customer?.email||'').toLowerCase()!==String(customerEmail).toLowerCase())return false;
 return true;
}
export async function verifyMonitoringPayment(reference,secret,{http=fetch}={}){
 if(!/^MON-[A-Za-z0-9_-]{8,120}$/.test(reference))throw Error('Invalid Paystack reference');
 const reply=await http('https://api.paystack.co/transaction/verify/'+encodeURIComponent(reference),{headers:{Authorization:'Bearer '+secret,Accept:'application/json'},signal:AbortSignal.timeout(10000)});
 const payload=await reply.json();
 if(!reply.ok||payload.status!==true||!payload.data)throw Error('Transaction verification failed');
 return payload.data;
}
