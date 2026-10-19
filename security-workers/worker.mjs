// Safe, offline worker proof-of-boundary. It cannot scan or invoke security tools.
import process from 'node:process';
if (process.env.SCAN_EXECUTION_ENABLED !== 'false') {
  console.error('Refusing execution: scanner integrations are not configured.');
  process.exit(78);
}
console.log(JSON.stringify({service:'tekntandao-security-worker',status:'disabled',message:'No scanner job execution implemented'}));
