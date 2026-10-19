import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareFindings} from './consensus.mjs';
test('correlates independent observers and ignores finding managers in agreement count',()=>{
 const a=compareFindings([{engine:'strix',asset:'repo/a',ruleId:'CWE-79',location:'src/a.js:1',severity:'high',confidence:.7},{engine:'shannon',asset:'repo/a',ruleId:'CWE-79',location:'src/a.js:1',severity:'medium'},{engine:'defectdojo',asset:'repo/a',ruleId:'CWE-79',location:'src/a.js:1',severity:'high'}],{assessmentId:'one',tenantId:'tenant'});
 assert.equal(a.findings[0].independentObservers,2);
 assert.equal(a.findings[0].status,'corroborated-unvalidated');
 assert.equal(a.disagreementCount,1);
});
test('managers cannot validate findings; evidence required',()=>{
 const a=compareFindings([{engine:'faraday',asset:'web/test',ruleId:'X',validated:true}],{assessmentId:'two',tenantId:'tenant'});
 assert.equal(a.findings[0].status,'requires-review');
});
test('rejects missing tenant context',()=>assert.throws(()=>compareFindings([])));
