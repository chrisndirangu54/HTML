/**
 * Configuration and deterministic analysis for the HTML ISP management app.
 * No network management, payment capture, remote commands or secrets.
 */
const text = (label, required = true, max = 120) => ({label, type:'text', required, max});
const number = (label, required = true, min = 0, max = 10000000) => ({label, type:'number', required, min, max});
const pick = (label, values, required = true) => ({label, type:'select', values, required});
const note = (label, required = false) => ({label, type:'textarea', required, max:1500});
const statuses = (initial, transitions = {}) => ({initial, transitions});

export const ispModules = Object.freeze({
  sites: {title:'Sites & coverage', icon:'map-pin', collection:'htmlIspSites',
    description:'Geographic PoPs, properties, cabinets and optical distribution points.',
    fields:{name:text('Site name'),type:pick('Site type',['pop','estate','apartment','cabinet','tower','splitter','building']),area:text('Estate / area'),latitude:number('Latitude',false,-90,90),longitude:number('Longitude',false,-180,180),notes:note('Survey and access notes')},
    workflow:statuses('planned',{planned:['surveyed'],surveyed:['approved','planned'],approved:['installed'],installed:['retired']})},
  devices: {title:'Device fleet',icon:'router',collection:'htmlIspDevices',
    description:'Equipment inventory, revision, firmware, PoE and management prerequisites.',
    fields:{label:text('Asset label'),vendor:text('Vendor'),model:text('Model'),site:text('Site'),role:pick('Role',['core','fiber','wireless','other']),serial:text('Serial number',false),hardwareRevision:text('Hardware revision',false),firmware:text('Firmware version',false),management:pick('Supported management',['unknown','snmp','rest','ssh','tr069','omci','controller','multiple']),poe:pick('PoE input',['not_applicable','passive_24v','802.3af','802.3at','802.3bt','unknown']),portMbps:number('Fastest wired port (Mbps)',false,1,100000),notes:note('MIB, compatibility and warranty notes')},
    workflow:statuses('planned',{planned:['testing','installed'],testing:['validated','planned'],validated:['installed'],installed:['maintenance','retired'],maintenance:['installed','retired']})},
  links:{title:'Fiber & wireless links',icon:'network',collection:'htmlIspLinks',
    description:'Document the physical backhaul topology, routes and link testing.',
    fields:{label:text('Link ID / name'),site:text('Site'),from:text('Source node'),to:text('Destination node'),medium:pick('Media',['gpon','ethernet_fiber','ptp_wireless','ethernet']),segment:text('Shared segment / PON ID'),capacityMbps:number('Design capacity Mbps',true,1,100000),distanceM:number('Design path length (m)',false,0,300000),vlan:text('VLAN or isolated customer profile',false),notes:note('RF LOS, losses, testing, PoE and cable details')},
    workflow:statuses('planned',{planned:['surveyed'],surveyed:['tested','planned'],tested:['approved'],approved:['installed'],installed:['maintenance','retired'],maintenance:['installed','retired']})},
  subscribers:{title:'Subscriber CRM',icon:'users',collection:'htmlIspSubscribers',
    description:'Subscriber accounts are planned records; no PPPoE or payment activation occurs.',
    fields:{accountCode:text('Unique subscriber code'),site:text('Site'),accessType:pick('Access type',['fiber','wireless']),planMbps:number('Plan speed (Mbps)',true,1,10000),planCode:text('Plan code',false),deviceId:text('Assigned device ID',false),notes:note('Installation, permission and consent notes')},
    workflow:statuses('planned',{planned:['installation_scheduled'],installation_scheduled:['installed_unprovisioned','planned'],installed_unprovisioned:['review_required'],review_required:['installed_unprovisioned']})},
  plans:{title:'Subscription packages',icon:'layers',collection:'htmlIspPlans',
    description:'Build packages and pricing without changing router bandwidth policies.',
    fields:{code:text('Package code'),name:text('Package name'),speedMbps:number('Advertised Mbps',true,1,10000),monthlyKes:number('Monthly KSh',true,0,500000),fairUsePolicy:note('Fair-use, contention and transparent terms'),notes:note('Support, renewal and commercial terms')},
    workflow:statuses('draft',{draft:['ready'],ready:['archived'],archived:[]})},
  telemetry:{title:'Telemetry & QoE',icon:'activity',collection:'htmlIspTelemetry',
    description:'Manual field samples until signed device collectors are connected.',
    fields:{deviceId:text('Registered device ID'),site:text('Site'),segment:text('PON / link segment',false),latencyMs:number('Latency (ms)',true,0,60000),jitterMs:number('Jitter (ms)',true,0,60000),packetLossPct:number('Packet loss (%)',true,0,100),utilizationPct:number('Link utilization (%)',true,0,100),rxOpticalDbm:number('Optical receive dBm',false,-45,10),wirelessRssiDbm:number('Wireless signal dBm',false,-120,0),notes:note('Method, time and technician observations')},
    workflow:null},
  incidents:{title:'Incidents & outage response',icon:'alert-triangle',collection:'htmlIspIncidents',
    description:'Fault management and human-reviewed incident transitions.',
    fields:{title:text('Incident title'),site:text('Affected site'),segment:text('Related PON / segment',false),severity:pick('Severity',['low','medium','high','critical']),description:note('Observed symptoms and confirmed evidence')},
    workflow:statuses('open',{open:['acknowledged','resolved'],acknowledged:['resolved'],resolved:[]})},
  workOrders:{title:'Technician work orders',icon:'wrench',collection:'htmlIspWorkOrders',
    description:'Assign field remediation, record installation and handover notes.',
    fields:{title:text('Work order title'),site:text('Site'),priority:pick('Priority',['low','normal','urgent']),assignedTo:text('Technician label / ID',false),description:note('Tasks and acceptance criteria')},
    workflow:statuses('open',{open:['in_progress','completed'],in_progress:['completed'],completed:[]})},
  support:{title:'Customer support desk',icon:'headphones',collection:'htmlIspSupportTickets',
    description:'Triage connectivity, speed, billing and installation requests.',
    fields:{subscriberCode:text('Subscriber code'),site:text('Site'),channel:pick('Channel',['phone','email','whatsapp','walk_in','portal']),message:note('Customer request',true),notes:note('Agent handoff and resolution notes')},
    workflow:statuses('open',{open:['triaged','resolved'],triaged:['resolved'],resolved:[]})},
  invoices:{title:'Invoice preparation',icon:'receipt',collection:'htmlIspInvoices',
    description:'Draft bills with no payment settlement or automatic renewals.',
    fields:{invoiceCode:text('Unique invoice code'),subscriberCode:text('Subscriber account code'),description:text('Invoice description'),amountKes:number('Amount KSh',true,1,10000000),dueDate:text('Due date YYYY-MM-DD',false),notes:note('Billing and accounting notes')},
    workflow:statuses('draft',{draft:['issued','void'],issued:['void'],void:[]})},
  payments:{title:'Payment reconciliation queue',icon:'credit-card',collection:'htmlIspPaymentReviews',
    description:'Record unverified external references; never mark STK initiation as money received.',
    fields:{invoiceCode:text('Related invoice code'),subscriberCode:text('Subscriber code'),provider:pick('Payment provider',['mpesa','paystack','bank','manual']),reference:text('External reference'),amountKes:number('Claimed amount KSh',true,1,10000000),notes:note('Supporting evidence and verification notes')},
    workflow:statuses('unverified',{unverified:['under_review','rejected'],under_review:['rejected'],rejected:[]})},
  provisioning:{title:'Provisioning approvals',icon:'shield-check',collection:'htmlIspProvisioningRequests',
    description:'Approval ledger for PPPoE, RADIUS, OLT and ACS; NEVER executes commands.',
    fields:{subscriberCode:text('Subscriber account code'),deviceId:text('Device ID'),adapter:pick('Target system',['routeros','radius','omci','genieacs']),operation:pick('Intended operation',['activate','suspend','change_plan','deactivate','update_wifi']),justification:note('Why is access requested?',true)},
    workflow:statuses('requested',{requested:['approved_for_manual_review','cancelled'],approved_for_manual_review:['cancelled'],cancelled:[]})},
  firmware:{title:'Firmware and change control',icon:'hard-drive',collection:'htmlIspFirmwareRequests',
    description:'Track validated firmware plans, revision constraints, maintenance and rollback tests.',
    fields:{deviceId:text('Device ID'),currentVersion:text('Current firmware version'),targetVersion:text('Requested firmware version'),maintenanceWindow:text('Planned maintenance window'),rollbackPlan:note('Recovery / rollback instructions',true),notes:note('Checksums, vendor signatures and compatibility')},
    workflow:statuses('requested',{requested:['approved_for_manual_review','cancelled'],approved_for_manual_review:['cancelled'],cancelled:[]})},
  notifications:{title:'Customer notifications',icon:'message-circle',collection:'htmlIspNotificationDrafts',
    description:'Consent-based message templates for outage, renewal and appointment updates; drafts only.',
    fields:{title:text('Campaign / notice name'),audience:pick('Audience',['all','fiber','wireless','affected_segment','individual']),channel:pick('Channel',['whatsapp','sms','email','in_app']),message:note('Draft message',true),notes:note('Consent basis, affected segment and delivery policy')},
    workflow:statuses('draft',{draft:['reviewed','archived'],reviewed:['archived'],archived:[]})},
  procurement:{title:'Equipment sourcing & compliance',icon:'clipboard-list',collection:'htmlIspProcurement',
    description:'Track supplier pricing, device interfaces, Kenyan approval and field acceptance.',
    fields:{vendor:text('Vendor'),model:text('Model'),type:pick('Device type',['ont','cpe','router','ap','bridge','olt','switch','ups']),unitKes:number('Quoted unit price KSh',true,0,10000000),quantity:number('Quantity',true,1,10000),management:pick('Management',['snmp','api','ssh','tr069','omci','controller','unverified']),gigabit:pick('Wired ports',['gigabit','fast_ethernet','multi_gigabit','unknown']),approval:pick('Kenya CA approval',['unverified','approved','rejected']),notes:note('MIB, PoE, revision, firmware and supporting quotation')},
    workflow:statuses('research',{research:['shortlisted'],shortlisted:['tested','rejected'],tested:['accepted','rejected'],accepted:[],rejected:[]})},
  policies:{title:'Security, VLAN & QoS proposals',icon:'lock',collection:'htmlIspPolicyRequests',
    description:'Document isolation, RADIUS, captive portal, queues and firewall rule proposals.',
    fields:{title:text('Policy / request'),scope:pick('Control',['vlan_isolation','radius','captive_portal','qos','firewall','poe','backup','security']),site:text('Site'),vlanId:number('VLAN ID',false,1,4094),description:note('Proposed policy, risks and evidence',true),rollbackPlan:note('Rollback and change control')},
    workflow:statuses('draft',{draft:['reviewed','cancelled'],reviewed:['approved_for_manual_review','cancelled'],approved_for_manual_review:['cancelled'],cancelled:[]})},
  outreach:{title:'Coverage & sales opportunities',icon:'map',collection:'htmlIspOpportunities',
    description:'Estate and apartment expansion planning with site survey follow-up.',
    fields:{site:text('Estate / building'),area:text('Town / neighborhood'),estimatedHomes:number('Potential homes',true,1,100000),estimatedTakeUpPct:number('Expected take-up %',true,0,100),approach:pick('Access method',['ftth','wireless_backhaul','mixed','resale']),notes:note('Rights of way, permissions, costs and competing ISPs')},
    workflow:statuses('identified',{identified:['surveying','rejected'],surveying:['proposal','rejected'],proposal:['approved','rejected'],approved:[],rejected:[]})}
});

