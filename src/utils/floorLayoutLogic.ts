import type { Resident, AttendanceRecord } from '../types/dorm.ts';

export interface RoomBlueprintSlot {
  suffix: string; // '01' ~ '32'
  x: number;
  y: number;
  width: number;
  height: number;
  zone: 'left-horizontal' | 'left-wing' | 'center-top' | 'center-bottom' | 'right-wing' | 'right-horizontal' | 'protruding';
}

/**
 * 32 standard rooms defined exactly according to the dorm architectural blueprint:
 *
 * Left vertical wing:
 *  09, 10
 *  07, 08
 *  05, 06
 *  [Shaft ☒]
 *
 * Center upper:
 *  [Stair 2] 12, 14, 16, 18 [Stair 3]
 *
 * Right vertical wing:
 *  23, 24
 *  21, 22
 *  19, 20
 *  [Shaft ☒]
 *
 * Left horizontal:
 *  Top: 02, 04, [Shaft]
 *  Bottom: 01, 03, 29, 30 (29 & 30 protrude downward)
 *
 * Center lower:
 *  11, 13, 15, 17
 *
 * Right horizontal:
 *  Top: [Shaft], 26, 28
 *  Bottom: 31, 32 (protrude downward), 25, 27
 */
export const FLOOR_BLUEPRINT_SLOTS: RoomBlueprintSlot[] = [
  // Left vertical wing (09, 10 at top; 07, 08 mid; 05, 06 low)
  { suffix: '09', x: 185, y: 25, width: 60, height: 70, zone: 'left-wing' },
  { suffix: '10', x: 249, y: 25, width: 60, height: 70, zone: 'left-wing' },
  { suffix: '07', x: 185, y: 99, width: 60, height: 70, zone: 'left-wing' },
  { suffix: '08', x: 249, y: 99, width: 60, height: 70, zone: 'left-wing' },
  { suffix: '05', x: 185, y: 173, width: 60, height: 70, zone: 'left-wing' },
  { suffix: '06', x: 249, y: 173, width: 60, height: 70, zone: 'left-wing' },

  // Right vertical wing (23, 24 at top; 21, 22 mid; 19, 20 low)
  { suffix: '23', x: 577, y: 25, width: 60, height: 70, zone: 'right-wing' },
  { suffix: '24', x: 641, y: 25, width: 60, height: 70, zone: 'right-wing' },
  { suffix: '21', x: 577, y: 99, width: 60, height: 70, zone: 'right-wing' },
  { suffix: '22', x: 641, y: 99, width: 60, height: 70, zone: 'right-wing' },
  { suffix: '19', x: 577, y: 173, width: 60, height: 70, zone: 'right-wing' },
  { suffix: '20', x: 641, y: 173, width: 60, height: 70, zone: 'right-wing' },

  // Left horizontal upper (02, 04)
  { suffix: '02', x: 59, y: 205, width: 56, height: 70, zone: 'left-horizontal' },
  { suffix: '04', x: 119, y: 205, width: 56, height: 70, zone: 'left-horizontal' },

  // Center horizontal upper (12, 14, 16, 18)
  { suffix: '12', x: 327, y: 205, width: 54, height: 70, zone: 'center-top' },
  { suffix: '14', x: 385, y: 205, width: 54, height: 70, zone: 'center-top' },
  { suffix: '16', x: 443, y: 205, width: 54, height: 70, zone: 'center-top' },
  { suffix: '18', x: 501, y: 205, width: 54, height: 70, zone: 'center-top' },

  // Right horizontal upper (26, 28)
  { suffix: '26', x: 709, y: 205, width: 56, height: 70, zone: 'right-horizontal' },
  { suffix: '28', x: 769, y: 205, width: 56, height: 70, zone: 'right-horizontal' },

  // Left horizontal bottom (01, 03, and protruding 29, 30)
  { suffix: '01', x: 59, y: 335, width: 56, height: 70, zone: 'left-horizontal' },
  { suffix: '03', x: 119, y: 335, width: 56, height: 70, zone: 'left-horizontal' },
  { suffix: '29', x: 183, y: 335, width: 62, height: 102, zone: 'protruding' },
  { suffix: '30', x: 249, y: 335, width: 62, height: 102, zone: 'protruding' },

  // Center horizontal bottom (11, 13, 15, 17)
  { suffix: '11', x: 327, y: 335, width: 54, height: 70, zone: 'center-bottom' },
  { suffix: '13', x: 385, y: 335, width: 54, height: 70, zone: 'center-bottom' },
  { suffix: '15', x: 443, y: 335, width: 54, height: 70, zone: 'center-bottom' },
  { suffix: '17', x: 501, y: 335, width: 54, height: 70, zone: 'center-bottom' },

  // Right horizontal bottom (protruding 31, 32, and 25, 27)
  { suffix: '31', x: 577, y: 335, width: 62, height: 102, zone: 'protruding' },
  { suffix: '32', x: 643, y: 335, width: 62, height: 102, zone: 'protruding' },
  { suffix: '25', x: 709, y: 335, width: 56, height: 70, zone: 'right-horizontal' },
  { suffix: '27', x: 769, y: 335, width: 56, height: 70, zone: 'right-horizontal' },
];

