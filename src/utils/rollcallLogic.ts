import type { AttendanceRecord, DailySession, Resident, RollCallSummary, RosterVersion } from '../types/dorm.ts';

/**
 * Extracts floor number from room string (e.g. "416" -> "4", "B102" -> "B1", "1203" -> "12")
 */
export function getFloorFromRoom(room: string): string {
  const trimmed = room.trim();
  if (!trimmed) return '1';
  if (/^B\d+/i.test(trimmed)) {
    return trimmed.slice(0, 2).toUpperCase();
  }
  if (trimmed.length >= 4) {
    return trimmed.slice(0, 2);
  }
  if (trimmed.length === 3) {
    return trimmed.slice(0, 1);
  }
  return trimmed.slice(0, 1) || '1';
}

/**
 * Parses pasted raw text from spreadsheet (Tab or comma or space separated)
 * Formats supported:
 * 房號 床號 姓名 學號
 * 416, 2, 陳冠宇, 11527014
 * 416	2	陳冠宇	11527014
 */
export function parseRosterText(rawText: string): { residents: Resident[]; errors: string[] } {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const residents: Resident[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // skip header lines if user copied column names
    if (line.includes('房號') && line.includes('床') && line.includes('姓名')) {
      continue;
    }

    // Split by tab, comma, semicolon or multiple spaces
    let parts: string[] = [];
    if (line.includes('\t')) {
      parts = line.split('\t').map(s => s.trim()).filter(Boolean);
    } else if (line.includes(',')) {
      parts = line.split(',').map(s => s.trim()).filter(Boolean);
    } else if (line.includes('，')) {
      parts = line.split('，').map(s => s.trim()).filter(Boolean);
    } else {
      parts = line.split(/\s+/).map(s => s.trim()).filter(Boolean);
    }

    if (parts.length < 3) {
      errors.push(`第 ${i + 1} 行格式不符: "${line}" (需包含房號、床號、姓名)`);
      continue;
    }

    const room = parts[0];
    const bed = parts[1];
    const name = parts[2];
    const studentId = parts[3] || '未提供';
    const floor = getFloorFromRoom(room);
    const id = `${room}-${bed}`;

    // Auto-detect cadre tags in 5th column or extra parts
    let tag: string | undefined = undefined;
    const extraParts = parts.slice(4);
    for (const ep of extraParts) {
      if (['舍長', '樓長', '副樓長', '室長'].includes(ep)) {
        tag = ep;
        break;
      } else if (ep.includes('舍長')) {
        tag = '舍長';
        break;
      } else if (ep.includes('副樓長')) {
        tag = '副樓長';
        break;
      } else if (ep.includes('樓長')) {
        tag = '樓長';
        break;
      } else if (ep.includes('室長')) {
        tag = '室長';
        break;
      } else if (!tag) {
        tag = ep;
      }
    }

    residents.push({
      id,
      room,
      bed,
      name,
      studentId,
      floor,
      tag,
    });
  }

  return { residents, errors };
}

/**
 * Helper to generate all-present records for a room
 */
export function createAllPresentRecordsForRoom(residents: Resident[]): Record<string, AttendanceRecord> {
  const now = Date.now();
  const records: Record<string, AttendanceRecord> = {};
  for (const r of residents) {
    records[r.id] = {
      residentId: r.id,
      status: 'present',
      updatedAt: now,
    };
  }
  return records;
}

/**
 * Helper to generate all-absent records for an unopened room
 */
export function createAllAbsentRecordsForRoom(
  residents: Resident[],
  note = '房門未開 / 敲門無回應'
): Record<string, AttendanceRecord> {
  const now = Date.now();
  const records: Record<string, AttendanceRecord> = {};
  for (const r of residents) {
    records[r.id] = {
      residentId: r.id,
      status: 'absent',
      note,
      updatedAt: now,
    };
  }
  return records;
}

/**
 * Finds matching roster version for a given date or session
 */
export function findRosterForSession(
  rosterVersions: RosterVersion[],
  sessionRosterVersionId?: string
): RosterVersion | undefined {
  if (sessionRosterVersionId) {
    const found = rosterVersions.find(v => v.id === sessionRosterVersionId);
    if (found) return found;
  }
  // Default to the one marked isCurrent, or first
  return rosterVersions.find(v => v.isCurrent) || rosterVersions[0];
}

/**
 * Calculates statistics for given residents and daily session
 */
