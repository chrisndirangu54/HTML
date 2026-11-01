import test from 'node:test';
import assert from 'node:assert/strict';
import {FREE_CREDITS,AI_COST,PACKAGES,MAX_FILE_BYTES,ALLOWED_TYPES,validEmail,validateDesign,
 validateUploadMeta,verifyPaidPurchase,allowAIQuestion} from '../core.mjs';
const generated={kind:'generated',title:'Four-hole bracket',process:'cnc-milling',material:'Aluminium',
 quantity:2,contactEmail:'buyer@example.com',deliveryLocation:'Nairobi',
 dimensions:{length:100,width:60,thickness:6,hole:5,offset:8}};
test('starter credits and initial credit plans are fixed server-side',()=>{
 assert.equal(FREE_CREDITS,3);assert.equal(AI_COST,1);
 assert.deepEqual(PACKAGES.starter,{credits:10,amountKes:250});
 assert.deepEqual(PACKAGES.maker,{credits:50,amountKes:1000});
 assert.equal(MAX_FILE_BYTES,15*1024*1024);
});
test('fabrication form validates generated CAD instead of trusting browser output',()=>{
 const x=validateDesign(generated);assert.equal(x.dimensions.offset,8);
 assert.equal(x.quantity,2);assert.equal(x.kind,'generated');
 assert.throws(()=>validateDesign({...generated,dimensions:{...generated.dimensions,offset:50}}));
 assert.throws(()=>validateDesign({...generated,dimensions:{...generated.dimensions,hole:40}}));
 assert.throws(()=>validateDesign({...generated,quantity:-1}));
 assert.throws(()=>validateDesign({...generated,process:'danger'}));
 assert.throws(()=>validateDesign({...generated,material:'unknown'}));
 assert.throws(()=>validateDesign({...generated,contactEmail:'invalid'}));
 assert.equal(validEmail('buyer@example.com'),true);
 assert.equal(validEmail('something@nope'),false);
});
test('file upload approval requires private exact project path and size limit',()=>{
 const uid='customer123',pid='SomeProject1234567890';
 const file=validateUploadMeta('engineeringFiles/'+uid+'/'+pid+'/design.stl',uid,pid,{ext:'stl',size:10000});
 assert.equal(file.scanStatus,'unscanned_requires_operator_review');
 assert.throws(()=>validateUploadMeta('engineeringFiles/stranger/'+pid+'/design.stl',uid,pid,{ext:'stl',size:10000}));
 assert.throws(()=>validateUploadMeta('engineeringFiles/'+uid+'/'+pid+'/design.exe',uid,pid,{ext:'exe',size:1000}));
 assert.throws(()=>validateUploadMeta('engineeringFiles/'+uid+'/'+pid+'/design.stl',uid,pid,{ext:'stl',size:MAX_FILE_BYTES+1}));
 assert.ok(ALLOWED_TYPES.step);
});
test('provider payment verification requires exact reference, currency, amount and success',()=>{
 const order={reference:'eng_abc',amountKes:250,status:'awaiting_payment'};
 const paid={reference:'eng_abc',amount:25000,currency:'KES',status:'success'};
 assert.equal(verifyPaidPurchase(order,paid),true);
 assert.equal(verifyPaidPurchase(order,{...paid,amount:20000}),false);
 assert.equal(verifyPaidPurchase(order,{...paid,currency:'NGN'}),false);
 assert.equal(verifyPaidPurchase(order,{...paid,reference:'other'}),false);
 assert.equal(verifyPaidPurchase(order,{...paid,status:'pending'}),false);
 assert.equal(verifyPaidPurchase({...order,status:'paid'},paid),false);
});
test('AI input cannot send empty prompts',()=>{
 assert.throws(()=>allowAIQuestion('hi'));
 assert.equal(allowAIQuestion('Create a 100 mm mounting plate'),'Create a 100 mm mounting plate');
});