/**
 * Format floor and 2-digit room suffix into a full room number
 * e.g. floor '4', suffix '16' -> '416'
 * e.g. floor '4', suffix '02' -> '402'
 * e.g. floor '10', suffix '05' -> '1005'
 */
export function formatRoomNumber(floor: string, suffix: string): string {
  const cleanFloor = floor === 'all' ? '4' : floor;
  const numSuffix = parseInt(suffix, 10);
  if (isNaN(numSuffix)) return `${cleanFloor}${suffix}`;
  return `${cleanFloor}${String(numSuffix).padStart(2, '0')}`;
}

/**
 * Find exact matching room in floor rooms list
 */
export function findMatchingRoomInFloor(roomsInFloor: string[], suffix: string, floor: string): string {
  const expected = formatRoomNumber(floor, suffix);
  if (roomsInFloor.includes(expected)) return expected;

  // Search if any room ends with suffix
  const found = roomsInFloor.find(r => r.endsWith(suffix) || r === suffix || r.endsWith(String(parseInt(suffix, 10))));
  return found || expected;
}

export interface RoomStatusSummary {
  roomNumber: string;
  totalBeds: number;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  lateCount: number;
  unmarkedCount: number;
  isFullyMarked: boolean;
  hasAbsent: boolean;
  hasLeave: boolean;
  hasCadre: boolean;
  cadreNames: string[];
  cadreTags: string[];
  primaryStatus: 'present' | 'absent' | 'leave' | 'late' | 'unmarked' | 'empty';
}

/**
 * Compute attendance summary and cadre presence for a given room
 */
export function computeRoomStatus(
  residents: Resident[],
  records: Record<string, AttendanceRecord>,
  roomNumber: string
): RoomStatusSummary {
  const beds = residents.filter(r => r.room === roomNumber);
  const totalBeds = beds.length;

  let presentCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let lateCount = 0;
  let unmarkedCount = 0;

  const cadreNames: string[] = [];
  const cadreTags: string[] = [];

  for (const b of beds) {
    if (b.tag) {
      cadreNames.push(`${b.name} (${b.tag})`);
      cadreTags.push(b.tag);
    }

    const rec = records[b.id];
    const status = rec?.status || 'unmarked';

    if (status === 'present') presentCount++;
    else if (status === 'absent') absentCount++;
    else if (status === 'leave') leaveCount++;
    else if (status === 'late') lateCount++;
    else unmarkedCount++;
  }

  const isFullyMarked = totalBeds > 0 && unmarkedCount === 0;
  const hasAbsent = absentCount > 0;
  const hasLeave = leaveCount > 0;
  const hasCadre = cadreTags.length > 0;

  let primaryStatus: 'present' | 'absent' | 'leave' | 'late' | 'unmarked' | 'empty' = 'unmarked';
  if (totalBeds === 0) {
    primaryStatus = 'empty';
  } else if (hasAbsent) {
    primaryStatus = 'absent';
  } else if (hasLeave) {
    primaryStatus = 'leave';
  } else if (lateCount > 0) {
    primaryStatus = 'late';
  } else if (isFullyMarked && presentCount === totalBeds) {
    primaryStatus = 'present';
  }

  return {
    roomNumber,
    totalBeds,
    presentCount,
    absentCount,
    leaveCount,
    lateCount,
    unmarkedCount,
    isFullyMarked,
    hasAbsent,
    hasLeave,
    hasCadre,
    cadreNames,
    cadreTags,
    primaryStatus,
  };
}
