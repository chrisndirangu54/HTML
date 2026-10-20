export const deskAccess = {
  'admin.html': ['admin'],
  'attendant.html': ['attendant', 'admin'],
  'delivery.html': ['delivery', 'admin'],
  'isp-staff.html': ['staff', 'admin'],
};

export function dashboardForRole(role) {
  if (role === 'admin') return 'admin.html';
  if (role === 'attendant') return 'attendant.html';
  if (role === 'delivery') return 'delivery.html';
  if (role === 'staff') return 'isp-staff.html';
  return 'account.html';
}

export function allowedNext(role, raw) {
  const value = String(raw || '');
  if (!/^[a-z0-9_-]+\.html(?:[?#].*)?$/i.test(value)) return null;
  const page = value.split(/[?#]/)[0].toLowerCase();
  const roles = deskAccess[page];
  if (roles && !roles.includes(role)) return null;
  return value;
}