export const integrationCatalog = Object.freeze([
 {id:'mikrotik',label:'MikroTik RouterOS',capabilities:'REST/API, SNMP, PPPoE queues; approved automation only',status:'not_connected'},
 {id:'vsol',label:'VSOL GPON / OMCI',capabilities:'OLT alarms, PON topology and supported ONT optical levels',status:'not_connected'},
 {id:'comfast',label:'COMFAST access network',capabilities:'RF link, AP and controller telemetry require firmware verification',status:'not_verified'},
 {id:'genieacs',label:'GenieACS CWMP/TR-069',capabilities:'Compatible ONT/CPE provisioning and Wi-Fi diagnostic parameters',status:'not_connected'},
 {id:'radius',label:'FreeRADIUS',capabilities:'Subscriber AAA, session accounting, planned rate policies',status:'not_connected'},
 {id:'mpesa',label:'Safaricom Daraja',capabilities:'Verified STK/C2B outcomes and append-only settlement ledger',status:'not_connected'},
 {id:'whatsapp',label:'WhatsApp Business Platform',capabilities:'Consent, approved template notifications, agent handoff',status:'not_connected'},
 {id:'monitoring',label:'Zabbix/Prometheus/Grafana',capabilities:'SNMP v3, syslog, active probes, historical metrics',status:'not_connected'},
 {id:'predictive_ai',label:'Predictive AI models',capabilities:'Fault prediction, churn risk and load forecasting after validation',status:'not_trained'},
]);

