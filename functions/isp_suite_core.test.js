import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {ispModules,integrationCatalog,normalizeRecord,transitionAllowed,
 assessLink,correlateOutages,capacityHeuristic,triageSupport,customerRisk} from './isp_suite_core.js';

test('all required ISP workflow modules exist',()=>{
 for(const id of ['sites','devices','links','subscribers','plans','telemetry','incidents','workOrders',
  'support','invoices','payments','provisioning','firmware','notifications','procurement','policies','outreach']){
  assert.ok(ispModules[id],id);
  assert.ok(ispModules[id].collection.startsWith('htmlIsp'));
 }
});
test('rejects additional fields, bad roles and extreme values',()=>{
 assert.throws(()=>normalizeRecord('devices',{label:'X',vendor:'V',model:'M',site:'A',role:'core',management:'unknown',poe:'unknown',sneaky:true}),/Unexpected/);
 assert.throws(()=>normalizeRecord('telemetry',{deviceId:'a',site:'b',latencyMs:3,jitterMs:4,packetLossPct:101,utilizationPct:20}),/Invalid packetLossPct/);
});
test('subscriber codes are normalized and no accidental production activation',()=>{
 const row=normalizeRecord('subscribers',{accountCode:' ken-42 ',site:'Nairobi',accessType:'fiber',planMbps:20});
 assert.equal(row.accountCode,'KEN-42');
 assert.equal(ispModules.subscribers.workflow.initial,'planned');
 assert.equal(transitionAllowed('subscribers','planned','active'),false);
});
test('M-Pesa review and invoicing cannot be marked paid',()=>{
 assert.equal(transitionAllowed('invoices','issued','paid'),false);
 assert.equal(transitionAllowed('payments','under_review','verified'),false);
 const payment=normalizeRecord('payments',{invoiceCode:'INV9',subscriberCode:'K12',provider:'mpesa',reference:'Q123456',amountKes:2000});
 assert.equal(payment.reference,'Q123456');
});
test('provisioning and firmware approvals do not have execute transitions',()=>{
 assert.equal(transitionAllowed('provisioning','requested','approved_for_manual_review'),true);
 assert.equal(transitionAllowed('provisioning','approved_for_manual_review','executed'),false);
 assert.equal(transitionAllowed('firmware','requested','deployed'),false);
});
test('quality rules label packet loss, latency and missing samples',()=>{
 const sample={latencyMs:15,jitterMs:1,packetLossPct:0,utilizationPct:32};
 assert.equal(assessLink(sample),'healthy');
 assert.equal(assessLink({...sample,packetLossPct:1.2}),'warning');
 assert.equal(assessLink({...sample,packetLossPct:5.1}),'critical');
 assert.equal(assessLink({packetLossPct:3}),'insufficient_data');
});
test('shared fault requires at least 3 distinct critical devices',()=>{
 const normal={latencyMs:12,jitterMs:4,packetLossPct:7,utilizationPct:20,segment:'PON1'};
 const bad=[{...normal,deviceId:'A'},{...normal,deviceId:'B'},{...normal,deviceId:'C'}];
 assert.equal(correlateOutages(bad)[0].affectedDevices,3);
 assert.equal(correlateOutages([bad[0],bad[0],bad[1]]).length,0);
});
test('capacity heuristics never claim validated prediction',()=>{
 assert.equal(capacityHeuristic([{utilizationPct:25}]).state,'insufficient_data');
 assert.equal(capacityHeuristic(Array.from({length:8},()=>({utilizationPct:98}))).state,'capacity_review');
});
test('support triage and recovery scoring are bounded',()=>{
 assert.equal(triageSupport('M-Pesa has not renewed my package').category,'billing');
 assert.equal(triageSupport('red light LOS').category,'outage');
 assert.equal(triageSupport('unclassified text').humanReview,true);
 assert.equal(customerRisk({outages:120,tickets:9}).score,100);
});
test('vendor integrations cannot be represented as connected',()=>{
 assert.ok(integrationCatalog.every(x=>x.status!=='connected'));
 assert.ok(integrationCatalog.some(x=>x.id==='genieacs'));
});
test('the suite module does not open Firestore while it is imported',()=>{
 const source=fs.readFileSync(new URL('./isp_suite.js',import.meta.url),'utf8');
 const header=source.split('async function identify')[0];
 assert.equal(header.includes('db.collection('),false);
 assert.equal(header.includes('getFirestore()'),true);
});
