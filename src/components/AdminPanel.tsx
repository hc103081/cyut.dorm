import React, { useState, useMemo, useEffect } from 'react';
import { AuthConfig, AuditLog, CadreAccount, UserSession } from '../types/auth.ts';
import { filterAuditLogs, createAuditLogEntry } from '../utils/authLogic.ts';
import {
  testSupabaseDetailedStatus,
  getSupabaseSQLSchema,
  getSupabaseConnectionInfo,
  syncLocalToSupabase,
  fetchFromSupabase,
  SupabaseDetailedStatus,
} from '../utils/supabaseClient.ts';
import { getRosterVersions, getAllSessionDates, getSession } from '../utils/storage.ts';
import { ResidentTagBadge } from './ResidentTagBadge.tsx';
import { CadreEditModal } from './CadreEditModal.tsx';
import { TagEditModal } from './TagEditModal.tsx';
import {
  ShieldCheck,
  KeyRound,
  Users,
  History,
  Lock,
  Plus,
  Trash2,
  Search,
  Check,
  AlertCircle,
  Clock,
  Download,
  Filter,
  UserCheck,
  RotateCcw,
  Sparkles,
  Shield,
  Eye,
  EyeOff,
  Database,
  Globe,
  UploadCloud,
  CheckCircle2,
  Copy,
  Server,
  RefreshCw,
  Layers,
  XCircle,
  Edit3,
  HardDrive,
  Gauge,
  Archive,
  TrendingUp,
  Power,
  Phone,
  ShieldAlert,
  Crown,
  Star,
  Award,
  Tag
} from 'lucide-react';

interface AdminPanelProps {
  authConfig: AuthConfig;
  onUpdateAuthConfig: (newConfig: AuthConfig) => void;
  auditLogs: AuditLog[];
  onAddAuditLog: (entry: AuditLog) => void;
  currentUser: UserSession;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  authConfig,
  onUpdateAuthConfig,
  auditLogs,
  onAddAuditLog,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'passcode_and_users' | 'supabase_status' | 'audit_history'>('passcode_and_users');
  const [cadrePasscode, setCadrePasscode] = useState<string>(authConfig.cadreOfflinePasscode);
  const [adminPasscode, setAdminPasscode] = useState<string>(authConfig.adminPassword);
  const [showAdminPass, setShowAdminPass] = useState<boolean>(false);
  const [showCadrePass, setShowCadrePass] = useState<boolean>(true);

  // Supabase live status state
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseDetailedStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState<boolean>(false);
  const [copySQLToast, setCopySQLToast] = useState<boolean>(false);

