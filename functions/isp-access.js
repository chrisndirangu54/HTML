const staffActions = new Set([
  'list',
  'reportIncident',
  'createWorkOrder',
  'setIncidentStatus',
  'setWorkOrderStatus',
]);
const adminActions = new Set(['registerDevice', 'planSubscriber']);

export function ispActionAllowed(role, action) {
  if (role === 'admin') return staffActions.has(action) || adminActions.has(action);
  if (role === 'staff') return staffActions.has(action);
  return false;
}