export function calculateSummary(
  residents: Resident[],
  session: DailySession | null,
  filterFloor?: string
): RollCallSummary {
  const targetResidents = filterFloor && filterFloor !== 'all'
    ? residents.filter(r => r.floor === filterFloor)
    : residents;

  const records = session?.records || {};
  const completedRoomsSet = new Set(session?.completedRooms || []);

  let presentCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let lateCount = 0;
  let unmarkedCount = 0;

  const absentList: RollCallSummary['absentList'] = [];
  const leaveList: RollCallSummary['leaveList'] = [];

  const uniqueRooms = new Set<string>();

  for (const resident of targetResidents) {
    uniqueRooms.add(resident.room);
    const rec = records[resident.id];
    const status = rec?.status || 'unmarked';

    switch (status) {
      case 'present':
        presentCount++;
        break;
      case 'absent':
        absentCount++;
        absentList.push({ resident, record: rec });
        break;
      case 'leave':
        leaveCount++;
        leaveList.push({ resident, record: rec });
        break;
      case 'late':
        lateCount++;
        break;
      default:
        unmarkedCount++;
        break;
    }
  }

  let completedRoomsCount = 0;
  for (const room of uniqueRooms) {
    if (completedRoomsSet.has(room)) {
      completedRoomsCount++;
    }
  }

  return {
    totalResidents: targetResidents.length,
    expectedResidents: targetResidents.length,
    presentCount,
    absentCount,
    leaveCount,
    lateCount,
    unmarkedCount,
    totalRooms: uniqueRooms.size,
    completedRoomsCount,
    absentList,
    leaveList,
  };
}

/**
 * Generates formatted LINE / message report for dorm cadres
 */
export function generateLineReportText(
  date: string,
  floorName: string,
  summary: RollCallSummary
): string {
  const parts: string[] = [];
  const titlePrefix = floorName.includes('宿舍') ? floorName : `${floorName} 宿舍`;
  parts.push(`📋 【${titlePrefix}晚點名回報】`);
  parts.push(`📅 日期：${date}`);
  parts.push(`📊 點名進度：房間 ${summary.completedRoomsCount}/${summary.totalRooms} 間完成`);
  parts.push(`👥 人數統計：`);
  parts.push(`  • 應到人數：${summary.totalResidents} 人`);
  parts.push(`  • 實到人數：${summary.presentCount} 人 (${summary.totalResidents > 0 ? Math.round((summary.presentCount / summary.totalResidents) * 100) : 0}%)`);
  parts.push(`  • 請假人數：${summary.leaveCount} 人`);
  parts.push(`  • 晚歸/補點：${summary.lateCount} 人`);
  parts.push(`  • 未到人數：${summary.absentCount} 人`);

  if (summary.unmarkedCount > 0) {
    parts.push(`  • 未點名/待確認：${summary.unmarkedCount} 人`);
  }

  parts.push('');
  if (summary.absentList.length > 0) {
    parts.push(`🚨 【未到名單 (${summary.absentList.length}人)】：`);
    summary.absentList.forEach((item, idx) => {
      const tagStr = item.resident.tag ? ` [${item.resident.tag}]` : '';
      const noteStr = item.record?.note ? ` (${item.record.note})` : '';
      parts.push(`${idx + 1}. [${item.resident.id}] ${item.resident.name}${tagStr} (學號: ${item.resident.studentId})${noteStr}`);
    });
  } else {
    parts.push(`✅ 【未到名單】：無 (全員到齊或均有請假)`);
  }

  if (summary.leaveList.length > 0) {
    parts.push('');
    parts.push(`📝 【請假名單 (${summary.leaveList.length}人)】：`);
    summary.leaveList.forEach((item, idx) => {
      const tagStr = item.resident.tag ? ` [${item.resident.tag}]` : '';
      const noteStr = item.record?.note ? ` - 備註: ${item.record.note}` : '';
      parts.push(`${idx + 1}. [${item.resident.id}] ${item.resident.name}${tagStr}${noteStr}`);
    });
  }

  return parts.join('\n');
}

/**
 * Export summary/details to CSV string format
 */
export function exportToCSV(
  residents: Resident[],
  session: DailySession | null,
  date: string
): string {
  const headers = ['日期', '樓層', '房號', '床號', '姓名', '幹部標籤', '學號', '點名狀態', '備註', '最後更新時間'];
  const rows: string[][] = [headers];

  const records = session?.records || {};

  for (const r of residents) {
    const rec = records[r.id];
    let statusText = '未點名';
    if (rec) {
      if (rec.status === 'present') statusText = '已到';
      else if (rec.status === 'absent') statusText = '未到';
      else if (rec.status === 'leave') statusText = '請假';
      else if (rec.status === 'late') statusText = '晚歸';
    }

    const timeText = rec ? new Date(rec.updatedAt).toLocaleTimeString('zh-TW', { hour12: false }) : '';
    rows.push([
      date,
      r.floor,
      r.room,
      r.bed,
      `"${r.name.replace(/"/g, '""')}"`,
      r.tag ? `"${r.tag.replace(/"/g, '""')}"` : '',
      r.studentId,
      statusText,
      `"${(rec?.note || '').replace(/"/g, '""')}"`,
      timeText
    ]);
  }

  return '\uFEFF' + rows.map(row => row.join(',')).join('\n');
}
