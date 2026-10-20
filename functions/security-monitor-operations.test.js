import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issueCodes,newIssueCodes} from './security-monitor-alerts.js';
import {validMonitoringCharge} from './security-payment-verify.js';
test('only new issues trigger notifications',()=>{const a={reachable:true,httpStatus:200,hasHsts:false,hasCsp:true};const b={...a,hasCsp:false};assert.deepEqual(newIssueCodes(a,b),['csp_missing']);assert.deepEqual(newIssueCodes(b,b),[])});
test('down endpoint raises alert',()=>assert.deepEqual(issueCodes({reachable:false}),['unreachable']));
test('verified payment requires correct purpose, amount, currency, reference, customer',()=>{const reference='MON-abc12345678',data={status:'success',reference,currency:'KES',amount:250000,metadata:{purpose:'security_monitoring'},customer:{email:'tester@example.com'}};assert.equal(validMonitoringCharge(data,reference,'tester@example.com'),true);assert.equal(validMonitoringCharge({...data,amount:250001},reference,'tester@example.com'),false);assert.equal(validMonitoringCharge({...data,status:'failed'},reference,'tester@example.com'),false);assert.equal(validMonitoringCharge(data,reference,'other@example.com'),false)});
