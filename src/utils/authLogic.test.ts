import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLogin, createAuditLogEntry, filterAuditLogs } from './authLogic.ts';
import type { AuthConfig, AuditLog } from '../types/auth.ts';

const mockAuthConfig: AuthConfig = {
  adminPassword: 'admin_secret_123',
  cadreOfflinePasscode: 'dorm_pass_2026',
  registeredCadres: [
    {
      id: 'cadre-1',
      name: '黃柏翰',
      role: 'cadre',
      customPassword: 'my_special_key',
      createdAt: 1000,
    },
  ],
};

test('validateLogin allows Admin login with admin password', () => {
  const result = validateLogin('admin', 'admin_secret_123', mockAuthConfig);
  assert.equal(result.success, true);
  assert.equal(result.session?.role, 'admin');

  const failResult = validateLogin('admin', 'wrong_pass', mockAuthConfig);
  assert.equal(failResult.success, false);
});

test('validateLogin allows existing cadre with chosen name and custom password', () => {
  const result = validateLogin('黃柏翰', 'my_special_key', mockAuthConfig);
  assert.equal(result.success, true);
  assert.equal(result.session?.username, '黃柏翰');
  assert.equal(result.isNewCadre, false);
});

test('validateLogin automatically creates new cadre account when unrecognized name logs in with valid passcode', () => {
  // User enters arbitrary name not in registeredCadres
  const result = validateLogin('林樓長 (5F)', 'dorm_pass_2026', mockAuthConfig);
  assert.equal(result.success, true);
  assert.equal(result.session?.role, 'cadre');
  assert.equal(result.session?.username, '林樓長 (5F)');
  assert.equal(result.isNewCadre, true);
  assert.ok(result.updatedAuthConfig);

  // Verify the new cadre was automatically appended to registeredCadres
  const found = result.updatedAuthConfig?.registeredCadres.find(c => c.name === '林樓長 (5F)');
  assert.ok(found);
  assert.equal(found.role, 'cadre');
});

test('validateLogin rejects invalid passcode for new user to prevent outsiders', () => {
  const fail = validateLogin('外來訪客', 'wrong_code', mockAuthConfig);
  assert.equal(fail.success, false);
});

test('createAuditLogEntry and filterAuditLogs work correctly', () => {
  const log1 = createAuditLogEntry('黃柏翰', 'cadre', 'ROLL_CALL', '點名更新', '416-2 標記為 已到');
  const log2 = createAuditLogEntry('總管理員 (Admin)', 'admin', 'ROSTER_IMPORT', '名冊匯入', '匯入 115 最新名冊');

  const allLogs: AuditLog[] = [log1, log2];
  const filteredRollCall = filterAuditLogs(allLogs, '', 'ROLL_CALL');
  assert.equal(filteredRollCall.length, 1);
  assert.equal(filteredRollCall[0].operatorName, '黃柏翰');

  const searchAdmin = filterAuditLogs(allLogs, 'admin');
  assert.equal(searchAdmin.length, 1);
  assert.equal(searchAdmin[0].action, 'ROSTER_IMPORT');
});
