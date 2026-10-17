/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Resident, DailySession, AttendanceRecord, AttendanceStatus, RosterVersion } from './types/dorm.ts';
import { AuthConfig, AuditLog, UserSession } from './types/auth.ts';
import {
  getRosterVersions,
  getActiveRosterVersion,
  setActiveRosterVersion,
  addNewRosterVersion,
  updateRosterVersionResidents,
  deleteRosterVersion,
  getSession,
  saveSession,
  getTodayDateString,
  getAllSessionDates,
  exportFullDatabaseJSON,
  importFullDatabaseJSON,
  resetToDemoDatabase,
  getAuthConfig,
  saveAuthConfig,
  getUserSession,
  saveUserSession,
  getAuditLogs,
  addAuditLog,
  saveAuditLogs,
  saveRosterVersions,
} from './utils/storage.ts';
import { createAuditLogEntry } from './utils/authLogic.ts';
import { queueSyncAction, processSyncQueue } from './utils/syncManager.ts';
import { fetchFromSupabase, setupSupabaseRealtime } from './utils/supabaseClient.ts';
import { Navbar, AppMode } from './components/Navbar.tsx';
import { RollCallMode } from './components/RollCallMode.tsx';
import { QueryMode } from './components/QueryMode.tsx';
import { RosterManager } from './components/RosterManager.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { AdminPanel } from './components/AdminPanel.tsx';
import { NetworkStatusBar } from './components/NetworkStatusBar.tsx';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => getUserSession());
  const [authConfig, setAuthConfig] = useState<AuthConfig>(() => getAuthConfig());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => getAuditLogs());
  const [loggedOutMsg, setLoggedOutMsg] = useState<string | null>(null);

  // App navigation & data state
  const [currentMode, setCurrentMode] = useState<AppMode>('rollcall');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString);
  const [rosterVersions, setRosterVersions] = useState<RosterVersion[]>(() => getRosterVersions());
  const [session, setSession] = useState<DailySession>(() => getSession(getTodayDateString()));
  const [selectedFloor, setSelectedFloor] = useState<string>('4');
  const [allSessionDates, setAllSessionDates] = useState<string[]>(() => getAllSessionDates());

  // Remember last active room so returning to roll call restores exact room
  const [activeRoom, setActiveRoom] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('dorm_last_active_room');
      if (saved) return saved;
    } catch (e) {}
    return '416';
  });

  const handleSelectRoom = (room: string) => {
    setActiveRoom(room);
    try {
      localStorage.setItem('dorm_last_active_room', room);
    } catch (e) {}
    const floor = room.length >= 3 ? room.charAt(0) : '4';
    if (floor && selectedFloor !== 'all' && selectedFloor !== floor) {
      setSelectedFloor(floor);
    }
  };

  const handleUpdateResident = (updatedResident: Resident, originalResidentId: string) => {
    const currentVersion = activeVersion;
    const updatedResidents = currentVersion.residents.map(r => r.id === originalResidentId ? updatedResident : r);
    if (!currentVersion.residents.some(r => r.id === originalResidentId)) {
      updatedResidents.push(updatedResident);
    }
    const updatedVersions = updateRosterVersionResidents(currentVersion.id, updatedResidents);
    setRosterVersions(updatedVersions);
    saveRosterVersions(updatedVersions);
    queueSyncAction('roster', updatedVersions);

    if (currentUser) {
      const log = createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'ROSTER_EDIT',
        '修改人員資料與身分標籤',
        `更新住宿生：${updatedResident.name} (${updatedResident.room}-${updatedResident.bed})${updatedResident.tag ? ` [標籤: ${updatedResident.tag}]` : ''}`
      );
      setAuditLogs(addAuditLog(log));
      queueSyncAction('audit', log);
    }
  };

  // Background cloud hydration and offline queue processing on startup
  useEffect(() => {
    processSyncQueue();
    fetchFromSupabase()
      .then(res => {
        if (res.success) {
          if (res.rosterVersions && res.rosterVersions.length > 0) {
            setRosterVersions(res.rosterVersions);
            saveRosterVersions(res.rosterVersions);
          } else {
            // Seed initial roster versions if table is empty
            queueSyncAction('roster', rosterVersions);
          }

          if (res.sessions && res.sessions[selectedDate]) {
            setSession(res.sessions[selectedDate]);
          }

          if (res.authConfig) {
            setAuthConfig(res.authConfig);
            saveAuthConfig(res.authConfig);
          } else {
            // Seed initial auth config if table is empty
            queueSyncAction('auth', authConfig);
          }

          if (res.auditLogs && res.auditLogs.length > 0) {
            setAuditLogs(res.auditLogs);
            saveAuditLogs(res.auditLogs);
          }
        }
      })
      .catch(err => {
        console.warn('Initial Supabase fetch skipped or offline', err);
      });
  }, [selectedDate]);

  // Realtime multi-user live synchronization across all 4 Supabase tables
  useEffect(() => {
    const cleanup = setupSupabaseRealtime({
      onSessionChange: updatedSession => {
        if (updatedSession.date === selectedDate) {
          setSession(updatedSession);
          saveSession(updatedSession);
        }
      },
      onRosterChange: () => {
        fetchFromSupabase().then(res => {
          if (res.rosterVersions && res.rosterVersions.length > 0) {
            setRosterVersions(res.rosterVersions);
            saveRosterVersions(res.rosterVersions);
          }
        });
      },
      onAuthConfigChange: updatedConfig => {
        setAuthConfig(updatedConfig);
        saveAuthConfig(updatedConfig);
      },
      onAuditLogAdded: newLog => {
        setAuditLogs(prev => {
          if (prev.some(l => l.id === newLog.id)) return prev;
          const updated = [newLog, ...prev].slice(0, 300);
          saveAuditLogs(updated);
          return updated;
        });
      },
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [selectedDate]);

  // Active roster version
  const activeVersion = useMemo(() => {
    return rosterVersions.find(v => v.isCurrent) || rosterVersions[0];
  }, [rosterVersions]);

  // Query roster version: if session has a saved rosterVersionId, use that; otherwise active version
  const [queryVersionId, setQueryVersionId] = useState<string>(() => activeVersion.id);

  useEffect(() => {
    if (session.rosterVersionId) {
      setQueryVersionId(session.rosterVersionId);
    } else {
      setQueryVersionId(activeVersion.id);
    }
  }, [session, activeVersion]);

  // Target residents for current mode
  const currentResidents = useMemo(() => {
    if (currentMode === 'query') {
      const v = rosterVersions.find(ver => ver.id === queryVersionId);
      return v ? v.residents : activeVersion.residents;
    }
    return activeVersion.residents;
  }, [currentMode, queryVersionId, rosterVersions, activeVersion]);

  // Reload session whenever selectedDate changes
  useEffect(() => {
    const currentSession = getSession(selectedDate);
    setSession(currentSession);
    setAllSessionDates(getAllSessionDates());
  }, [selectedDate]);

  // Auth Handlers
  const handleLoginSuccess = ({
    session: newSession,
    updatedAuthConfig,
    isNewCadre,
    keepLoggedIn,
  }: {
    session: UserSession;
    updatedAuthConfig?: AuthConfig;
    isNewCadre?: boolean;
    keepLoggedIn: boolean;
  }) => {
    setLoggedOutMsg(null);

    // If new cadre was auto-registered, persist updated AuthConfig & sync to Supabase
    if (updatedAuthConfig) {
      saveAuthConfig(updatedAuthConfig);
      setAuthConfig(updatedAuthConfig);
      queueSyncAction('auth', updatedAuthConfig);
    }

    if (keepLoggedIn) {
      saveUserSession(newSession);
    } else {
      // transient session only
      saveUserSession(newSession);
    }
    setCurrentUser(newSession);

    // Audit log
    const actionDesc = isNewCadre
      ? `新幹部「${newSession.username}」首次登入，系統已自動為其建立幹部帳號`
      : `${newSession.username} (${newSession.role === 'admin' ? '總管理員' : '幹部'}) 登入點名系統`;

    const log = createAuditLogEntry(
      newSession.username,
      newSession.role,
      'ACCOUNT_MANAGE',
      isNewCadre ? '新幹部自主註冊' : '幹部登入',
      actionDesc
    );
    const updatedLogs = addAuditLog(log);
    setAuditLogs(updatedLogs);
    queueSyncAction('audit', log);

    if (newSession.role === 'admin') {
      setCurrentMode('admin');
    } else {
      setCurrentMode('rollcall');
    }
  };

  const handleLogout = () => {
    if (currentUser) {
      const log = createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'ACCOUNT_MANAGE',
        '幹部登出',
        `${currentUser.username} 登出點名系統`
      );
      const updatedLogs = addAuditLog(log);
      setAuditLogs(updatedLogs);
      queueSyncAction('audit', log);
    }
    saveUserSession(null);
    setCurrentUser(null);
    setLoggedOutMsg('您已安全登出系統。');
  };

  const handleUpdateAuthConfig = (newConfig: AuthConfig) => {
    saveAuthConfig(newConfig);
    setAuthConfig(newConfig);
    queueSyncAction('auth', newConfig);
  };

  const handleAddAuditLog = (entry: AuditLog) => {
    const updated = addAuditLog(entry);
    setAuditLogs(updated);
    queueSyncAction('audit', entry);
  };

  // Handler for saving records of a room in Roll Call mode (auto-save or manual save)
  const handleSaveRoomRecords = (
    room: string,
    records: Record<string, AttendanceRecord>,
    _advanceToNext: boolean
  ) => {
    setSession(prev => {
      const updatedRecords = { ...prev.records, ...records };
      const completedRoomsSet = new Set(prev.completedRooms);

      // Check if all residents in this room are now actually marked
      const roomResidents = activeVersion.residents.filter(r => r.room === room);
      const isRoomFullyMarked = roomResidents.length > 0 && roomResidents.every(r => {
        const rec = updatedRecords[r.id];
        return rec && rec.status !== 'unmarked';
      });

      if (isRoomFullyMarked) {
        completedRoomsSet.add(room);
      } else {
        completedRoomsSet.delete(room);
      }

      const nextSession: DailySession = {
        ...prev,
        rosterVersionId: activeVersion.id,
        records: updatedRecords,
        completedRooms: Array.from(completedRoomsSet),
        updatedAt: Date.now(),
      };

      saveSession(nextSession);
      queueSyncAction('session', nextSession);
      return nextSession;
    });

    // Record audit trail of roll call operation
    if (currentUser) {
      const changedResidents = Object.values(records);
      const presentCount = changedResidents.filter(r => r.status === 'present').length;
      const absentCount = changedResidents.filter(r => r.status === 'absent').length;
      const leaveCount = changedResidents.filter(r => r.status === 'leave').length;
      const hasDoorUnopened = changedResidents.some(r => r.note?.includes('未開門'));

      let summaryDesc = `${room} 房點名存檔 (已到:${presentCount}, 未到:${absentCount}, 請假:${leaveCount})`;
      if (hasDoorUnopened) {
        summaryDesc = `${room} 房一鍵全員未到 (此房間未開門)`;
      }

      const log = createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'ROLL_CALL',
        '房間點名',
        summaryDesc,
        { room, date: selectedDate }
      );
      const updatedLogs = addAuditLog(log);
      setAuditLogs(updatedLogs);
      queueSyncAction('audit', log);
    }
  };

  // Handler for updating a single student's status (e.g. from Query mode or quick edit)
  const handleUpdateRecord = (
    residentId: string,
    status: AttendanceStatus,
    note?: string
  ) => {
    setSession(prev => {
      const updatedRecords = {
        ...prev.records,
        [residentId]: {
          residentId,
          status,
          note,
          updatedAt: Date.now(),
        },
      };

      const resident = currentResidents.find(r => r.id === residentId);
      const room = resident?.room;
      const completedRoomsSet = new Set(prev.completedRooms);

      if (room) {
        const roomResidents = currentResidents.filter(r => r.room === room);
        const isRoomFullyMarked = roomResidents.every(r => {
          const rec = updatedRecords[r.id];
          return rec && rec.status !== 'unmarked';
        });

        if (isRoomFullyMarked) {
          completedRoomsSet.add(room);
        } else {
          completedRoomsSet.delete(room);
        }
      }

      const nextSession: DailySession = {
        ...prev,
        rosterVersionId: queryVersionId || activeVersion.id,
        records: updatedRecords,
        completedRooms: Array.from(completedRoomsSet),
        updatedAt: Date.now(),
      };

      saveSession(nextSession);
      queueSyncAction('session', nextSession);
      return nextSession;
    });

    if (currentUser) {
      const resident = currentResidents.find(r => r.id === residentId);
      const residentName = resident ? `${resident.room}-${resident.bed} ${resident.name}` : residentId;
      const statusMap: Record<AttendanceStatus, string> = {
        present: '已到',
        absent: '未到',
        leave: '請假',
        late: '晚歸',
        unmarked: '待確認',
      };

      const log = createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'ROLL_CALL',
        '個別狀態修改',
        `修改 ${residentName} 點名狀態為「${statusMap[status]}」${note ? ` (${note})` : ''}`,
        { residentId, status, note, date: selectedDate }
      );
      const updatedLogs = addAuditLog(log);
      setAuditLogs(updatedLogs);
      queueSyncAction('audit', log);
    }
  };

  // Roster Version Management Handlers
  const handleSetActiveVersion = (versionId: string) => {
    setActiveRosterVersion(versionId);
    const updated = getRosterVersions();
    setRosterVersions(updated);
    queueSyncAction('roster', updated);

    if (currentUser) {
      const v = updated.find(ver => ver.id === versionId);
      const log = createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'VERSION_SWITCH',
        '切換名冊版本',
        `切換目前預設在宿名冊為：「${v?.name || versionId}」`
      );
      setAuditLogs(addAuditLog(log));
      queueSyncAction('audit', log);
    }
  };

  const handleAddNewVersion = (
    name: string,
    effectiveDate: string,
    residents: Resident[],
    setAsCurrent: boolean,
    note?: string
  ) => {
    addNewRosterVersion(name, effectiveDate, residents, setAsCurrent, note);
    const updated = getRosterVersions();
    setRosterVersions(updated);
    queueSyncAction('roster', updated);

    if (currentUser) {
      const log = createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'ROSTER_IMPORT',
        '新增名冊版本',
        `成功匯入並建立新名冊「${name}」(${residents.length}人)${setAsCurrent ? ' 並設為最新預設' : ''}`
      );
      setAuditLogs(addAuditLog(log));
      queueSyncAction('audit', log);
    }
  };

  const handleUpdateVersionResidents = (versionId: string, residents: Resident[]) => {
    updateRosterVersionResidents(versionId, residents);
    const updated = getRosterVersions();
    setRosterVersions(updated);
    queueSyncAction('roster', updated);

    if (currentUser) {
      const v = updated.find(ver => ver.id === versionId);
      const log = createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'ROSTER_EDIT',
        '編輯名冊人員',
        `調整名冊「${v?.name}」人員資料，現存住宿生人數：${residents.length} 人`
      );
      setAuditLogs(addAuditLog(log));
      queueSyncAction('audit', log);
    }
  };

  const handleDeleteVersion = (versionId: string) => {
    const toDelete = rosterVersions.find(v => v.id === versionId);
    const success = deleteRosterVersion(versionId);
    if (success) {
      const updated = getRosterVersions();
      setRosterVersions(updated);
      queueSyncAction('roster', updated);

      if (currentUser) {
        const log = createAuditLogEntry(
          currentUser.username,
          currentUser.role,
          'ROSTER_EDIT',
          '刪除名冊版本',
          `刪除歷史名冊版本：「${toDelete?.name || versionId}」`
        );
        setAuditLogs(addAuditLog(log));
        queueSyncAction('audit', log);
      }
    }
  };

  const handleExportDatabase = () => {
    const jsonStr = exportFullDatabaseJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `宿舍點名系統_完整資料庫備份_${selectedDate}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (currentUser) {
      const log = createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'DATABASE_OP',
        '資料庫匯出',
        `下載並匯出完整點名系統 JSON 備份檔案`
      );
      setAuditLogs(addAuditLog(log));
      queueSyncAction('audit', log);
    }
  };

  const handleImportDatabase = (jsonStr: string): boolean => {
    const success = importFullDatabaseJSON(jsonStr);
    if (success) {
      const updatedVersions = getRosterVersions();
      setRosterVersions(updatedVersions);
      setSession(getSession(selectedDate));
      setAllSessionDates(getAllSessionDates());
      queueSyncAction('roster', updatedVersions);

      if (currentUser) {
        const log = createAuditLogEntry(
          currentUser.username,
          currentUser.role,
          'DATABASE_OP',
          '還原資料庫備份',
          `成功匯入並覆蓋本機資料庫 JSON 備份`
        );
        setAuditLogs(addAuditLog(log));
        queueSyncAction('audit', log);
      }
    }
    return success;
  };

  const handleResetDatabase = () => {
    resetToDemoDatabase();
    const updatedVersions = getRosterVersions();
    setRosterVersions(updatedVersions);
    setSession(getSession(selectedDate));
    setAllSessionDates(getAllSessionDates());
    queueSyncAction('roster', updatedVersions);

    if (currentUser) {
      const log = createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'DATABASE_OP',
        '重設示範資料庫',
        `重設資料庫為預設示範資料 (416-2 黃柏翰幹部等180人)`
      );
      setAuditLogs(addAuditLog(log));
      queueSyncAction('audit', log);
    }
  };

  // If user is not logged in, render the Secure Login Screen with top Network Status Bar
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col font-sans antialiased">
        <NetworkStatusBar />
        <div className="flex-1 w-full flex flex-col items-center justify-start sm:justify-center overflow-y-auto">
          <LoginScreen
            authConfig={authConfig}
            onLoginSuccess={handleLoginSuccess}
            loggedOutMessage={loggedOutMsg}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Real-time Network & Supabase Offline Sync Bar at Top */}
      <NetworkStatusBar onOpenSettings={() => setCurrentMode('roster')} />

      <Navbar
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
        selectedDate={selectedDate}
        totalResidents={currentResidents.length}
        rosterVersionName={currentMode === 'query' ? (rosterVersions.find(v => v.id === queryVersionId)?.name || activeVersion.name) : activeVersion.name}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main container: expands to max-w-7xl on desktop for query/roster/admin, keeps max-w-md on rollcall */}
      <main className={`flex-1 w-full mx-auto ${
        currentMode === 'query' || currentMode === 'roster' || currentMode === 'admin'
          ? 'max-w-7xl'
          : 'max-w-md'
      }`}>
        {currentMode === 'rollcall' && (
          <RollCallMode
            residents={activeVersion.residents}
            session={session}
            onSaveRoomRecords={handleSaveRoomRecords}
            selectedFloor={selectedFloor}
            onSelectFloor={setSelectedFloor}
            currentRoom={activeRoom}
            onSelectRoom={handleSelectRoom}
            onUpdateResident={handleUpdateResident}
          />
        )}

        {currentMode === 'query' && (
          <QueryMode
            residents={currentResidents}
            session={session}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            allSessionDates={allSessionDates}
            onUpdateRecord={handleUpdateRecord}
            rosterVersions={rosterVersions}
            currentRosterVersion={rosterVersions.find(v => v.id === queryVersionId) || activeVersion}
            onSelectRosterVersion={setQueryVersionId}
            onGoToRollCallRoom={(room) => {
              handleSelectRoom(room);
              setCurrentMode('rollcall');
            }}
          />
        )}

        {currentMode === 'roster' && (
          <RosterManager
            rosterVersions={rosterVersions}
            currentRosterVersion={activeVersion}
            onSetActiveVersion={handleSetActiveVersion}
            onAddNewVersion={handleAddNewVersion}
            onUpdateVersionResidents={handleUpdateVersionResidents}
            onDeleteVersion={handleDeleteVersion}
            onExportDatabase={handleExportDatabase}
            onImportDatabase={handleImportDatabase}
            onResetDatabase={handleResetDatabase}
            onRefreshSessions={() => {
              setSession(getSession(selectedDate));
              setRosterVersions(getRosterVersions());
            }}
          />
        )}

        {currentMode === 'admin' && currentUser.role === 'admin' && (
          <AdminPanel
            authConfig={authConfig}
            onUpdateAuthConfig={handleUpdateAuthConfig}
            auditLogs={auditLogs}
            onAddAuditLog={handleAddAuditLog}
            currentUser={currentUser}
          />
        )}
      </main>
    </div>
  );
}
