import {randomUUID} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore, FieldValue} from 'firebase-admin/firestore';
import {onRequest} from 'firebase-functions/v2/https';

// Standalone HTML-site ISP records. These are NOT shared with the separate
// Flutter Workspace Firebase project. No network control or payment actions.
const allowedOrigins = new Set([
  'https://tekntandao.com', 'https://www.tekntandao.com',
  'http://localhost:5500', 'http://127.0.0.1:5500',
  'http://localhost:5000', 'http://127.0.0.1:5000',
]);
const collections = {
  devices: 'htmlIspDevices',
  subscribers: 'htmlIspSubscribers',
  incidents: 'htmlIspIncidents',
  workOrders: 'htmlIspWorkOrders',
};
const transitions = {
  incidents: {open: ['acknowledged', 'resolved'], acknowledged: ['resolved'], resolved: []},
  workOrders: {open: ['in_progress', 'completed'], in_progress: ['completed'], completed: []},
};

function bad(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
function choice(value, options, field) {
  if (!options.includes(value)) throw bad('Invalid ' + field);
  return value;
}
function field(data, key, max = 120, required = true) {
  if (typeof data[key] !== 'string') {
    if (required) throw bad('Missing ' + key);
    return '';
  }
  const value = data[key].trim();
  if ((required && !value) || value.length > max) throw bad('Invalid ' + key);
  return value;
}
function validate(input, keys) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(k => !keys.includes(k))) throw bad('Unexpected input fields');
}
async function authorize(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) throw bad('Sign in required', 401);
  let user;
  try { user = await getAuth().verifyIdToken(header.slice(7), true); }
  catch { throw bad('Invalid or expired session', 401); }
  if (user.role !== 'admin') throw bad('Administrator access required', 403);
  return user;
}
const stamp = () => FieldValue.serverTimestamp();
const asRecord = doc => ({
  id: doc.id,
  ...doc.data(),
  createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null,
  updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || null,
});
function auditRef(db, actor, action, id) {
  return {ref: db.collection('htmlIspAudit').doc(),
    data: {actorUid: actor.uid, actorEmail: actor.email || '', action, recordId: id, createdAt: stamp()}};
}
async function list(db) {
  const [devices, subscribers, incidents, workOrders] = await Promise.all(
    Object.values(collections).map(async name => {
      const snap = await db.collection(name).limit(100).get();
      return snap.docs.map(asRecord);
    })
  );
  return {devices, subscribers, incidents, workOrders,
    limitedToFirst100: true, liveNetworkConnected: false,
    paymentConnected: false, telemetryConnected: false};
}
async function create(db, user, body) {
  const action = field(body, 'action', 40);
  let data, collection, id = randomUUID();
  if (action === 'registerDevice') {
    validate(body, ['action', 'label', 'vendor', 'model', 'site', 'role', 'serial', 'notes']);
    data = {
      label: field(body, 'label'), vendor: field(body, 'vendor'),
      model: field(body, 'model'), site: field(body, 'site'),
      role: choice(field(body, 'role'), ['fiber', 'wireless', 'core', 'other'], 'role'),
      serial: field(body, 'serial', 120, false),
      notes: field(body, 'notes', 1500, false),
      status: 'planned', telemetryStatus: 'not_connected',
    };
    collection = collections.devices;
  } else if (action === 'planSubscriber') {
    validate(body, ['action', 'accountCode', 'site', 'accessType', 'planMbps']);
    const accountCode = field(body, 'accountCode', 64).toUpperCase();
    if (!/^[A-Z0-9_-]{2,64}$/.test(accountCode)) throw bad('Invalid account code');
    const planMbps = Number(body.planMbps);
    if (!Number.isInteger(planMbps) || planMbps < 1 || planMbps > 10000)
      throw bad('Plan speed must be a whole number between 1 and 10000 Mbps');
    data = {
      accountCode, site: field(body, 'site'),
      accessType: choice(field(body, 'accessType'), ['fiber', 'wireless'], 'access type'),
      planMbps, status: 'planned', provisioningStatus: 'not_connected',
    };
    id = accountCode; // create() below enforces unique subscriber account codes.
    collection = collections.subscribers;
  } else if (action === 'reportIncident') {
    validate(body, ['action', 'title', 'site', 'severity', 'description']);
    data = {
      title: field(body, 'title'), site: field(body, 'site'),
      severity: choice(field(body, 'severity'), ['low', 'medium', 'high', 'critical'], 'severity'),
      description: field(body, 'description', 1500, false), status: 'open',
    };
    collection = collections.incidents;
  } else if (action === 'createWorkOrder') {
    validate(body, ['action', 'title', 'site', 'priority', 'description']);
    data = {
      title: field(body, 'title'), site: field(body, 'site'),
      priority: choice(field(body, 'priority'), ['low', 'normal', 'urgent'], 'priority'),
      description: field(body, 'description', 1500, false), status: 'open',
    };
    collection = collections.workOrders;
  } else {
    throw bad('Unknown creation action');
  }
  const audit = auditRef(db, user, action, id);
  const batch = db.batch();
  batch.create(db.collection(collection).doc(id), {
    ...data, createdAt: stamp(), updatedAt: stamp(), createdBy: user.uid,
  });
  batch.create(audit.ref, audit.data);
  try { await batch.commit(); }
  catch (e) {
    if (String(e.code) === '6' || /already exists/i.test(String(e.message)))
      throw bad('A record with that identifier already exists', 409);
    throw e;
  }
  return {ok: true, id};
}
async function update(db, user, body) {
  validate(body, ['action', 'id', 'status']);
  const action = field(body, 'action', 40);
  const kind = action === 'setIncidentStatus' ? 'incidents'
    : action === 'setWorkOrderStatus' ? 'workOrders' : null;
  if (!kind) throw bad('Unknown update action');
  const id = field(body, 'id', 120);
  if (!/^[a-f0-9-]{36}$/.test(id)) throw bad('Invalid record ID');
  const status = field(body, 'status', 30);
  const options = kind === 'incidents'
    ? ['open', 'acknowledged', 'resolved'] : ['open', 'in_progress', 'completed'];
  choice(status, options, 'status');
  const ref = db.collection(collections[kind]).doc(id);
  const audit = auditRef(db, user, action + ':' + status, id);
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists) throw bad('Record not found', 404);
    const allowed = transitions[kind][current.data().status] || [];
    if (!allowed.includes(status)) throw bad('Invalid status transition', 409);
    tx.update(ref, {status, updatedAt: stamp(), updatedBy: user.uid});
    tx.create(audit.ref, audit.data);
  });
  return {ok: true, id, status};
}

export const adminIspOperations = onRequest({region: 'europe-west1'}, async (req, res) => {
  const origin = req.headers.origin;
  res.set('Vary', 'Origin');
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      res.status(403).json({error: 'Origin not permitted'});
      return;
    }
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (!['GET', 'POST'].includes(req.method)) throw bad('Method not allowed', 405);
    const user = await authorize(req);
    const db = getFirestore();
    const result = req.method === 'GET' ? await list(db)
      : ['registerDevice', 'planSubscriber', 'reportIncident', 'createWorkOrder'].includes(req.body?.action)
        ? await create(db, user, req.body)
        : await update(db, user, req.body);
    res.json(result);
  } catch (e) {
    const status = e.status || 500;
    res.status(status).json({error: status === 500 ? 'ISP operation failed' : e.message});
  }
});
