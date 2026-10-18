import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FLOOR_BLUEPRINT_SLOTS,
  formatRoomNumber,
  findMatchingRoomInFloor,
  computeRoomStatus
} from './floorLayoutLogic.ts';
import type { Resident, AttendanceRecord } from '../types/dorm.ts';

test('FLOOR_BLUEPRINT_SLOTS contains exactly 32 blueprint rooms from 01 to 32', () => {
  assert.equal(FLOOR_BLUEPRINT_SLOTS.length, 32);

  const suffixes = FLOOR_BLUEPRINT_SLOTS.map(s => s.suffix).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  for (let i = 1; i <= 32; i++) {
    const expected = String(i).padStart(2, '0');
    assert.equal(suffixes[i - 1], expected, `Missing slot for room ${expected}`);
  }
});

test('formatRoomNumber correctly formats 3-digit and multi-digit rooms for floors', () => {
  assert.equal(formatRoomNumber('4', '01'), '401');
  assert.equal(formatRoomNumber('4', '16'), '416');
  assert.equal(formatRoomNumber('3', '32'), '332');
  assert.equal(formatRoomNumber('all', '12'), '412');
});

test('findMatchingRoomInFloor locates room in array', () => {
  const roomsInFloor = ['401', '402', '416', '432'];
  assert.equal(findMatchingRoomInFloor(roomsInFloor, '16', '4'), '416');
  assert.equal(findMatchingRoomInFloor(roomsInFloor, '01', '4'), '401');
  assert.equal(findMatchingRoomInFloor(roomsInFloor, '32', '4'), '432');
  assert.equal(findMatchingRoomInFloor(roomsInFloor, '05', '4'), '405');
});

test('computeRoomStatus accurately identifies all-present, absent, leave, and cadre', () => {
  const mockResidents: Resident[] = [
    { id: '416-1', room: '416', bed: '1', name: '張育誠', studentId: '11527013', floor: '4', tag: '副樓長' },
    { id: '416-2', room: '416', bed: '2', name: '黃柏翰', studentId: '11527014', floor: '4', tag: '樓長' },
    { id: '416-3', room: '416', bed: '3', name: '林子軒', studentId: '11527015', floor: '4' },
    { id: '416-4', room: '416', bed: '4', name: '陳家銘', studentId: '11527016', floor: '4' },
  ];

  const recordsAllPresent: Record<string, AttendanceRecord> = {
    '416-1': { residentId: '416-1', status: 'present', updatedAt: 1 },
    '416-2': { residentId: '416-2', status: 'present', updatedAt: 1 },
    '416-3': { residentId: '416-3', status: 'present', updatedAt: 1 },
    '416-4': { residentId: '416-4', status: 'present', updatedAt: 1 },
  };

  const status1 = computeRoomStatus(mockResidents, recordsAllPresent, '416');
  assert.equal(status1.totalBeds, 4);
  assert.equal(status1.presentCount, 4);
  assert.equal(status1.absentCount, 0);
  assert.equal(status1.isFullyMarked, true);
  assert.equal(status1.hasCadre, true);
  assert.equal(status1.primaryStatus, 'present');
  assert.deepEqual(status1.cadreTags, ['副樓長', '樓長']);

  const recordsWithAbsent: Record<string, AttendanceRecord> = {
    '416-1': { residentId: '416-1', status: 'present', updatedAt: 1 },
    '416-2': { residentId: '416-2', status: 'absent', updatedAt: 1 },
    '416-3': { residentId: '416-3', status: 'leave', updatedAt: 1 },
    '416-4': { residentId: '416-4', status: 'unmarked', updatedAt: 1 },
  };

  const status2 = computeRoomStatus(mockResidents, recordsWithAbsent, '416');
  assert.equal(status2.presentCount, 1);
  assert.equal(status2.absentCount, 1);
  assert.equal(status2.leaveCount, 1);
  assert.equal(status2.unmarkedCount, 1);
  assert.equal(status2.isFullyMarked, false);
  assert.equal(status2.hasAbsent, true);
  assert.equal(status2.hasLeave, true);
  assert.equal(status2.primaryStatus, 'absent');
});
