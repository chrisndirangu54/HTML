import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ispActionAllowed} from './isp-access.js';

test('ISP staff can list records and run incidents and work orders', () => {
  for (const action of ['list', 'reportIncident', 'createWorkOrder', 'setIncidentStatus', 'setWorkOrderStatus']) {
    assert.equal(ispActionAllowed('staff', action), true);
  }
});

test('ISP staff cannot register devices or plan subscribers', () => {
  assert.equal(ispActionAllowed('staff', 'registerDevice'), false);
  assert.equal(ispActionAllowed('staff', 'planSubscriber'), false);
});

test('administrators can run every ISP management action', () => {
  for (const action of ['list', 'registerDevice', 'planSubscriber', 'reportIncident', 'createWorkOrder', 'setIncidentStatus', 'setWorkOrderStatus']) {
    assert.equal(ispActionAllowed('admin', action), true);
  }
});

test('customers, attendants, and delivery cannot call ISP actions', () => {
  for (const role of ['customer', 'attendant', 'delivery', undefined]) {
    assert.equal(ispActionAllowed(role, 'list'), false);
    assert.equal(ispActionAllowed(role, 'reportIncident'), false);
    assert.equal(ispActionAllowed(role, 'registerDevice'), false);
  }
});
