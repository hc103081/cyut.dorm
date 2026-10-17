import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFloorFromRoom,
  parseRosterText,
  calculateSummary,
  generateLineReportText,
  createAllAbsentRecordsForRoom,
  createAllPresentRecordsForRoom,
  findRosterForSession
} from './rollcallLogic.ts';
import type { DailySession, Resident, RosterVersion } from '../types/dorm.ts';

test('getFloorFromRoom handles standard 3-digit and 4-digit dorm rooms', () => {
  assert.equal(getFloorFromRoom('416'), '4');
  assert.equal(getFloorFromRoom('302'), '3');
  assert.equal(getFloorFromRoom('1105'), '11');
  assert.equal(getFloorFromRoom('B102'), 'B1');
});

test('parseRosterText correctly parses tab and comma separated roster data', () => {
  const sampleInput = `
房號	床號	姓名	學號
416	1	張家豪	11527013
416, 2, 陳冠宇, 11527014
416 3 林子軒 11527015
416，4，黃建廷，11527016
  `;

  const result = parseRosterText(sampleInput);
  assert.equal(result.errors.length, 0);
  assert.equal(result.residents.length, 4);

  const r2 = result.residents.find(r => r.bed === '2');
  assert.ok(r2);
  assert.equal(r2.room, '416');
  assert.equal(r2.name, '陳冠宇');
  assert.equal(r2.studentId, '11527014');
  assert.equal(r2.id, '416-2');
  assert.equal(r2.floor, '4');
});

test('calculateSummary accurately tallies present, absent, and leave counts', () => {
  const residents: Resident[] = [
    { id: '416-1', room: '416', bed: '1', name: 'A', studentId: '101', floor: '4' },
    { id: '416-2', room: '416', bed: '2', name: 'B', studentId: '102', floor: '4' },
    { id: '416-3', room: '416', bed: '3', name: 'C', studentId: '103', floor: '4' },
    { id: '416-4', room: '416', bed: '4', name: 'D', studentId: '104', floor: '4' },
  ];

  const session: DailySession = {
    date: '2026-10-15',
    records: {
      '416-1': { residentId: '416-1', status: 'present', updatedAt: 100 },
      '416-2': { residentId: '416-2', status: 'present', updatedAt: 100 },
      '416-3': { residentId: '416-3', status: 'absent', updatedAt: 100, note: '聯絡不上' },
      '416-4': { residentId: '416-4', status: 'leave', updatedAt: 100, note: '家因' },
    },
    completedRooms: ['416'],
    createdAt: 100,
    updatedAt: 100,
  };

  const summary = calculateSummary(residents, session);
  assert.equal(summary.totalResidents, 4);
  assert.equal(summary.presentCount, 2);
  assert.equal(summary.absentCount, 1);
  assert.equal(summary.leaveCount, 1);
  assert.equal(summary.unmarkedCount, 0);
  assert.equal(summary.completedRoomsCount, 1);
  assert.equal(summary.absentList[0].resident.id, '416-3');
});

test('generateLineReportText outputs expected format with absent list', () => {
  const residents: Resident[] = [
    { id: '416-2', room: '416', bed: '2', name: '陳冠宇', studentId: '11527014', floor: '4' },
  ];

  const session: DailySession = {
    date: '2026-10-15',
    records: {
      '416-2': { residentId: '416-2', status: 'absent', updatedAt: 100, note: '未接電話' },
    },
    completedRooms: ['416'],
    createdAt: 100,
    updatedAt: 100,
  };

  const summary = calculateSummary(residents, session);
  const report = generateLineReportText('2026-10-15', '4F 男生宿舍', summary);

  assert.ok(report.includes('4F 男生宿舍晚點名回報'));
  assert.ok(report.includes('未到名單 (1人)'));
  assert.ok(report.includes('[416-2] 陳冠宇 (學號: 11527014) (未接電話)'));
});

test('createAllAbsentRecordsForRoom correctly marks all residents as absent with door unopened note', () => {
  const residents: Resident[] = [
    { id: '405-1', room: '405', bed: '1', name: '王同學', studentId: '11527031', floor: '4' },
    { id: '405-2', room: '405', bed: '2', name: '李同學', studentId: '11527032', floor: '4' },
  ];

  const records = createAllAbsentRecordsForRoom(residents);
  assert.equal(Object.keys(records).length, 2);
  assert.equal(records['405-1'].status, 'absent');
  assert.equal(records['405-1'].note, '房門未開 / 敲門無回應');
  assert.equal(records['405-2'].status, 'absent');
});

test('findRosterForSession correctly finds current or archived roster versions', () => {
  const v1: RosterVersion = {
    id: 'roster-114-2',
    name: '114學年度第二學期名單',
    effectiveDate: '2026-02-15',
    createdAt: 1000,
    isCurrent: false,
    residents: []
  };

  const v2: RosterVersion = {
    id: 'roster-115-1',
    name: '115學年度最新名單',
    effectiveDate: '2026-09-01',
    createdAt: 2000,
    isCurrent: true,
    residents: []
  };

  const selectedCurrent = findRosterForSession([v1, v2]);
  assert.equal(selectedCurrent?.id, 'roster-115-1');

  const selectedHistorical = findRosterForSession([v1, v2], 'roster-114-2');
  assert.equal(selectedHistorical?.id, 'roster-114-2');
});

test('parseRosterText automatically extracts cadre tags like 樓長, 舍長, 副樓長', () => {
  const sample = `
416	1	張育誠	11527013	副樓長
416	2	黃柏翰	11527014	樓長
401	1	陳冠宇	11527001	舍長
305	1	李同學	11527088	室長
  `;

  const parsed = parseRosterText(sample);
  assert.equal(parsed.residents.length, 4);

  const r1 = parsed.residents.find(r => r.name === '張育誠');
  assert.equal(r1?.tag, '副樓長');

  const r2 = parsed.residents.find(r => r.name === '黃柏翰');
  assert.equal(r2?.tag, '樓長');

  const r3 = parsed.residents.find(r => r.name === '陳冠宇');
  assert.equal(r3?.tag, '舍長');

  const r4 = parsed.residents.find(r => r.name === '李同學');
  assert.equal(r4?.tag, '室長');
});

test('generateLineReportText displays cadre tag in absent report when present', () => {
  const residents: Resident[] = [
    { id: '416-2', room: '416', bed: '2', name: '黃柏翰', studentId: '11527014', floor: '4', tag: '樓長' },
  ];

  const session: DailySession = {
    date: '2026-10-16',
    records: {
      '416-2': { residentId: '416-2', status: 'absent', updatedAt: 100, note: '練球' },
    },
    completedRooms: ['416'],
    createdAt: 100,
    updatedAt: 100,
  };

  const summary = calculateSummary(residents, session);
  const report = generateLineReportText('2026-10-16', '4F 男生宿舍', summary);

  assert.ok(report.includes('[416-2] 黃柏翰 [樓長] (學號: 11527014) (練球)'));
});
