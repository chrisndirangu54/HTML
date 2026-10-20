import {functionsBase, getSession, idToken, signOutCurrent} from './auth-client.js';
import {dashboardForRole} from './role-routes.js';

const panel = document.querySelector('#isp-operations');
const $ = selector => panel?.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,
  ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
const url = functionsBase
  ? functionsBase + '/adminIspOperations'
  : '/api/adminIspOperations';
let busy = false;
let state = {devices:[], subscribers:[], incidents:[], workOrders:[]};

async function request(action, body) {
  const token = await idToken();
  const response = await fetch(url, {
    method: action === 'list' ? 'GET' : 'POST',
    headers: {'Authorization': 'Bearer ' + token, ...(body ? {'Content-Type': 'application/json'} : {})},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'ISP request failed (' + response.status + ')');
  return result;
}
function message(text, problem = false) {
  const el = $('#isp-feedback');
  if (!el) return;
  el.textContent = text;
  el.className = problem ? 'status danger' : 'status';
}
function badges() {
  $('#isp-count-devices').textContent = String(state.devices.length);
  $('#isp-count-subscribers').textContent = String(state.subscribers.length);
  $('#isp-count-incidents').textContent = String(state.incidents.filter(x => x.status !== 'resolved').length);
  $('#isp-count-orders').textContent = String(state.workOrders.filter(x => x.status !== 'completed').length);
}
function actions(kind, record) {
  if (kind === 'incidents' && record.status !== 'resolved') {
    return [
      ...(record.status === 'open' ? [{status:'acknowledged',label:'Acknowledge'}] : []),
      {status:'resolved',label:'Resolve'},
    ];
  }
  if (kind === 'workOrders' && record.status !== 'completed') {
    return [
      ...(record.status === 'open' ? [{status:'in_progress',label:'Start'}] : []),
      {status:'completed',label:'Complete'},
    ];
  }
  return [];
}
function recordTable(kind, records) {
  if (!records?.length) return '<p class="muted">No records yet.</p>';
  return '<div class="table-wrap"><table class="data-table"><thead><tr><th>Record</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
    records.map(x => {
      const label = x.label || x.title || x.accountCode || x.id;
      const meta = [x.vendor, x.model, x.accessType, x.severity, x.priority]
        .filter(Boolean).map(escapeHTML).join(' · ');
      const ops = actions(kind, x).map(a =>
        '<button type="button" class="btn btn-ghost" data-isp-update="' + escapeHTML(kind) +
        '" data-id="' + escapeHTML(x.id) + '" data-status="' + escapeHTML(a.status) + '">' +
        escapeHTML(a.label) + '</button>').join(' ');
      return '<tr><td><strong>' + escapeHTML(label) + '</strong><br><small>' + meta +
        '</small></td><td>' + escapeHTML(x.site) + '</td><td>' +
        escapeHTML(x.status || 'planned') + '</td><td>' +
        (ops || '<small class="muted">View only</small>') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}
function render() {
  badges();
  for (const key of ['devices','subscribers','incidents','workOrders']) {
    const element = $('#isp-list-' + key);
    if (element) element.innerHTML = recordTable(key, state[key] || []);
  }
}
async function reload() {
  const result = await request('list');
  state = result;
  render();
}
async function withBusy(callback) {
  if (busy) return;
  busy = true;
  panel.querySelectorAll('button, input, select, textarea').forEach(x => x.disabled = true);
  try { await callback(); }
  catch (error) { message(error.message || 'Operation failed', true); }
  finally {
    busy = false;
    panel.querySelectorAll('button, input, select, textarea').forEach(x => x.disabled = false);
  }
}
function input(form, name) { return String(new FormData(form).get(name) || '').trim(); }
function wireForms() {
  const definitions = {
    'isp-device-form': form => ({
      action:'registerDevice', label:input(form,'label'), vendor:input(form,'vendor'),
      model:input(form,'model'), site:input(form,'site'), role:input(form,'role'),
      serial:input(form,'serial'), notes:input(form,'notes'),
    }),
    'isp-subscriber-form': form => ({
      action:'planSubscriber', accountCode:input(form,'accountCode'), site:input(form,'site'),
      accessType:input(form,'accessType'), planMbps:Number(input(form,'planMbps')),
    }),
    'isp-incident-form': form => ({
      action:'reportIncident', title:input(form,'title'), site:input(form,'site'),
      severity:input(form,'severity'), description:input(form,'description'),
    }),
    'isp-order-form': form => ({
      action:'createWorkOrder', title:input(form,'title'), site:input(form,'site'),
      priority:input(form,'priority'), description:input(form,'description'),
    }),
  };
  for (const [id, values] of Object.entries(definitions)) {
    const form = document.getElementById(id);
    form?.addEventListener('submit', event => {
      event.preventDefault();
      withBusy(async () => {
        await request('write', values(form));
        form.reset();
        await reload();
        message('ISP management record saved. No live router commands were executed.');
      });
    });
  }
  panel.addEventListener('click', event => {
    const button = event.target.closest('button[data-isp-update]');
    if (!button) return;
    const kind = button.dataset.ispUpdate;
    const status = button.dataset.status;
    const id = button.dataset.id;
    const action = kind === 'incidents' ? 'setIncidentStatus' : 'setWorkOrderStatus';
    withBusy(async () => {
      await request('write', {action, id, status});
      await reload();
      message('Status updated and audited.');
    });
  });
  $('#isp-refresh')?.addEventListener('click', () => withBusy(async () => {
    await reload();
    message('ISP management records refreshed.');
  }));
}
async function start() {
  if (!panel) return;
  const mode = document.body.dataset.ispDesk || 'admin';
  if (mode === 'staff') {
    const signOut = document.querySelector('#sign-out');
    if (signOut) signOut.onclick = signOutCurrent;
  }
  try {
    const session = await getSession(true);
    const sessionLine = document.querySelector('#dashboard-session');
    if (mode === 'staff' && sessionLine) sessionLine.textContent = `${session.email || ''} · ${session.role}`;
    const allowed = mode === 'staff'
      ? session.role === 'staff' || session.role === 'admin'
      : session.role === 'admin';
    if (!allowed) {
      if (mode === 'staff') location.replace(session.role === 'customer' ? 'isp.html' : dashboardForRole(session.role));
      return;
    }
    if (mode === 'staff' && session.role === 'admin') {
      const nav = document.querySelector('.commerce-nav');
      const signOut = document.querySelector('#sign-out');
      if (nav && signOut && !nav.querySelector('a[href="admin.html"]')) {
        const link = document.createElement('a');
        link.href = 'admin.html';
        link.textContent = 'Admin desk';
        nav.insertBefore(link, signOut);
      }
    }
    panel.hidden = false;
    wireForms();
    await reload();
  } catch (error) {
    if (panel && !panel.hidden) message(error.message || 'ISP data unavailable', true);
  }
}
start();
