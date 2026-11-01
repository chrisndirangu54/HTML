/* TeknTandao Web3 Studio: browser-only safety, read-only public-chain lookups.
 * No private keys, wallet connections, trading, deployed contracts or payments.
 */
(() => {
 'use strict';
 const byId=id=>document.getElementById(id);
 const status=msg=>{byId('w3-message').textContent=msg||'';};
 const safe=value=>String(value==null?'':value);
 const escapeHtml=value=>safe(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const external=(href,label)=>'<a href="'+escapeHtml(href)+'" rel="noopener noreferrer" target="_blank">'+escapeHtml(label)+'</a>';
 const download=(name,value)=>{const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
 const htmlList=items=>'<ul>'+items.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul>';
 const tabs=['explorer','security','developer','compliance','proofs','enterprise','academy','research'];
 const showTab=name=>{
  if(!tabs.includes(name))name='explorer';
  document.querySelectorAll('[data-w3-view]').forEach(el=>el.hidden=el.dataset.w3View!==name);
  document.querySelectorAll('[data-w3-tab]').forEach(el=>{
   const active=el.dataset.w3Tab===name;el.classList.toggle('active',active);
   if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
  });
  try { history.replaceState(null,'','#'+name); }catch(_){}
  status('');
 };
 document.querySelectorAll('[data-w3-tab]').forEach(button=>button.addEventListener('click',()=>showTab(button.dataset.w3Tab)));
 showTab(location.hash.replace('#',''));

 const networks={
  ethereum:{base:'https://eth.blockscout.com',native:'ETH',liveStats:true},
  base:{base:'https://base.blockscout.com',native:'ETH'},
  arbitrum:{base:'https://arbitrum.blockscout.com',native:'ETH'},
  polygon:{base:'https://polygonscan.com',native:'POL'},
  optimism:{base:'https://optimism.blockscout.com',native:'ETH'},
  bitcoin:{base:'https://mempool.space',native:'BTC',btc:true}
 };
 const validEvm=/^0x[a-fA-F0-9]{40}$/;
 const validTx=/^0x[a-fA-F0-9]{64}$/;
 const validBtc=/^(bc1[ac-hj-np-z02-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
 const validBtcTx=/^[a-fA-F0-9]{64}$/;
 const explorerPath=(network,type,value)=>{
  const net=networks[network];if(!net)return null;
  if(type==='transaction')return (net.btc?validBtcTx:validTx).test(value)?net.base+'/tx/'+encodeURIComponent(value):null;
  return (net.btc?validBtc:validEvm).test(value)?net.base+'/address/'+encodeURIComponent(value):null;
 };
 byId('w3-network').addEventListener('change',()=>{byId('w3-explorer-link').href=networks[byId('w3-network').value].base;});
 byId('w3-search-form').addEventListener('submit',async e=>{
  e.preventDefault();const network=byId('w3-network').value,type=byId('w3-type').value,value=byId('w3-identifier').value.trim();
  const url=explorerPath(network,type,value),output=byId('w3-lookup-result');
  if(!url){output.textContent='Invalid address or transaction identifier for the selected network. Check the network and try again.';return;}
  byId('w3-explorer-link').href=url;
  output.innerHTML='<p>Validated '+escapeHtml(type)+'. '+external(url,'Open verified public explorer record')+'</p><p>Loading public metadata where available…</p>';
  if(network!=='ethereum'){output.innerHTML='<p>Public '+escapeHtml(network)+' record: '+external(url,'Open explorer')+'</p><p>Integrated read-only API lookup is currently available for Ethereum only; other explorers open the public record directly.</p>';return;}
  const endpoint=networks.ethereum.base+'/api/v2/'+(type==='transaction'?'transactions/':'addresses/')+encodeURIComponent(value);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8500);
  try{
   const response=await fetch(endpoint,{signal:controller.signal,credentials:'omit',cache:'no-store'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const data=await response.json();
   const fields=type==='transaction'
    ?[['Status',data.status],['Block',data.block_number],['Confirmations',data.confirmations],['Gas used',data.gas_used],['Transaction fee (wei)',data.fee?.value||data.fee]]
    :[['Address type',data.is_contract?'Smart contract':'Externally owned / unknown'],['Contract verification',data.is_verified===true?'Verified':'Not confirmed'],['Native balance (wei)',data.coin_balance],['Transactions',data.transactions_count]];
   output.innerHTML='<h3>Ethereum public explorer result</h3><p>'+external(url,'View source record')+'</p>'+
    '<dl>'+fields.filter(([_,v])=>v!==undefined&&v!==null&&typeof v!=='object').map(([name,v])=>'<div><dt>'+escapeHtml(name)+'</dt><dd>'+escapeHtml(v)+'</dd></div>').join('')+'</dl>'+
    '<p class="tt-w3-small">Public explorer data, not an identity, ownership or risk certification. Verify at the source.</p>';
  }catch(err){output.innerHTML='<p>Live public API unavailable ('+escapeHtml(err.name==='AbortError'?'request timed out':'network or rate-limit restriction')+'). '+external(url,'Open the address or transaction in the explorer')+'. No values were fabricated.</p>';}
  finally{clearTimeout(timer);}
 });

 const gasStatus=byId('w3-gas-status');
 byId('w3-gas-refresh').addEventListener('click',async()=>{
  const button=byId('w3-gas-refresh');button.disabled=true;gasStatus.textContent='Requesting Ethereum gas data from Blockscout…';
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8500);
  try{
   const response=await fetch('https://eth.blockscout.com/api/v2/stats',{signal:ctrl.signal,credentials:'omit',cache:'no-store'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const body=await response.json(),prices=body.gas_prices||{};
   const entries=[['Slow',prices.slow],['Average',prices.average],['Fast',prices.fast]];
   const normalized=entries.map(([name,raw])=>[name,raw&&typeof raw==='object'?Number(raw.price):Number(raw)]).filter(([_,value])=>Number.isFinite(value)&&value>=0);
   if(!normalized.length)throw new Error('No live gas fields returned');
   byId('w3-gas-data').innerHTML=normalized.map(([name,value])=>'<div class="tt-w3-metric">'+escapeHtml(name)+'<strong>'+value.toLocaleString(undefined,{maximumFractionDigits:4})+' gwei</strong></div>').join('');
   const avg=normalized.find(([name])=>name==='Average')||normalized[0];
   byId('w3-gas-price').value=String(avg[1]);gasStatus.textContent='Ethereum only · Source: Blockscout public stats · Retrieved '+new Date().toLocaleString();
  }catch(err){gasStatus.textContent='Current gas information unavailable. You can enter a gas price manually or check the block explorer. No cached rate is presented as live.';byId('w3-gas-data').replaceChildren();}
  finally{clearTimeout(timer);button.disabled=false;}
 });
 byId('w3-gas-estimate').addEventListener('click',()=>{
  const units=Number(byId('w3-gas-units').value),gwei=Number(byId('w3-gas-price').value);
  byId('w3-gas-estimate-result').textContent=Number.isFinite(units)&&units>=21000&&units<=3000000&&
   Number.isFinite(gwei)&&gwei>0&&gwei<=100000
   ?'Estimated execution fee: '+(units*gwei/1e9).toFixed(9)+' ETH (network-only estimate; not guaranteed)'
   :'Enter valid gas units and a positive gwei value to calculate the indicative Ethereum execution fee.';
 });

 const rules=[
  {title:'Privileged ownership',severity:'Review',pattern:/\bonlyOwner\b|\bOwnable\b|owner\s*\(/i,why:'Owner controls can change system behavior; inspect privileges, key custody and multisig governance.'},
  {title:'Minting or supply controls',severity:'Review',pattern:/\b_mint\s*\(|\bmint\s*\(/i,why:'Verify who can mint, supply caps and disclosures.'},
  {title:'Proxy / delegate execution',severity:'High attention',pattern:/\bdelegatecall\b|\bUUPSUpgradeable\b|\bTransparentUpgradeableProxy\b/i,why:'Upgradeable execution can change rules after deployment. Verify authorized upgrade paths.'},
  {title:'Self-destruction',severity:'High attention',pattern:/\bselfdestruct\s*\(/i,why:'Destructive opcodes and behavior vary by EVM upgrade; investigate context carefully.'},
  {title:'Transaction-origin authorization',severity:'High attention',pattern:/\btx\.origin\b/i,why:'tx.origin checks can be unsafe for access control.'},
  {title:'Unchecked arithmetic',severity:'Review',pattern:/\bunchecked\s*\{/i,why:'Arithmetic within unchecked blocks must be justified and tested.'},
  {title:'Unbounded approvals',severity:'Review',pattern:/\btype\s*\(\s*uint256\s*\)\s*\.max\b|\bMAX_UINT\b/i,why:'Very high spending approvals require explicit user consent and review.'},
  {title:'Untrusted external calls',severity:'Review',pattern:/\.call\s*\{|\bcall\.value\b/i,why:'Review reentrancy protections, failure handling, access checks and trust boundaries.'},
  {title:'Time-dependent logic',severity:'Review',pattern:/\bblock\.timestamp\b|\bblock\.number\b/i,why:'Avoid treating miner/proposer-controllable timing as precise or unpredictable.'},
  {title:'Initialization functions',severity:'Review',pattern:/\binitializer\b|\binitialize\s*\(/i,why:'Check initializer access, once-only guards and implementation locking.'}
 ];
 let findings=null;
 byId('w3-analyze').addEventListener('click',()=>{
  const source=byId('w3-solidity').value.trim(),output=byId('w3-audit-result');
  if(!source||source.length>75000){output.textContent='Paste Solidity source (up to 75,000 characters) for a local pattern review.';return;}
  const matched=rules.filter(item=>item.pattern.test(source));
  findings={tool:'TeknTandao preliminary Solidity pattern review',date:new Date().toISOString(),
   matched:matched.map(({title,severity,why})=>({title,severity,why})),scope:'Local regex heuristics only; no compilation, dataflow, tests, deployment or audit'};
  output.innerHTML='<h3>Preliminary findings: '+matched.length+' pattern(s)</h3>'+
   (matched.length?matched.map(item=>'<div class="tt-w3-finding"><span class="tt-w3-risk '+(item.severity==='High attention'?'high':'')+'">'+escapeHtml(item.severity)+'</span><strong>'+escapeHtml(item.title)+'</strong><p>'+escapeHtml(item.why)+'</p></div>').join(''):'<p>No listed patterns matched. This does <strong>not</strong> establish that the contract is secure.</p>')+
   '<p>Recommended next step: compile and test with Foundry, analyze with Slither, commission independent review, and compare verified deployed bytecode.</p>';
  byId('w3-analyze-export').disabled=false;
 });
 byId('w3-analyze-export').addEventListener('click',()=>{if(findings)download('web3-source-triage.json',findings);});
 byId('w3-approval-link').addEventListener('click',()=>{
  const value=byId('w3-wallet-address').value.trim(),out=byId('w3-wallet-status');
  if(value&&!validEvm.test(value)){out.textContent='Enter a valid public 0x Ethereum-style address or leave it blank.';return;}
  out.textContent='Opening an external token-approval inspector. Review the correct network and independently validate the URL.';
  window.open('https://revoke.cash/','_blank','noopener,noreferrer');
 });

 const regulation={
  development:{reg:'Technical services may differ from regulated virtual-asset services. Classify actual custody, execution, transfer and advisory functions rather than the product name.',
   questions:['Does the business control customer assets or private keys?','Does it transmit orders, execute trades or make investment recommendations?','Does any integrated provider need a licence?']},
  exchange:{reg:'Exchange, brokerage and related market activities may fall under CMA-supervised categories, depending on how services are performed.',
   questions:['Is the business matching, brokering or executing customer trades?','Which CMA licensing category applies to each activity?','How will AML/CFT, custody separation and financial controls be implemented?']},
  custody:{reg:'Custody and wallet administration can require CBK-supervised authorization under the relevant VASP categories.',
   questions:['Who controls the private keys?','How are customer assets segregated and recovered?','What licensing and AML/CFT obligations apply?']},
  payment:{reg:'Virtual-asset payment processing and stablecoin issuance can involve CBK-supervised services and reserve requirements.',
   questions:['Is the business processing payments, issuing tokens or redeeming them?','How are reserves, redemption rights and fiat relationships structured?','Which CBK authorizations and payment rules are applicable?']},
  token:{reg:'Tokenization, investment-linked offerings and initial coin offerings can engage CMA-supervised activities and broader property/securities law.',
   questions:['Is a security, investment or financial interest being offered?','What off-chain title and beneficial ownership evidence exists?','What licensing, custody, offering and asset-transfer requirements apply?']},
  collectible:{reg:'A genuinely non-financial collectible may differ from a regulated virtual asset; its marketing and economic rights must be assessed, not only its NFT label.',
   questions:['Is any investment return, revenue share or redemption promoted?','Are user rights and IP licensing documented?','Does the product facilitate resale, investment or custody?']},
  advice:{reg:'Paid virtual-asset advisory or management may be regulated; the advice content, contractual discretion and client handling determine exposure.',
   questions:['Does the service give individual investment recommendations?','Does it exercise discretionary management or arrange trades?','Are specific CMA VASP licensing and conduct rules triggered?']}
 };
 byId('w3-reg-form').addEventListener('submit',event=>{
  event.preventDefault();const selected=byId('w3-reg-activity').value,result=regulation[selected];
  if(!result)return;
  byId('w3-reg-result').innerHTML='<h3>Potential regulatory considerations</h3><p>'+escapeHtml(result.reg)+'</p><h3>Questions before launch</h3>'+
   htmlList(result.questions.concat(['Check the currently published VASP Act, 2026 Regulations and notices directly with CBK/CMA.','Obtain qualified Kenyan legal advice before offering regulated services.']))+
   '<p>'+external('https://www.cma.or.ke/regulatory-framework/','CMA primary sources')+' · '+external('https://www.centralbank.go.ke/policy-procedures/legislation-and-guidelines/','CBK primary sources')+'</p><p class="tt-w3-small">This is informational triage, not a licensing decision.</p>';
 });

 let proof=null;
 const sha256=async input=>{
  const digest=await crypto.subtle.digest('SHA-256',input);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
 };
 byId('w3-proof-create').addEventListener('click',async()=>{
  const file=byId('w3-proof-file').files[0],text=byId('w3-proof-text').value;
  if(!file&&!text.trim()){byId('w3-proof-result').textContent='Choose a local file or enter text.';return;}
  if(file&&file.size>8*1024*1024){byId('w3-proof-result').textContent='Local file must be 8 MB or smaller.';return;}
  try{
   const raw=file?await file.arrayBuffer():new TextEncoder().encode(text).buffer;
   const hash=await sha256(raw);
   proof={version:1,algorithm:'SHA-256',digestHex:hash,sourceType:file?'file':'text',
    fileName:file?file.name:null,bytes:raw.byteLength,createdAt:new Date().toISOString(),
    caveat:'This hash is a local fingerprint; no identity or on-chain certification.'};
   byId('w3-proof-result').textContent='SHA-256: '+hash+'\nBytes: '+raw.byteLength+'\nLocal only: no upload or blockchain write.';
   byId('w3-proof-download').disabled=false;
  }catch(_){byId('w3-proof-result').textContent='Browser crypto is unavailable. Use this tool over HTTPS or localhost.';}
 });
 byId('w3-proof-download').addEventListener('click',()=>{if(proof)download('tekntandao-document-fingerprint.json',proof);});
 byId('w3-proof-verify').addEventListener('click',()=>{
  const expected=byId('w3-proof-compare').value.trim().toLowerCase(),result=byId('w3-proof-status');
  if(!proof){result.textContent='Generate a fingerprint first.';return;}
  if(!/^[a-f0-9]{64}$/.test(expected)){result.textContent='Enter a valid 64-character SHA-256 digest.';return;}
  result.textContent=expected===proof.digestHex?'Hash matches this browser-computed fingerprint; document claims remain unverified.':'Hash does not match; this content differs from the expected fingerprint.';
 });

 let scope=null;
 const business={
  credentials:['Define issuer identity, issuance/revocation policy and recipient verification','Prefer signed verifiable credentials or hashed proofs without publicly exposing learner data','Integrate credential issuance with an authorized LMS or registrar'],
  provenance:['Model custody transfers, assay evidence and dispute corrections','Store actual assay, geolocation and owner records off-chain under permissions','Use signed event logs and independently validated document hashes'],
  membership:['Define consent, entitlements, access expiry and transferability','Consider non-tradable membership credentials where trading is unnecessary','Implement QR verification, revocation and ticket check-in'],
  tokenization:['Verify asset ownership and registry evidence first','Obtain legal advice on securities, VASP and beneficial ownership','Model transfer restrictions, custody and investor disclosures before any token issuance'],
  payments:['Assess whether a conventional settlement rail solves the use case more safely','Verify CBK and other approvals for virtual-asset/payment services','Specify reversals, AML/CFT, provider risk, dispute handling and FX exposure']
 };
 byId('w3-business-form').addEventListener('submit',event=>{
  event.preventDefault();
  const kind=byId('w3-case').value,records=Number(byId('w3-volume').value),systems=byId('w3-systems').value,
   privacy=byId('w3-privacy').value,goal=byId('w3-goal').value.trim();
  if(!business[kind]||!Number.isSafeInteger(records)||records<1||records>100000000){
   byId('w3-business-result').textContent='Enter a valid project case and monthly record count.';return;
  }
  const stage=records>1000000||systems==='multiple'?'Large-scale architecture discovery required':
   records>10000||systems!=='none'?'Moderate integration and operations discovery':'Initial proof-of-concept scoping';
  const choices=business[kind];
  scope={version:1,createdAt:new Date().toISOString(),useCase:kind,monthlyRecords:records,
   externalSystems:systems,confidentiality:privacy,goal,stage,
   recommendedChecks:choices,requirements:['User roles and custody','Data minimization','Digital signature verification',
    'Audit logging and incident response','Integration contracts','Test and disaster recovery','Applicable Kenyan law'],
   indicativePrice:null,deadline:null,transactionExecuted:false};
  byId('w3-business-result').innerHTML='<h3>Suggested project scope</h3><p><strong>Assessment:</strong> '+escapeHtml(stage)+'</p><h3>Recommended activities</h3>'+
   htmlList(choices)+'<p><strong>Expected monthly records:</strong> '+records.toLocaleString()+'</p>'+
   '<p>Final quote requires requirements validation, system architecture, legal analysis and agreed delivery scope.</p>';
  byId('w3-enterprise-export').disabled=false;
 });
 byId('w3-enterprise-export').addEventListener('click',()=>{if(scope)download('tekntandao-web3-project-scope.json',scope);});

 const lessons={
  wallet:{text:'A wallet address is public. A private key or recovery phrase authorizes actions and must never be pasted into websites, chats or support tickets.',
   question:'Which information is appropriate to paste into a public explorer?',
   answers:['A public wallet address','A seed phrase','A hardware wallet recovery code'],correct:0},
  approval:{text:'Approvals can let a smart contract transfer approved assets. Disconnecting a website does not revoke those on-chain allowances.',
   question:'What can reduce an obsolete token approval?',answers:['Disconnecting the website only','Revoking the allowance in a trusted tool','Sharing your private key with support'],correct:1},
  contracts:{text:'Verified Solidity source helps review functionality, but does not prove security. Testing, static analysis, deployed-bytecode comparison and independent review remain important.',
   question:'Does an automated regex scan prove a contract is safe?',answers:['Yes, if no pattern matches','No, it is only preliminary triage','Only on Ethereum'],correct:1},
  regulation:{text:'In Kenya the legal treatment depends on the actual service provided and the applicable regulator, not whether a business calls itself Web3.',
   question:'What should a Kenyan blockchain startup check before operating?',answers:['Only its token name','Official CBK/CMA regulatory requirements','The number of followers'],correct:1},
  provenance:{text:'A cryptographic fingerprint demonstrates that content has not changed relative to a digest. It does not prove that the claim is truthful or legally registered.',
   question:'Does a document hash by itself prove land ownership?',answers:['Yes','Only with a JPEG attachment','No, authoritative title verification is separate'],correct:2}
 };
 let passed=new Set();
 try{const data=JSON.parse(localStorage.getItem('tt-web3-lessons-v1')||'[]');if(Array.isArray(data))passed=new Set(data.filter(x=>Object.hasOwn(lessons,x)));}catch(_){}
 const renderLesson=()=>{
  const item=lessons[byId('w3-lesson').value];
  byId('w3-lesson-text').textContent=item.text;
  byId('w3-lesson-options').replaceChildren();
  item.answers.forEach((text,i)=>{
   const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='w3-answer';input.value=String(i);
   label.appendChild(input);label.appendChild(document.createTextNode(text));byId('w3-lesson-options').appendChild(label);
  });
  byId('w3-lesson-feedback').textContent='';
  byId('w3-academy-progress').textContent='Completed lessons in this browser: '+passed.size+'/'+Object.keys(lessons).length;
 };
 byId('w3-lesson').addEventListener('change',renderLesson);
 byId('w3-lesson-grade').addEventListener('click',()=>{
  const item=lessons[byId('w3-lesson').value],selected=document.querySelector('input[name="w3-answer"]:checked');
  if(!selected){byId('w3-lesson-feedback').textContent='Choose an answer first.';return;}
  if(Number(selected.value)===item.correct){
   passed.add(byId('w3-lesson').value);
   try{localStorage.setItem('tt-web3-lessons-v1',JSON.stringify([...passed]));}catch(_){}
   byId('w3-lesson-feedback').textContent='Correct. '+item.text;
  }else{byId('w3-lesson-feedback').textContent='Review the explanation, then try again.';}
  byId('w3-academy-progress').textContent='Completed lessons in this browser: '+passed.size+'/'+Object.keys(lessons).length;
 });
 renderLesson();

 const knowledge=[
  {terms:['wallet','seed','private','key','mnemonic','recovery'],answer:'A public wallet address can be inspected on a blockchain explorer. Private keys and recovery phrases must stay secret and offline. Do not connect a wallet to a site you have not verified.',link:'https://ethereum.org/en/wallets/',label:'Ethereum wallet guide'},
  {terms:['approval','revoke','allowance','spender'],answer:'An ERC-20 allowance can authorize spending by a contract. Check allowances on an independent permission inspector and revoke obsolete approvals if appropriate. Disconnecting a dApp is not a revocation.',link:'https://revoke.cash/learn/approvals/how-to-revoke-token-approvals',label:'Revoke.cash approval guide'},
  {terms:['audit','solidity','contract','security','slither'],answer:'Use compiler warnings, tests, Slither and independent audit for smart-contract security. A source scan is only a preliminary review; it cannot certify safety.',link:'https://github.com/crytic/slither',label:'Slither source analyzer'},
  {terms:['kenya','regulation','vasp','cbk','cma','license','licence'],answer:'Kenyan VASP obligations depend on the actual activity, potentially involving CBK or CMA. Check the published Act and 2026 Regulations and obtain qualified advice before offering regulated services.',link:'https://www.cma.or.ke/regulatory-framework/',label:'CMA regulatory framework'},
  {terms:['certificate','credential','hash','provenance','mineral','land','supply'],answer:'A SHA-256 digest can detect alteration of a document, but proving identity, document issuance, legal title or chain of custody requires independent authoritative evidence and signatures.',link:'https://www.w3.org/TR/vc-data-model-2.0/',label:'W3C verifiable credentials'},
  {terms:['nft','membership','erc721','token'],answer:'Non-fungible tokens may be useful for digital memberships or media licences, but tokens do not automatically grant intellectual property, property title or investment rights.',link:'https://docs.openzeppelin.com/contracts/5.x/erc721',label:'ERC-721 documentation'},
  {terms:['gas','fees','gwei','ethereum','transaction'],answer:'Ethereum execution fees depend on gas consumed and the current network price in gwei. L2 fees and application fees can differ. Confirm current quotes using a chain explorer.',link:'https://eth.blockscout.com/',label:'Ethereum explorer'},
  {terms:['scam','phish','airdrop','fraud'],answer:'Reject unexpected seed-phrase requests, pressure tactics and wallet-signature prompts from unknown sites. Confirm the official domain independently and inspect permissions before approving anything.',link:'https://revoke.cash/',label:'Wallet permission safety'}
 ];
 byId('w3-assistant-ask').addEventListener('click',()=>{
  const input=byId('w3-assistant-query').value.toLowerCase().slice(0,900),output=byId('w3-assistant-response');
  if(!input.trim()){output.textContent='Ask a Web3 question without including any secrets.';return;}
  const scored=knowledge.map(item=>({...item,score:item.terms.filter(term=>input.includes(term)).length})).sort((a,b)=>b.score-a.score);
  if(!scored[0].score){output.innerHTML='I do not have a verified local explanation for this question. '+external('https://ethereum.org/en/developers/','Start with Ethereum developer documentation')+'. For a tailored analysis, use the TeknTandao consultation link.';return;}
  output.innerHTML='<strong>Reviewed knowledge-base answer (not generative AI):</strong><p>'+escapeHtml(scored[0].answer)+'</p>'+external(scored[0].link,'Source: '+scored[0].label);
 });
})();