export function normalizeRecord(moduleName, payload) {
 const spec = ispModules[moduleName];
 if (!Object.hasOwn(ispModules,moduleName)) throw new Error('Unknown ISP module');
 if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid record');
 const fields = spec.fields;
 if (Object.keys(payload).some(k=>!Object.hasOwn(fields,k))) throw new Error('Unexpected record field');
 const result={};
 for (const [key,rule] of Object.entries(fields)) {
   const input=payload[key];
   if (input === undefined || input === null || input === '') {
     if (rule.required) throw new Error('Missing '+key);
     continue;
   }
   if (rule.type === 'number') {
     if (typeof input !== 'number' || !Number.isFinite(input) || input < rule.min || input > rule.max) throw new Error('Invalid '+key);
     result[key]=input;
   } else if (rule.type === 'select') {
     if (typeof input !== 'string' || !rule.values.includes(input)) throw new Error('Invalid '+key);
     result[key]=input;
   } else {
     if (typeof input !== 'string' || input.trim().length < (rule.required?1:0) || input.trim().length>rule.max) throw new Error('Invalid '+key);
     result[key]=input.trim();
   }
 }
 if (moduleName === 'subscribers') {
   result.accountCode=result.accountCode.toUpperCase();
   if (!/^[A-Z0-9_-]{2,64}$/.test(result.accountCode)) throw new Error('Invalid subscriber code');
 }
 if (moduleName === 'invoices' && !/^[A-Za-z0-9_-]{2,64}$/.test(result.invoiceCode)) throw new Error('Invalid invoice code');
 if (moduleName === 'sites' && (Object.hasOwn(result,'latitude') !== Object.hasOwn(result,'longitude'))) throw new Error('Latitude and longitude must be supplied together');
 if (moduleName === 'payments' && !/^[A-Za-z0-9_-]{3,120}$/.test(result.reference)) throw new Error('Invalid reference');
 if (moduleName === 'telemetry') {
   result.source='manual_admin';
   result.health=assessLink(result);
 }
 if (moduleName === 'support') result.triage=triageSupport(result.message);
 return result;
}
export function transitionAllowed(moduleName, from, to) {
 const spec=ispModules[moduleName];
 return !!spec?.workflow && (spec.workflow.transitions[from]||[]).includes(to);
}
export function assessLink({latencyMs,jitterMs,packetLossPct,utilizationPct}) {
 if (![latencyMs,jitterMs,packetLossPct,utilizationPct].every(Number.isFinite)) return 'insufficient_data';
 if (packetLossPct>=5 || (latencyMs>=150 && jitterMs>=45)) return 'critical';
 if (packetLossPct>=1 || latencyMs>=100 || jitterMs>=30 || utilizationPct>=85) return 'warning';
 return 'healthy';
}
export function correlateOutages(samples) {
 const grouped=new Map();
 for (const x of samples) {
   if (assessLink(x)!=='critical' || !x.segment) continue;
   const key=x.segment;
   const record=grouped.get(key) || {segment:key,devices:new Set()};
   record.devices.add(x.deviceId);
   grouped.set(key,record);
 }
 return [...grouped.values()].filter(x=>x.devices.size>=3)
   .map(x=>({segment:x.segment,affectedDevices:x.devices.size,classification:'possible_shared_fault',humanReview:true}));
}
export function capacityHeuristic(samples) {
 const valid=samples.map(x=>x.utilizationPct).filter(x=>typeof x==='number'&&x>=0&&x<=100);
 if(valid.length<5)return {state:'insufficient_data',hint:'Collect five or more comparable measurements.'};
 const latest=valid.slice(-5),avg=x=>x.reduce((a,b)=>a+b,0)/x.length;
 const current=avg(latest),baseline=avg(valid.slice(-30));
 const estimate=Math.max(0,Math.min(100,2*current-baseline));
 return {state:estimate>=85?'capacity_review':'monitor',estimateUtilizationPct:Math.round(estimate*10)/10,hint:'Heuristic only, not a trained predictive model.'};
}
export function triageSupport(message='') {
 const m=message.toLowerCase();
 const rules=[['billing',/mpesa|m-pesa|paid|payment|bill|renew|invoice/],['outage',/down|no internet|offline|los|disconnected|red light/],['performance',/slow|lag|speed|packet|jitter|latency|buffer/],['installation',/install|move|relocat|setup|coverage/]];
 return {category:rules.find(([,pattern])=>pattern.test(m))?.[0] || 'general',humanReview:true};
}
export function customerRisk({outages=0,tickets=0}={}) {
 const score=Math.min(100,Math.max(0,Number(outages)||0)*15+Math.max(0,Number(tickets)||0)*20);
 return {score,band:score>=60?'high':score>=30?'medium':'low',trained:false};
}
