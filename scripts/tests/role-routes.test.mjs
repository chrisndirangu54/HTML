import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedNext, dashboardForRole} from '../../assets/js/role-routes.js';

test('each role lands on its own desk', () => {
  assert.equal(dashboardForRole('admin'), 'admin.html');
  assert.equal(dashboardForRole('staff'), 'isp-staff.html');
  assert.equal(dashboardForRole('attendant'), 'attendant.html');
  assert.equal(dashboardForRole('delivery'), 'delivery.html');
  assert.equal(dashboardForRole('customer'), 'account.html');
});

test('everyone can return to the customer ISP page', () => {
  for (const role of ['customer', 'staff', 'admin', 'attendant', 'delivery']) {
    assert.equal(allowedNext(role, 'isp.html'), 'isp.html');
    assert.equal(allowedNext(role, 'account.html'), 'account.html');
    assert.equal(allowedNext(role, 'shop.html'), 'shop.html');
  }
});

test('a role can open only its own desk, and an admin can open every desk', () => {
  assert.equal(allowedNext('staff', 'isp-staff.html'), 'isp-staff.html');
  assert.equal(allowedNext('staff', 'admin.html'), null);
  assert.equal(allowedNext('staff', 'attendant.html'), null);
  assert.equal(allowedNext('customer', 'isp-staff.html'), null);
  assert.equal(allowedNext('customer', 'admin.html'), null);
  assert.equal(allowedNext('attendant', 'isp-staff.html'), null);
  assert.equal(allowedNext('admin', 'admin.html'), 'admin.html');
  assert.equal(allowedNext('admin', 'isp-staff.html'), 'isp-staff.html');
  assert.equal(allowedNext('admin', 'attendant.html'), 'attendant.html');
  assert.equal(allowedNext('admin', 'delivery.html'), 'delivery.html');
});

test('next targets stay on a single site page', () => {
  assert.equal(allowedNext('admin', 'https://evil.example/admin.html'), null);
  assert.equal(allowedNext('admin', '../admin.html'), null);
  assert.equal(allowedNext('customer', 'isp.html#resources'), 'isp.html#resources');
});
