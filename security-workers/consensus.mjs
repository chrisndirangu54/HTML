// Correlates normalized, sanitized findings from independently authorized engines.
// This code DOES NOT execute scanners, connect to targets, or transfer private code.
const validSeverities=['critical','high','medium','low','info','unknown'];
const aiEngines=new Set(['pentagi','hexstrike','strix','shannon']);
const orchestrators=new Set(['securecodebox']);
const managers=new Set(['defectdojo','faraday']);
const weights={critical:5,high:4,medium:3,low:2,info:1,unknown:0};
const str=(v,n=300)=>String(v??'').slice(0,n);
function normalize(input){
 if(!input||typeof input!=='object')throw Error('Invalid finding');
 const engine=str(input.engine,40).toLowerCase();
 if(![...aiEngines,...orchestrators,...managers,'nmap','nuclei','trivy','semgrep','gitleaks','checkov','zap'].includes(engine))throw Error('Unknown engine');
 const asset=str(input.asset,256),rule=str(input.ruleId||input.cve||input.cwe||input.title,160).toLowerCase(),location=str(input.location||'',300);
 if(!asset||!rule)throw Error('Asset and rule required');
 const severity=str(input.severity,16).toLowerCase();
 const confidence=Number(input.confidence);
 return {engine,asset,ruleId:rule,location,title:str(input.title,200),severity:validSeverities.includes(severity)?severity:'unknown',confidence:Number.isFinite(confidence)?Math.min(1,Math.max(0,confidence)):0.5,validated:input.validated===true, evidenceRef:str(input.evidenceRef,250),sourceRunId:str(input.sourceRunId,100)};
}
export function compareFindings(raw,{assessmentId,tenantId}={}){
 if(!assessmentId||!tenantId)throw Error('Assessment and tenant context required');
 if(!Array.isArray(raw)||raw.length>10000)throw Error('Invalid findings');
 const groups=new Map();
 for(const entry of raw){const f=normalize(entry),key=JSON.stringify([f.asset,f.ruleId,f.location]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f)}
 const results=[...groups.values()].map(rows=>{
  const engines=[...new Set(rows.map(r=>r.engine))];
  // Finding-management imports cannot count as independent validation of original observations.
  const observers=[...new Set(rows.filter(r=>!managers.has(r.engine)&&!orchestrators.has(r.engine)).map(r=>r.engine))];
  const severity=rows.reduce((a,b)=>weights[b.severity]>weights[a]?b.severity:a,'unknown');
  const validated=rows.some(r=>!managers.has(r.engine)&&!orchestrators.has(r.engine)&&r.validated&&!!r.evidenceRef);
  const confidence=Math.round(100*Math.max(...rows.map(r=>r.confidence)));
  const status=validated?'evidence-validated':observers.length>=2?'corroborated-unvalidated':'requires-review';
  return {asset:rows[0].asset,ruleId:rows[0].ruleId,location:rows[0].location,title:rows.find(x=>x.title)?.title||rows[0].ruleId,severity,confidence,engines,independentObservers:observers.length,status,evidenceRefs:[...new Set(rows.map(r=>r.evidenceRef).filter(Boolean))],findingCount:rows.length};
 });
 results.sort((a,b)=>weights[b.severity]-weights[a.severity]||b.independentObservers-a.independentObservers);
 return {assessmentId,tenantId,findings:results,totalInputs:raw.length,disagreementCount:results.filter(x=>new Set(raw.filter(r=>String(r.asset)===x.asset&&String(r.ruleId||r.cve||r.cwe||r.title).toLowerCase()===x.ruleId).map(r=>r.severity)).size>1).length,policy:'Agent consensus informs prioritization; human review and evidence are required before confirmed claims.'};
}
