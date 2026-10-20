// Policy evaluation only. This module never executes a security scanner.
export const POLICY={dailyPassiveIntervalHours:24,repoEventDebounceMinutes:30,deepAssessmentIntervalDays:30,maxDeepAssessmentsPerPeriod:1};
export function classifyJob(job,subscription,asset,now=Date.now()){
 if(!subscription||subscription.status!=='active'||subscription.currentPeriodEnd?.toMillis?.()<=now)return {allowed:false,reason:'inactive_subscription'};
 if(!asset||asset.uid!==subscription.uid||asset.status!=='verified')return {allowed:false,reason:'unverified_asset'};
 if(subscription.customerPaused||subscription.monitoringExecutionEnabled!==true)return {allowed:false,reason:'monitoring_disabled'};
 if(job.type==='passive')return {allowed:job.scope==='https_headers',reason:job.scope==='https_headers'?'daily_passive':'unsupported_scope'};
 if(job.type==='repository'){
  if(job.event!=='push'||!job.repositoryId||!job.commitSha||!(/^[0-9a-f]{40}$/.test(job.commitSha)))return {allowed:false,reason:'invalid_repo_event'};
  if(job.githubInstallationVerified!==true||job.repositoryExplicitlySelected!==true||job.readOnly===false)return {allowed:false,reason:'repository_not_authorized'};
  return {allowed:true,reason:'authorized_repository_change',tools:['semgrep','trivy','gitleaks','checkov']};
 }
 if(job.type==='deep'){
  if(job.explicitScopedAuthorization!==true||job.operatorApproved!==true||job.scopeExpiresAt<=now||job.executedThisPeriod>=POLICY.maxDeepAssessmentsPerPeriod)return {allowed:false,reason:'deep_scan_approval_required'};
  return {allowed:true,reason:'approved_deep_assessment',agents:['pentagi','hexstrike','strix','shannon'],findingSystems:['defectdojo','faraday'],orchestrator:'securecodebox'};
 }
 return {allowed:false,reason:'unknown_job_type'};
}
