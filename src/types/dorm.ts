export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'late' | 'unmarked';

export type ResidentTag = '舍長' | '樓長' | '副樓長' | '室長' | string;

export interface Resident {
  id: string; // e.g. "416-2"
  room: string; // e.g. "416"
  bed: string; // e.g. "2"
  name: string; // e.g. "陳冠宇"
  studentId: string; // e.g. "11527014"
  floor: string; // e.g. "4"
  tag?: ResidentTag; // "舍長", "樓長", "副樓長", "室長" 等特殊標籤
  phone?: string;
  department?: string;
  defaultNote?: string;
}

export interface AttendanceRecord {
  residentId: string;
  status: AttendanceStatus;
  note?: string;
  updatedAt: number;
  operatorName?: string; // name of the cadre who recorded this
}

export interface RosterVersion {
  id: string;
  name: string; // e.g. "115 學年最新在宿名單", "114 學年第二學期名單"
  effectiveDate: string; // YYYY-MM-DD
  createdAt: number;
  isCurrent: boolean;
  residents: Resident[];
  note?: string;
}

export interface DailySession {
  date: string; // YYYY-MM-DD
  rosterVersionId?: string; // id of the roster version used on this date
  records: Record<string, AttendanceRecord>; // key: residentId (e.g. "416-2")
  completedRooms: string[]; // list of room numbers that have been saved
  createdAt: number;
  updatedAt: number;
}

export interface RollCallSummary {
  totalResidents: number;
  expectedResidents: number;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  lateCount: number;
  unmarkedCount: number;
  totalRooms: number;
  completedRoomsCount: number;
  absentList: Array<{
    resident: Resident;
    record?: AttendanceRecord;
  }>;
  leaveList: Array<{
    resident: Resident;
    record?: AttendanceRecord;
  }>;
}
