import { DailySession, Resident, RosterVersion } from '../types/dorm.ts';
import { AuthConfig, AuditLog, UserSession } from '../types/auth.ts';
import { generateInitialMockResidents } from './mockData.ts';

const ROSTER_VERSIONS_KEY = 'dorm_roster_versions_v2';
const SESSIONS_PREFIX = 'dorm_session_';
const SESSIONS_INDEX_KEY = 'dorm_sessions_index_v2';
const AUTH_CONFIG_KEY = 'dorm_auth_config_v2';
const USER_SESSION_KEY = 'dorm_user_session_v2';
const AUDIT_LOGS_KEY = 'dorm_audit_logs_v2';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate sample historical 114 semester residents for archival demonstration
 */
function generateSample114HistoricalResidents(): Resident[] {
  const current = generateInitialMockResidents();
  return current.map(r => ({
    ...r,
    studentId: r.studentId.replace(/^115/, '114'),
    department: '資工系/電機系',
    defaultNote: r.id === '416-2' ? '114學年舊幹部' : undefined,
  }));
}

export function getRosterVersions(): RosterVersion[] {
  try {
    const raw = localStorage.getItem(ROSTER_VERSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Upgrade check: ensure 4th floor has all 32 rooms (401 ~ 432) from architectural blueprint
        const fullSample = generateInitialMockResidents();
        let changed = false;
        const upgraded = parsed.map((version: RosterVersion) => {
          const existingIds = new Set(version.residents.map(r => r.id));
          const missing = fullSample.filter(sr => sr.floor === '4' && !existingIds.has(sr.id));
          if (missing.length > 0) {
            changed = true;
            return {
              ...version,
              residents: [...version.residents, ...missing],
            };
          }
          return version;
        });

        if (changed) {
          saveRosterVersions(upgraded);
          return upgraded;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load roster versions from storage', e);
  }

  // Initial seed with two versions: 115 latest (active) and 114 historical
  const initial115Residents = generateInitialMockResidents();
  const initial114Residents = generateSample114HistoricalResidents();

  const initialVersions: RosterVersion[] = [
    {
      id: 'roster-115-latest',
      name: '115 學年度最新在宿名單',
      effectiveDate: '2026-09-01',
      createdAt: Date.now(),
      isCurrent: true,
      residents: initial115Residents,
      note: '包含 11527xxx 新學號，416-2 黃柏翰幹部等 180 位住宿生',
    },
    {
      id: 'roster-114-historical',
      name: '114 學年度第 2 學期歷史名單',
      effectiveDate: '2026-02-15',
      createdAt: Date.now() - 86400000 * 180,
      isCurrent: false,
      residents: initial114Residents,
      note: '封存之 114 學年舊名單，供回溯歷史點名紀錄比對',
    },
  ];

  saveRosterVersions(initialVersions);
  return initialVersions;
}

export function saveRosterVersions(versions: RosterVersion[]): void {
  try {
    localStorage.setItem(ROSTER_VERSIONS_KEY, JSON.stringify(versions));
  } catch (e) {
    console.error('Failed to save roster versions', e);
  }
}

export function getActiveRosterVersion(): RosterVersion {
  const versions = getRosterVersions();
  return versions.find(v => v.isCurrent) || versions[0];
}

export function setActiveRosterVersion(versionId: string): RosterVersion[] {
  const versions = getRosterVersions();
  const updated = versions.map(v => ({
    ...v,
    isCurrent: v.id === versionId,
  }));
  saveRosterVersions(updated);
  return updated;
}

export function addNewRosterVersion(
  name: string,
  effectiveDate: string,
  residents: Resident[],
  setAsCurrent: boolean,
  note?: string
): RosterVersion[] {
  const versions = getRosterVersions();
  const newId = `roster-${Date.now()}`;

  const newVersion: RosterVersion = {
    id: newId,
    name,
    effectiveDate,
    createdAt: Date.now(),
    isCurrent: setAsCurrent,
    residents,
    note,
  };

  const updated = versions.map(v => ({
    ...v,
    isCurrent: setAsCurrent ? false : v.isCurrent,
  }));
  updated.unshift(newVersion);

  saveRosterVersions(updated);
  return updated;
}

export function updateRosterVersionResidents(versionId: string, residents: Resident[]): RosterVersion[] {
  const versions = getRosterVersions();
  const updated = versions.map(v => {
    if (v.id === versionId) {
      return {
        ...v,
        residents,
      };
    }
    return v;
  });
  saveRosterVersions(updated);
  return updated;
}

export function deleteRosterVersion(versionId: string): RosterVersion[] {
  const versions = getRosterVersions();
  if (versions.length <= 1) {
    return versions;
  }
  const updated = versions.filter(v => v.id !== versionId);
  // If deleted was current, make the first one current
  if (!updated.some(v => v.isCurrent)) {
    updated[0].isCurrent = true;
  }
  saveRosterVersions(updated);
  return updated;
}

export function resetToDemoDatabase(): void {
  localStorage.removeItem(ROSTER_VERSIONS_KEY);
  localStorage.removeItem(SESSIONS_INDEX_KEY);
  getRosterVersions();
  // seed yesterday session
  const yesterday = new Date(Date.now() - 86400000);
  const yDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  getSession(yDate);
}

export function getSession(date: string): DailySession {
  try {
    const raw = localStorage.getItem(`${SESSIONS_PREFIX}${date}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to get session', e);
  }

  // Active roster
  const activeVersion = getActiveRosterVersion();

  // Create new session
  const newSession: DailySession = {
    date,
    rosterVersionId: activeVersion.id,
    records: {},
    completedRooms: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // If yesterday or past date, optionally seed realistic sample records if first time
  if (date !== getTodayDateString()) {
    seedPastDateSessionIfNeeded(newSession);
  }

  saveSession(newSession);
  return newSession;
}

export function saveSession(session: DailySession): void {
  try {
    session.updatedAt = Date.now();
    localStorage.setItem(`${SESSIONS_PREFIX}${session.date}`, JSON.stringify(session));

    // Update sessions index
    const index = getAllSessionDates();
    if (!index.includes(session.date)) {
      index.push(session.date);
      index.sort().reverse();
      localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(index));
    }
  } catch (e) {
    console.error('Failed to save session', e);
  }
}

export function getAllSessionDates(): string[] {
  try {
    const raw = localStorage.getItem(SESSIONS_INDEX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to get session dates', e);
  }
  return [getTodayDateString()];
}

function seedPastDateSessionIfNeeded(session: DailySession): void {
  // Let's seed sample records for 4th floor rooms so query mode has instant rich data
  const residents = getActiveRosterVersion().residents.filter(r => r.floor === '4');
  const now = Date.now();

  for (const r of residents) {
    let status: 'present' | 'absent' | 'leave' | 'late' = 'present';
    let note: string | undefined = undefined;

    // Simulate realistic absences and leaves
    if (r.id === '405-3') {
      status = 'absent';
      note = '電話未接、室友稱去夜市';
    } else if (r.id === '412-1') {
      status = 'leave';
      note = '家因請假返鄉';
    } else if (r.id === '418-4') {
      status = 'late';
      note = '實驗室專案 23:30返宿';
    } else if (r.id === '408-2') {
      status = 'absent';
      note = '敲門無回應/房門未開';
    }

    session.records[r.id] = {
      residentId: r.id,
      status,
      note,
      updatedAt: now - 3600000,
    };
  }

  // Mark 401~420 as completed
  for (let rm = 401; rm <= 420; rm++) {
    session.completedRooms.push(rm.toString());
  }
}

/**
 * Full database JSON export for backup / transfer across devices
 */
export function exportFullDatabaseJSON(): string {
  const versions = getRosterVersions();
  const dates = getAllSessionDates();
  const sessions: Record<string, DailySession> = {};

  for (const d of dates) {
    sessions[d] = getSession(d);
  }

  const payload = {
    app: 'dorm_rollcall_assistant',
    exportedAt: new Date().toISOString(),
    version: 2,
    rosterVersions: versions,
    sessionDates: dates,
    sessions,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Full database JSON import
 */
export function importFullDatabaseJSON(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.rosterVersions || !Array.isArray(data.rosterVersions)) {
      throw new Error('名單格式不正確');
    }
    saveRosterVersions(data.rosterVersions);

    if (data.sessions && typeof data.sessions === 'object') {
      const dates = Object.keys(data.sessions);
      for (const d of dates) {
        saveSession(data.sessions[d]);
      }
    }
    return true;
  } catch (err) {
    console.error('Import failed', err);
    return false;
  }
}

/**
 * Authentication & Cadre Accounts Storage
 */
export function getAuthConfig(): AuthConfig {
  try {
    const raw = localStorage.getItem(AUTH_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.adminPassword && parsed.cadreOfflinePasscode) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load auth config', e);
  }

  const initialConfig: AuthConfig = {
    adminPassword: 'admin888',
    cadreOfflinePasscode: 'dorm2026',
    registeredCadres: [
      {
        id: 'cadre-default-1',
        name: '416-2 樓長 (黃柏翰)',
        role: 'cadre',
        assignedFloor: '4',
        createdAt: Date.now(),
        note: '4樓總點名幹部',
      },
      {
        id: 'cadre-default-2',
        name: '3F 樓長',
        role: 'cadre',
        assignedFloor: '3',
        createdAt: Date.now(),
      },
    ],
  };

  saveAuthConfig(initialConfig);
  return initialConfig;
}

export function saveAuthConfig(config: AuthConfig): void {
  try {
    localStorage.setItem(AUTH_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save auth config', e);
  }
}

export function getUserSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to get user session', e);
  }
  return null;
}

export function saveUserSession(session: UserSession | null): void {
  try {
    if (session) {
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(USER_SESSION_KEY);
    }
  } catch (e) {
    console.error('Failed to save user session', e);
  }
}

/**
 * Audit Log Storage (操作稽核日誌)
 */
export function getAuditLogs(): AuditLog[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load audit logs', e);
  }

  // Initial seed log
  const initialLogs: AuditLog[] = [
    {
      id: 'log-init-1',
      timestamp: Date.now() - 3600000 * 2,
      operatorName: '系統管理員 (Admin)',
      role: 'admin',
      action: 'ROSTER_IMPORT',
      actionName: '系統初始建置',
      description: '初始化 115 學年度住宿生名單 (共 180 筆)',
    },
  ];
  saveAuditLogs(initialLogs);
  return initialLogs;
}

export function saveAuditLogs(logs: AuditLog[]): void {
  try {
    // Keep max 500 logs to avoid storage bloat
    const trimmed = logs.slice(0, 500);
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save audit logs', e);
  }
}

export function addAuditLog(entry: AuditLog): AuditLog[] {
  const logs = getAuditLogs();
  logs.unshift(entry);
  saveAuditLogs(logs);
  return logs;
}

export function pruneAuditLogs(keepDays: number = 90): AuditLog[] {
  const cutoff = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
  const logs = getAuditLogs();
  const kept = logs.filter(l => l.timestamp >= cutoff);
  saveAuditLogs(kept);
  return kept;
}

