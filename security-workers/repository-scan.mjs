// Run ONLY in a hardened, network-restricted worker against a locally staged,
// explicitly authorized repository. This adapter never clones arbitrary URLs.
import {spawn} from 'node:child_process';
import {realpath,stat,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const scanners={
 semgrep:{bin:'semgrep',args:['scan','--config','auto','--json','--quiet','.']},
 trivy:{bin:'trivy',args:['fs','--scanners','vuln,misconfig','--format','json','.']},
 gitleaks:{bin:'gitleaks',args:['detect','--source','.','--report-format','json','--report-path','/dev/stdout','--no-git']},
 checkov:{bin:'checkov',args:['-d','.','-o','json','--quiet']}
};
export async function scanLocalRepository(root,{enabled=false,approved=false,paid=false,verified=false}={}){
 if(!enabled||!approved||!paid||!verified)throw Error('Verified scope, payment and operator approval required');
 const dir=await realpath(resolve(root)),info=await stat(dir);
 if(!info.isDirectory()||dir==='/'||dir===process.cwd())throw Error('Invalid staging directory');
 const findings=[];
 for(const [name,s] of Object.entries(scanners)){
  const output=await new Promise(resolveResult=>{
   let stdout='',stderr='',timedOut=false,exceeded=false;
   const child=spawn(s.bin,s.args,{cwd:dir,env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:'/tmp'},shell:false,stdio:['ignore','pipe','pipe']});
   const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},120000);
   child.stdout.on('data',b=>{stdout+=b.toString();if(stdout.length>10000000){exceeded=true;child.kill('SIGKILL')}});
   child.stderr.on('data',b=>{stderr+=b.toString().slice(0,1000)});
   child.on('error',e=>{clearTimeout(timer);resolveResult({scanner:name,error:e.message})});
   child.on('close',code=>{clearTimeout(timer);let data=null;try{data=JSON.parse(stdout)}catch{}resolveResult({scanner:name,code,timedOut,exceeded,results:data,error:data?null:stderr.slice(0,300)})});
  });
  findings.push(output);
 }
 return {scannedAt:new Date().toISOString(),scanners:findings};
}
if(process.argv[1]?.endsWith('repository-scan.mjs')){
 const path=process.argv[2],approved=process.env.SECURITY_SCAN_APPROVED==='true',paid=process.env.SECURITY_SCAN_PAID==='true',verified=process.env.SECURITY_SCOPE_VERIFIED==='true';
 scanLocalRepository(path,{enabled:process.env.SECURITY_REPO_SCANNING_ENABLED==='true',approved,paid,verified}).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1});
}