  // Check Supabase status on mount or tab switch
  const checkSupabaseStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await testSupabaseDetailedStatus();
      setSupabaseStatus(res);
    } catch (e: any) {
      console.error('Failed to check supabase status', e);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    checkSupabaseStatus();
  }, []);

  // New cadre form
  const [newCadreName, setNewCadreName] = useState<string>('');
  const [newCadreFloor, setNewCadreFloor] = useState<string>('4');
  const [newCadreTag, setNewCadreTag] = useState<string>('幹部');
  const [newCadreNote, setNewCadreNote] = useState<string>('');
  const [newCadreCustomPass, setNewCadreCustomPass] = useState<string>('');

  // Cadre editing and status management
  const [editingCadre, setEditingCadre] = useState<CadreAccount | null>(null);
  const [tagEditingCadre, setTagEditingCadre] = useState<CadreAccount | null>(null);
  const [cadreToDelete, setCadreToDelete] = useState<CadreAccount | null>(null);
  const [quickConfirmCadreId, setQuickConfirmCadreId] = useState<string | null>(null);
  const [cadreFilterTag, setCadreFilterTag] = useState<string>('all');

  // Audit filter state
  const [logSearch, setLogSearch] = useState<string>('');
  const [logActionFilter, setLogActionFilter] = useState<string>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pruneConfirmCount, setPruneConfirmCount] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Filtered audit logs
  const filteredLogs = useMemo(() => {
    return filterAuditLogs(auditLogs, logSearch, logActionFilter);
  }, [auditLogs, logSearch, logActionFilter]);

  // Database capacity calculations for Supabase Free Tier (500 MB)
  const rosterVersions = getRosterVersions();
  const sessionDates = getAllSessionDates();
  const totalResidentsCount = rosterVersions.reduce((acc, v) => acc + (v.residents?.length || 0), 0);
  const activeResidentsCount = rosterVersions.find(v => v.isCurrent)?.residents.length || 0;
  
  // Storage estimation:
  // 1 resident JSON object: ~0.15 KB
  // 1 daily session (180 bed records): ~35 KB
  // 1 audit log entry: ~0.5 KB
  // auth config: ~2 KB
  const estRosterKb = totalResidentsCount * 0.15;
  const estSessionKb = sessionDates.length * 35;
  const estAuditKb = auditLogs.length * 0.5;
  const estTotalKb = estRosterKb + estSessionKb + estAuditKb + 2;
  const estTotalMb = (estTotalKb / 1024).toFixed(2);
  const freeTierLimitMb = 500;
  const storageUsagePercent = ((parseFloat(estTotalMb) / freeTierLimitMb) * 100).toFixed(3);

  // Estimated years remaining at 1 session/day (~35KB/day = ~12.8MB/year)
  const yearsRemaining = ((freeTierLimitMb - parseFloat(estTotalMb)) / 12.8).toFixed(1);

  // Prune old logs handler (In-App Modal confirmation, safe for iframe)
  const handlePruneLogs = () => {
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const oldLogs = auditLogs.filter(l => l.timestamp < ninetyDaysAgo);
    if (oldLogs.length === 0) {
      showToast('目前所有異動日誌皆在 90 天內，無須清理！');
      return;
    }
    setPruneConfirmCount(oldLogs.length);
  };

  const executePruneLogs = () => {
    if (!pruneConfirmCount) return;
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const remaining = auditLogs.filter(l => l.timestamp >= ninetyDaysAgo);
    localStorage.setItem('dorm_audit_logs_v2', JSON.stringify(remaining));
    showToast(`已成功清理 ${pruneConfirmCount} 筆舊日誌！`);
    setPruneConfirmCount(null);
    setTimeout(() => window.location.reload(), 800);
  };

  // Save updated passcodes
  const handleSavePasscodes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cadrePasscode.trim()) {
      showToast('⚠️ 幹部線下通行密碼不能為空！');
      return;
    }
    if (!adminPasscode.trim()) {
      showToast('⚠️ 管理員最高密碼不能為空！');
      return;
    }

    const updated: AuthConfig = {
      ...authConfig,
      cadreOfflinePasscode: cadrePasscode.trim(),
      adminPassword: adminPasscode.trim(),
    };
    onUpdateAuthConfig(updated);

    onAddAuditLog(
      createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'ACCOUNT_MANAGE',
        '通行密碼更新',
        `Admin 變更了幹部線下通行密碼與管理密碼`
      )
    );

    showToast('密碼設定已成功儲存！請將新密碼線下傳達給各位幹部');
  };

  // Add individual registered cadre
  const handleAddCadre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCadreName.trim()) {
      showToast('⚠️ 請填寫幹部姓名');
      return;
    }

    const newCadre: CadreAccount = {
      id: `cadre-${Date.now()}`,
      name: newCadreName.trim(),
      role: 'cadre',
      assignedFloor: newCadreFloor === '全棟' ? undefined : newCadreFloor,
      tag: newCadreTag,
      status: 'active',
      note: newCadreNote.trim() || undefined,
      customPassword: newCadreCustomPass.trim() || undefined,
      createdAt: Date.now(),
    };

    const updatedCadres = [...authConfig.registeredCadres, newCadre];
    const updated: AuthConfig = {
      ...authConfig,
      registeredCadres: updatedCadres,
    };
    onUpdateAuthConfig(updated);

    onAddAuditLog(
      createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'ACCOUNT_MANAGE',
        '新增幹部帳號',
        `註冊新幹部：${newCadre.name} (${newCadre.assignedFloor ? `${newCadre.assignedFloor}樓` : '全棟'}, 職銜: ${newCadre.tag})`
      )
    );

    showToast(`已成功建立幹部帳號「${newCadre.name}」！`);
    setNewCadreName('');
    setNewCadreNote('');
    setNewCadreCustomPass('');
  };

  // Save edited cadre (status, name, floor, tag, password, phone, note)
  const handleSaveEditedCadre = (updatedCadre: CadreAccount) => {
    const updatedCadres = authConfig.registeredCadres.map(c =>
      c.id === updatedCadre.id ? updatedCadre : c
    );
    onUpdateAuthConfig({
      ...authConfig,
      registeredCadres: updatedCadres,
    });

    const statusLabel = updatedCadre.status === 'suspended' ? '已停用' : '啟用中';
    onAddAuditLog(
      createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'ACCOUNT_MANAGE',
        '編輯幹部資料',
        `修改幹部「${updatedCadre.name}」：狀態【${statusLabel}】、責任區【${updatedCadre.assignedFloor ? `${updatedCadre.assignedFloor}樓` : '全棟'}】、職銜【${updatedCadre.tag || '幹部'}】`
      )
    );

    showToast(`已成功更新幹部「${updatedCadre.name}」的資料與狀態！`);
    setEditingCadre(null);
  };

  // Quick toggle active / suspended status
  const handleToggleCadreStatus = (cadre: CadreAccount) => {
    const newStatus: 'active' | 'suspended' = cadre.status === 'suspended' ? 'active' : 'suspended';
    const updatedCadre: CadreAccount = {
      ...cadre,
      status: newStatus,
    };
    handleSaveEditedCadre(updatedCadre);
  };

  // Confirm delete cadre (direct execution)
  const confirmDirectDeleteCadre = (cadre: CadreAccount) => {
    const { id, name } = cadre;
    const updatedCadres = authConfig.registeredCadres.filter(c => c.id !== id);
    onUpdateAuthConfig({
      ...authConfig,
      registeredCadres: updatedCadres,
    });

    onAddAuditLog(
      createAuditLogEntry(
        currentUser.username,
        currentUser.role,
        'ACCOUNT_MANAGE',
        '移除幹部帳號',
        `移除幹部：${name}`
      )
    );

    showToast(`已成功移除幹部「${name}」！`);
    setCadreToDelete(null);
    setQuickConfirmCadreId(null);
  };

  // Trigger delete: double-click or modal
  const handleDeleteCadre = (cadre: CadreAccount) => {
    if (quickConfirmCadreId === cadre.id) {
      confirmDirectDeleteCadre(cadre);
      return;
    }
    setQuickConfirmCadreId(cadre.id);
    setCadreToDelete(cadre);
  };

  // Confirm delete cadre from modal
  const confirmDeleteCadre = () => {
    if (!cadreToDelete) return;
    confirmDirectDeleteCadre(cadreToDelete);
  };

  // Export audit logs as CSV
  const handleExportLogsCSV = () => {
    const headers = ['時間', '操作幹部姓名', '角色', '動作類型', '詳細紀錄'];
    const rows = filteredLogs.map(l => [
      new Date(l.timestamp).toLocaleString('zh-TW', { hour12: false }),
      `"${l.operatorName.replace(/"/g, '""')}"`,
      l.role === 'admin' ? '管理員(Admin)' : '幹部',
      `"${l.actionName}"`,
      `"${l.description.replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `宿舍點名系統操作異動稽核紀錄_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy Supabase SQL
  const handleCopySQL = () => {
    navigator.clipboard.writeText(getSupabaseSQLSchema()).then(() => {
      setCopySQLToast(true);
      showToast('已複製 Supabase 建表 SQL 語法！請至 Supabase Dashboard 貼上執行');
      setTimeout(() => setCopySQLToast(false), 2500);
    });
  };

  // Sync local to Supabase
  const handleSyncAllToSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const rosterVersions = getRosterVersions();
      const dates = getAllSessionDates();
      const sessionsMap: Record<string, any> = {};
      dates.forEach(d => {
        sessionsMap[d] = getSession(d);
      });

      const res = await syncLocalToSupabase(rosterVersions, sessionsMap, authConfig, auditLogs);
      showToast(res.message);
      await checkSupabaseStatus();
    } catch (e: any) {
      showToast(`同步失敗: ${e.message || e}`);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  // Fetch all from Supabase
  const handleFetchAllFromSupabase = async () => {
    setIsSyncingSupabase(true);
    try {
      const res = await fetchFromSupabase();
      showToast(res.message);
      await checkSupabaseStatus();
    } catch (e: any) {
      showToast(`下載失敗: ${e.message || e}`);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  return (
    <div className="w-full pb-24 px-3 pt-3 md:px-6 md:pt-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          {toastMsg}
        </div>
      )}

      {/* Header Banner */}
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-3xl mb-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">Admin 總幹部管理中心</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                最高權限
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              管理幹部線下通行密碼、帳號權限，以及全系統「誰在何時做了什麼」之詳細歷史異動日誌。
            </p>
          </div>
        </div>

        {/* Current user badge */}
        <div className="text-right">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>目前操作者: <strong>{currentUser.username}</strong></span>
          </span>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-4 text-xs font-medium max-w-4xl mx-auto">
        <button
          onClick={() => setActiveTab('passcode_and_users')}
          className={`flex-1 py-2 px-1.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-w-0 ${
            activeTab === 'passcode_and_users'
              ? 'bg-blue-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <KeyRound className="w-4 h-4 shrink-0" />
          <span className="truncate">
            <span className="hidden sm:inline">幹部密碼與帳號</span>
            <span className="sm:hidden">幹部帳密</span>
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('supabase_status');
            checkSupabaseStatus();
          }}
          className={`flex-1 py-2 px-1.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-w-0 ${
            activeTab === 'supabase_status'
              ? 'bg-blue-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4 shrink-0 text-emerald-400" />
          <span className="truncate flex items-center gap-1">
            <span className="hidden sm:inline">Supabase 雲端狀態</span>
            <span className="sm:hidden">雲端資料庫</span>
            {supabaseStatus && !supabaseStatus.tablesCreated && (
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" title="需要建表" />
            )}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit_history')}
          className={`flex-1 py-2 px-1.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-w-0 ${
            activeTab === 'audit_history'
              ? 'bg-blue-600 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4 shrink-0" />
          <span className="truncate">
            <span className="hidden sm:inline">異動歷史日誌</span>
            <span className="sm:hidden">稽核紀錄</span> ({auditLogs.length})
          </span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* TAB 1: PASSCODE & USERS */}
        {activeTab === 'passcode_and_users' && (
          <div className="space-y-4">
            {/* 1. Global Offline Passcode Settings */}
            <form onSubmit={handleSavePasscodes} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  <span>線下通行密碼配置</span>
                </span>
                <span className="text-[11px] text-emerald-400">
                  修改後幹部登入立刻生效
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cadre Offline Passcode */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-200">
                      幹部線下通行密碼 (給一般幹部)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCadrePass(!showCadrePass)}
                      className="text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1"
                    >
                      {showCadrePass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showCadrePass ? '隱藏' : '顯示'}</span>
                    </button>
                  </div>
                  <input
                    type={showCadrePass ? 'text' : 'password'}
                    value={cadrePasscode}
                    onChange={e => setCadrePasscode(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    幹部在登入頁輸入「自己的名字」加上「此密碼」即可成功登入，有效阻擋外人！
                  </p>
                </div>

                {/* Admin Password */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-200">
                      管理員最高密碼 (Admin 專用)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAdminPass(!showAdminPass)}
                      className="text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1"
                    >
                      {showAdminPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showAdminPass ? '隱藏' : '顯示'}</span>
                    </button>
                  </div>
                  <input
                    type={showAdminPass ? 'text' : 'password'}
                    value={adminPasscode}
                    onChange={e => setAdminPasscode(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-blue-300 font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    用於進入本 Admin 管理中心，預設為 <code>admin888</code>，建議自行修改。
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>儲存新密碼設定</span>
                </button>
              </div>
            </form>

            {/* 2. Registered Cadres Management */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>登錄幹部名單與分樓責任區</span>
                </span>
                <span className="text-xs text-slate-400">
                  共 {authConfig.registeredCadres.length} 位已登記幹部
                </span>
              </div>

              {/* Add New Cadre Form */}
              <form onSubmit={handleAddCadre} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 block">
                    ＋ 新增登錄幹部（亦可讓幹部直接於登入頁輸入名稱自填）
                  </span>
                  <span className="text-[11px] text-purple-400">
                    支援職銜標籤與自訂密碼
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                  <input
                    type="text"
                    placeholder="幹部姓名 (例: 王小明)"
                    value={newCadreName}
                    onChange={e => setNewCadreName(e.target.value)}
                    required
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                  <select
                    value={newCadreFloor}
                    onChange={e => setNewCadreFloor(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="4">4 樓責任區</option>
                    <option value="3">3 樓責任區</option>
                    <option value="2">2 樓責任區</option>
                    <option value="全棟">全棟幹部</option>
                  </select>
                  <select
                    value={newCadreTag}
                    onChange={e => setNewCadreTag(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="舍長">👑 舍長</option>
                    <option value="樓長">⭐ 樓長</option>
                    <option value="副樓長">🎖️ 副樓長</option>
                    <option value="室長">🛡️ 室長</option>
                    <option value="幹部">幹部</option>
                  </select>
                  <input
                    type="text"
                    placeholder="專屬密碼 (選填)"
                    value={newCadreCustomPass}
                    onChange={e => setNewCadreCustomPass(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="py-1.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
                  >
                    新增幹部
                  </button>
                </div>
              </form>

              {/* Tag Quick Filter & Overview Bar */}
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-purple-400" />
                    <span>身分職銜標籤快速篩選與管理：</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    點擊幹部標籤或「修改標籤」按鈕可隨時變更職銜
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-[11px]">
                  {[
                    { key: 'all', label: '全部幹部', count: authConfig.registeredCadres.length },
                    { key: '舍長', label: '👑 舍長', count: authConfig.registeredCadres.filter(c => c.tag === '舍長').length },
                    { key: '樓長', label: '⭐ 樓長', count: authConfig.registeredCadres.filter(c => c.tag === '樓長').length },
                    { key: '副樓長', label: '🎖️ 副樓長', count: authConfig.registeredCadres.filter(c => c.tag === '副樓長').length },
                    { key: '室長', label: '🛡️ 室長', count: authConfig.registeredCadres.filter(c => c.tag === '室長').length },
                    { key: '幹部', label: '🏷️ 幹部', count: authConfig.registeredCadres.filter(c => (c.tag || '幹部') === '幹部').length },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setCadreFilterTag(tab.key)}
                      className={`px-2.5 py-1 rounded-xl whitespace-nowrap transition-all cursor-pointer font-bold border ${
                        cadreFilterTag === tab.key
                          ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Cadres List */}
              <div className="space-y-2">
                {authConfig.registeredCadres
                  .filter(c => {
                    if (cadreFilterTag === 'all') return true;
                    return (c.tag || '幹部') === cadreFilterTag;
                  })
                  .map(c => {
                    const isSuspended = c.status === 'suspended';
                    return (
                      <div
                        key={c.id}
                        className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                          isSuspended
                            ? 'bg-rose-950/20 border-rose-800/40 opacity-80'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center border shrink-0 ${
                            isSuspended
                              ? 'bg-rose-950/40 text-rose-400 border-rose-800'
                              : 'bg-slate-800 text-purple-300 border-slate-700'
                          }`}>
                            {c.assignedFloor || '全'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-sm">{c.name}</span>
                              
                              {/* Clickable Role / Tag badge */}
                              <ResidentTagBadge
                                tag={c.tag || '幹部'}
                                size="xs"
                                onClick={() => setTagEditingCadre(c)}
                                className="cursor-pointer hover:ring-1 hover:ring-purple-400"
                              />

                              {/* Floor badge */}
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                                {c.assignedFloor ? `${c.assignedFloor} 樓負責人` : '全棟責任區'}
                              </span>

                              {/* Status badge */}
                              {isSuspended ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                  <span>已停用 (禁止登入)</span>
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>啟用中</span>
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                              <span>
                                密碼: {c.customPassword ? '個別專屬密碼' : `通用密碼 (${authConfig.cadreOfflinePasscode})`}
                              </span>
                              {c.phone && <span>• 📞 {c.phone}</span>}
                              {c.note && <span>• 備註: {c.note}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 flex-wrap justify-end">
                          {/* Direct Tag Edit Button */}
                          <button
                            type="button"
                            onClick={() => setTagEditingCadre(c)}
                            className="px-2.5 py-1.5 bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/80 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                            title="修改職銜身分標籤 (舍長/樓長/副樓長/室長/自訂)"
                          >
                            <Tag className="w-3.5 h-3.5 text-purple-400" />
                            <span>修改標籤</span>
                          </button>

                          {/* Edit Cadre Profile & Status */}
                          <button
                            type="button"
                            onClick={() => setEditingCadre(c)}
                            className="px-2.5 py-1.5 bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800/80 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                            title="編輯幹部詳細資料與密碼"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                            <span>編輯資料</span>
                          </button>

                          {/* Quick Toggle Status */}
                          <button
                            type="button"
                            onClick={() => handleToggleCadreStatus(c)}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors border shadow-sm ${
                              isSuspended
                                ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/80'
                                : 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border-amber-800/80'
                            }`}
                            title={isSuspended ? '恢復該幹部為啟用狀態' : '暫時停用該幹部登入權限'}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{isSuspended ? '恢復啟用' : '停用'}</span>
                          </button>

                          {/* Delete Cadre: Quick Inline Confirm or Trash Icon */}
                          {quickConfirmCadreId === c.id ? (
                            <div className="flex items-center gap-1 bg-rose-950/90 border border-rose-500 rounded-xl px-2 py-1 animate-fade-in shadow-md">
                              <span className="text-[10px] text-rose-200 font-bold whitespace-nowrap">確定移除？</span>
                              <button
                                type="button"
                                onClick={() => confirmDirectDeleteCadre(c)}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                移除
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickConfirmCadreId(null);
                                  setCadreToDelete(null);
                                }}
                                className="px-1.5 py-0.5 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteCadre(c)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/60 cursor-pointer transition-colors"
                              title="移除幹部"
                              aria-label={`移除幹部 ${c.name}`}
                            >
                              <Trash2 className="w-4 h-4 pointer-events-none" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUPABASE CLOUD DATABASE DIAGNOSTICS & MANAGEMENT */}
        {activeTab === 'supabase_status' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-base text-slate-100">
                    Supabase 雲端資料庫狀態與連線診斷
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                    Vercel 直連託管
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  本專案已設定由 Vercel 環境變數直接連線至 Supabase PostgreSQL，無須在前端手動輸入任何金鑰。
                </p>
              </div>

              <button
                type="button"
                onClick={checkSupabaseStatus}
                disabled={isCheckingStatus}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer self-start md:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                <span>{isCheckingStatus ? '檢測中...' : '重新檢測狀態'}</span>
              </button>
            </div>

            {/* Connection Overview Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${supabaseStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  <span className="text-xs font-bold text-slate-100">
                    Supabase 雲端連線狀態
                  </span>
                </div>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                  supabaseStatus?.connected
                    ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
                    : 'bg-rose-950/80 border-rose-800 text-rose-400'
                }`}>
                  {supabaseStatus?.connected ? 'API 連線正常' : '未連線 / 異常'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 text-xs space-y-2 font-mono">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-400 font-sans">專案網址 (URL):</span>
                  <span className="text-emerald-300 text-[11px] truncate max-w-sm">
                    {supabaseStatus?.url || getSupabaseConnectionInfo().url || '未設定'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-400 font-sans">API 金鑰 (Anon Key):</span>
                  <span className="text-slate-400 text-[11px]">
                    {getSupabaseConnectionInfo().maskedKey} (Vercel 安全託管)
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-400 font-sans">直連配置模式:</span>
                  <span className="text-blue-400 text-[11px] font-sans">
                    Vercel 自動注入環境變數 (免手動輸入 Key)
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Core Tables Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span>4 大核心資料表現況檢測：</span>
                </h4>
                {supabaseStatus && (
                  <span className="text-[11px] text-slate-400">
                    {supabaseStatus.tablesCreated ? '✅ 全部資料表就緒' : '⚠️ 4 個資料表尚未建立'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                {/* Table 1 */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-slate-200 font-semibold text-[11px]">
                      dorm_roster_versions
                    </div>
                    <div className="text-[11px] text-slate-400">宿舍名冊版本表 (包含 115 最新名冊)</div>
                  </div>
                  <div>
                    {supabaseStatus?.tableDetails.dorm_roster_versions ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>已就緒</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>尚未建立 (需執行 SQL)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Table 2 */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-slate-200 font-semibold text-[11px]">
                      dorm_daily_sessions
                    </div>
                    <div className="text-[11px] text-slate-400">每日點名紀錄表 (各房點名與備註)</div>
                  </div>
                  <div>
                    {supabaseStatus?.tableDetails.dorm_daily_sessions ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>已就緒</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>尚未建立 (需執行 SQL)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Table 3 */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-slate-200 font-semibold text-[11px]">
                      dorm_auth_config
                    </div>
                    <div className="text-[11px] text-slate-400">系統帳號與權限設定表 (密碼與幹部清單)</div>
                  </div>
                  <div>
                    {supabaseStatus?.tableDetails.dorm_auth_config ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>已就緒</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>尚未建立 (需執行 SQL)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Table 4 */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-slate-200 font-semibold text-[11px]">
                      dorm_audit_logs
                    </div>
                    <div className="text-[11px] text-slate-400">操作歷程稽核日誌表 (點名與帳密異動)</div>
                  </div>
                  <div>
                    {supabaseStatus?.tableDetails.dorm_audit_logs ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>已就緒</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>尚未建立 (需執行 SQL)</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnostic Message & SQL Instruction Alert */}
            {supabaseStatus && supabaseStatus.tablesCreated && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 space-y-2 text-xs text-emerald-200">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-sm text-emerald-300">
                      檢測成功：Supabase 4 大核心資料表已全部建立並連線就緒！
                    </span>
                    <p className="text-xs text-emerald-200/90 mt-1 leading-relaxed">
                      雲端 PostgreSQL 資料庫已完成初始化。本專案透過 Vercel 直連 Supabase，支援多幹部巡房即時同步（Realtime）與名冊版本、每日點名、密碼權限、操作稽核紀錄自動上傳。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {supabaseStatus && !supabaseStatus.tablesCreated && (
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 space-y-3 text-xs text-amber-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-sm text-amber-300">
                      檢測診斷：Supabase 連線成功，但 4 大資料表尚未在雲端建立！
                    </span>
                    <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                      Supabase 專案目前尚未執行資料表建立腳本。請按照下方步驟完成初次建表（僅需一次，約 30 秒）：
                    </p>
                    <ol className="list-decimal list-inside space-y-1 mt-2 text-[11px] text-slate-300">
                      <li>點擊下方<strong>「複製 Supabase 建表 SQL 語法」</strong>按鈕。</li>
                      <li>直接開啟您的專案：<a href="https://supabase.com/dashboard/project/qjlmelvzxoyopjvzisgg/sql/new" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-bold">Supabase SQL Editor (點此直達) ↗</a>。</li>
                      <li>在編輯器中<strong>貼上 (Ctrl+V / Cmd+V)</strong> 並點擊右下角綠色 <strong>Run</strong> 按鈕。</li>
                      <li>完成後回到本頁面點擊<strong>「重新檢測狀態」</strong>，即可看到 4 個資料表全部綠燈就緒！</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {/* SQL Copy & Preview Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>Supabase 資料表建立語法 (SQL Editor 一鍵貼上)</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopySQL}
                  className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                >
                  {copySQLToast ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copySQLToast ? '已複製！' : '一鍵複製 SQL 語法'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                本語法包含 4 大資料表、Row Level Security (RLS) 存取原則，以及 Realtime 多幹部實時推送發布設定：
              </p>

              <pre className="p-3 bg-slate-900 rounded-xl text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-40 border border-slate-800 leading-relaxed">
                {getSupabaseSQLSchema()}
              </pre>
            </div>

            {/* Data Sync & Fetch Actions */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-xs text-slate-200">
                資料同步與雲端資料備份操作
              </h4>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSyncAllToSupabase}
                  disabled={isSyncingSupabase}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{isSyncingSupabase ? '同步中...' : '將本機名冊與點名立即上傳至 Supabase'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleFetchAllFromSupabase}
                  disabled={isSyncingSupabase}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>從 Supabase 抓取雲端最新資料</span>
                </button>
              </div>
            </div>

            {/* Supabase Free Tier Capacity & Health Monitoring Section */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2 flex-wrap">
                      <span>Supabase 免費版 (500 MB) 容量監控與壽命試算</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                        健康度 100%
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      空間使用率極低 • 寒暑假休眠防護與過期日誌最佳化清理
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {estTotalMb} MB
                  </span>
                  <span className="text-slate-500 text-xs font-mono"> / 500 MB</span>
                </div>
              </div>

              {/* Capacity Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">目前資料庫空間使用率：</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {storageUsagePercent}% (負載極輕)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${Math.max(parseFloat(storageUsagePercent), 1)}%` }}
                  />
                </div>
              </div>

              {/* Capacity Breakdown Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">目前在宿人數</span>
                  <span className="font-bold text-white text-sm font-mono mt-0.5 block">
                    {activeResidentsCount} 人
                  </span>
                  <span className="text-[10px] text-slate-500">~{estRosterKb.toFixed(1)} KB</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">累積點名日數</span>
                  <span className="font-bold text-white text-sm font-mono mt-0.5 block">
                    {sessionDates.length} 天
                  </span>
                  <span className="text-[10px] text-slate-500">~{estSessionKb.toFixed(1)} KB</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">稽核異動日誌</span>
                  <span className="font-bold text-white text-sm font-mono mt-0.5 block">
                    {auditLogs.length} 筆
                  </span>
                  <span className="text-[10px] text-slate-500">~{estAuditKb.toFixed(1)} KB</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">預估免費壽命</span>
                  <span className="font-bold text-emerald-400 text-sm font-mono mt-0.5 block">
                    ~{yearsRemaining} 年
                  </span>
                  <span className="text-[10px] text-slate-500">無需升級付費方案</span>
                </div>
              </div>

              {/* Free Tier Discussions and Recommendations */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 text-xs text-slate-300">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>針對 Supabase 免費版 (Free Tier) 容量限制之討論與因應策略：</span>
                </div>

                <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-300">
                  <p>
                    • <strong>1. 容量評估（極度充裕）</strong>：Supabase 免費方案提供高達 <strong>500 MB</strong> 的 PostgreSQL 資料庫空間。由於宿舍點名資料全為純文字與結構化 JSON，全校 180 位住宿生的一學期 120 天完整每日點名僅約消耗 <strong>4.2 MB</strong>，500 MB 足以儲存 <strong>35 年以上</strong>的點名紀錄，容量極為寬裕。
                  </p>
                  <p>
                    • <strong>2. 寒暑假 7 天無活動休眠防護</strong>：Supabase 免費專案在連續 7 天無任何 API 呼叫時會進入暫時休眠（如寒暑假全校返鄉期）。
                    <span className="text-amber-300 ml-1">
                      只需在開學幹部巡房前，登入 Supabase 控制台點選「Restore project」即可 1 分鐘內喚醒；而在學期日常巡房期間，每日點名會自動維持雲端專案活躍。
                    </span>
                  </p>
                  <p>
                    • <strong>3. 離線封存與零遺失防護</strong>：建議在每年學期交替時，使用「名冊管理」內的「匯出完整資料庫 JSON」在學校電腦建立年度離線封存檔。
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-slate-400">
                    定期最佳化：清理 90 天前歷史稽核日誌，維持查詢極致效能
                  </span>
                  <button
                    type="button"
                    onClick={handlePruneLogs}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Archive className="w-3.5 h-3.5 text-amber-400" />
                    <span>清理 90 天前歷史日誌</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT HISTORY LOGS (查看資料人員名單等變動歷史紀錄，並且可以知道誰做了什麼) */}
        {activeTab === 'audit_history' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-400" />
                  <span>全系統異動稽核日誌 (Audit Trail)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  精確追蹤「誰 (幹部姓名)、在何時、執行了何種操作」，包含點名修改、名單更新、版本切換與資料庫匯入。
                </p>
              </div>

              <button
                onClick={handleExportLogsCSV}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>匯出日誌 CSV</span>
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col md:flex-row items-center gap-2.5">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="搜尋操作者幹部姓名、動作或說明..."
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Action type filter */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5 w-full md:w-auto text-xs">
                {[
                  { key: 'all', label: '全部動作' },
                  { key: 'ROLL_CALL', label: '點名更新' },
                  { key: 'ROSTER_IMPORT', label: '名冊匯入' },
                  { key: 'ROSTER_EDIT', label: '人員增刪' },
                  { key: 'VERSION_SWITCH', label: '版本切換' },
                  { key: 'ACCOUNT_MANAGE', label: '帳號管理' },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setLogActionFilter(item.key)}
                    className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors ${
                      logActionFilter === item.key
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Logs List */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-500 text-xs">
                  無符合條件的異動紀錄
                </div>
              ) : (
                filteredLogs.map(log => {
                  const dateStr = new Date(log.timestamp).toLocaleString('zh-TW', { hour12: false });
                  const isAdmin = log.role === 'admin';

                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              log.action === 'ROLL_CALL'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : log.action === 'ROSTER_IMPORT'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                : log.action === 'ACCOUNT_MANAGE'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {log.actionName}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {log.operatorName}
                            </span>
                            {isAdmin && (
                              <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-300">
                                總管理員
                              </span>
                            )}
                          </div>
                          <p className="text-slate-300 text-xs mt-0.5">
                            {log.description}
                          </p>
                        </div>
                      </div>

                      <div className="text-slate-500 font-mono text-[11px] whitespace-nowrap self-end md:self-auto flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-600" />
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cadre Edit Modal */}
      {editingCadre && (
        <CadreEditModal
          cadre={editingCadre}
          authConfig={authConfig}
          isOpen={Boolean(editingCadre)}
          onClose={() => setEditingCadre(null)}
          onSave={handleSaveEditedCadre}
        />
      )}

      {/* Tag Edit Modal for Cadres */}
      {tagEditingCadre && (
        <TagEditModal
          isOpen={Boolean(tagEditingCadre)}
          onClose={() => setTagEditingCadre(null)}
          targetName={tagEditingCadre.name}
          currentTag={tagEditingCadre.tag || '幹部'}
          targetType="cadre"
          onSaveTag={(newTag) => {
            const updatedCadre: CadreAccount = {
              ...tagEditingCadre,
              tag: newTag,
            };
            handleSaveEditedCadre(updatedCadre);
            setTagEditingCadre(null);
          }}
        />
      )}

      {/* Cadre Delete Confirmation Modal (In-App, Mobile & Iframe Safe with Sticky Buttons) */}
      {cadreToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl text-slate-200 flex flex-col max-h-[90dvh] my-auto overflow-hidden">
            <div className="shrink-0 flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">確認移除幹部帳號？</h3>
                <p className="text-xs text-slate-400">請確認是否執行移除操作</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">幹部姓名：</span>
                  <span className="font-bold text-white text-sm">{cadreToDelete.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">職銜標籤：</span>
                  <ResidentTagBadge tag={cadreToDelete.tag || '幹部'} size="xs" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">負責樓層：</span>
                  <span className="text-purple-300 font-semibold">
                    {cadreToDelete.assignedFloor ? `${cadreToDelete.assignedFloor} 樓負責人` : '全棟責任區'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-rose-300/90 leading-relaxed bg-rose-950/30 p-2.5 rounded-xl border border-rose-900/50">
                ⚠️ 移除後該幹部將無法使用此名稱登入。過往所有巡房與點名之操作異動紀錄將完整保留於稽核日誌中。
              </p>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2 pt-3 border-t border-slate-800 mt-3">
              <button
                type="button"
                onClick={() => {
                  setCadreToDelete(null);
                  setQuickConfirmCadreId(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeleteCadre}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
              >
                <Trash2 className="w-4 h-4 pointer-events-none" />
                <span>確定移除</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prune Logs Confirmation Modal (In-App, Mobile & Iframe Safe) */}
      {pruneConfirmCount !== null && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl text-slate-200 flex flex-col max-h-[90dvh] my-auto overflow-hidden">
            <div className="shrink-0 flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">確認清理歷史日誌？</h3>
                <p className="text-xs text-slate-400">釋放資料庫空間以維持極致效能</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3 text-xs text-slate-300">
              <p className="bg-slate-950 p-3 rounded-2xl border border-slate-800 leading-relaxed">
                檢測到 <strong className="text-amber-400 font-mono text-sm">{pruneConfirmCount}</strong> 筆超過 90 天的舊稽核日誌。清理後將釋放本機快取與資料庫空間，90 天內的最新日誌將完整保留。
              </p>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2 pt-3 border-t border-slate-800 mt-3">
              <button
                type="button"
                onClick={() => setPruneConfirmCount(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={executePruneLogs}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
              >
                <Archive className="w-4 h-4 pointer-events-none" />
                <span>確定清理舊日誌</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
