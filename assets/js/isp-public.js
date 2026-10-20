import {getSession, waitForUser} from './auth-client.js';
import {dashboardForRole} from './role-routes.js';

const labels = {
  admin: 'Admin desk',
  staff: 'Staff desk',
  attendant: 'Attendant desk',
  delivery: 'Delivery desk',
  customer: 'My account',
};

async function showDesk() {
  const desk = document.querySelector('#isp-desk');
  const user = await waitForUser();
  if (!user) return;
  const session = await getSession(false).catch(() => null);
  if (!session) return;
  document.querySelectorAll('.isp-sign-in').forEach(link => { link.hidden = true; });
  if (!desk) return;
  const role = session.role || 'customer';
  desk.hidden = false;
  desk.href = role === 'customer' ? 'account.html' : dashboardForRole(role);
  desk.textContent = labels[role] || 'My account';
}

showDesk();
