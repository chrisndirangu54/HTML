import {getSession, waitForUser} from './auth-client.js';

const user = await waitForUser();
if (!user) {
  location.replace('isp.html');
} else {
  const session = await getSession(true).catch(() => ({role: 'customer'}));
  if (session.role === 'admin') location.replace('admin.html#isp-operations');
  else if (session.role === 'staff') location.replace('isp-staff.html');
  else location.replace('isp.html');
}
