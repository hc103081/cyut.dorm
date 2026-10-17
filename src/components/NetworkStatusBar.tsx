import React, { useState, useEffect } from 'react';
import {
  subscribeSyncStatus,
  getSyncStatus,
  processSyncQueue,
  SyncStatusInfo,
} from '../utils/syncManager.ts';
import {
  getSupabaseConnectionInfo,
  testSupabaseDetailedStatus,
  getSupabaseSQLSchema,
  SupabaseDetailedStatus
} from '../utils/supabaseClient.ts';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Database,
  X,
  Sparkles,
  Server,
  Layers,
  ShieldCheck,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';

interface NetworkStatusBarProps {
  onOpenSettings?: () => void;
}

export const NetworkStatusBar: React.FC<NetworkStatusBarProps> = ({ onOpenSettings }) => {
  const [status, setStatus] = useState<SyncStatusInfo>(() => getSyncStatus());
  const [showModal, setShowModal] = useState<boolean>(false);
  const [manualSyncing, setManualSyncing] = useState<boolean>(false);
  const [manualResult, setManualResult] = useState<string | null>(null);
  const [tableStatus, setTableStatus] = useState<SupabaseDetailedStatus | null>(null);
  const [copiedSQL, setCopiedSQL] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(latest => {
      setStatus(latest);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (showModal) {
      testSupabaseDetailedStatus().then(res => setTableStatus(res));
    }
  }, [showModal]);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(getSupabaseSQLSchema()).then(() => {
      setCopiedSQL(true);
      setTimeout(() => setCopiedSQL(false), 2000);
    });
  };

  const handleManualSync = async () => {
    setManualSyncing(true);
    setManualResult(null);
    try {
      const res = await processSyncQueue();
      if (res.success) {
        setManualResult(`同步完成！已成功同步 ${res.count} 筆資料至 Supabase 雲端。`);
      } else {
        setManualResult('同步未全部完成，尚未同步項目已安全保存在本機快取中。');
      }
    } catch (e: any) {
      setManualResult(`同步發生異常: ${e.message || e}`);
    } finally {
      setManualSyncing(false);
    }
  };

  const isOffline = !status.isOnline || status.syncState === 'offline_cached';
  const isSyncing = status.syncState === 'syncing' || manualSyncing;
  const isPending = status.pendingCount > 0;
  const isLocalOnly = status.syncState === 'local_only';

  // Bar colors
  let barBg = 'bg-slate-900 border-b border-slate-800 text-slate-300';
  let dotColor = 'bg-emerald-400';
  let badgeText = 'text-emerald-400';

  if (isOffline) {
    barBg = 'bg-amber-950/80 border-b border-amber-800/80 text-amber-200';
    dotColor = 'bg-amber-400 animate-pulse';
    badgeText = 'text-amber-300';
  } else if (isSyncing) {
    barBg = 'bg-blue-950/80 border-b border-blue-800/80 text-blue-200';
    dotColor = 'bg-blue-400 animate-spin';
    badgeText = 'text-blue-300';
  } else if (isPending) {
    barBg = 'bg-amber-950/60 border-b border-amber-800/60 text-amber-200';
    dotColor = 'bg-amber-400';
    badgeText = 'text-amber-300';
  } else if (isLocalOnly) {
    barBg = 'bg-slate-900/90 border-b border-slate-800 text-slate-400';
    dotColor = 'bg-slate-400';
    badgeText = 'text-slate-400';
  }

  return (
    <>
      {/* Top Small Status Bar */}
      <div className={`w-full py-1 px-3 text-[11px] flex items-center justify-between transition-colors z-40 select-none ${barBg}`}>
        <div
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 cursor-pointer hover:opacity-90 min-w-0 flex-1 truncate"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
            {isOffline ? (
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
            ) : isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : isLocalOnly ? (
              <Cloud className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Wifi className="w-3.5 h-3.5 shrink-0" />
            )}
          </div>

          <div className="truncate flex items-center gap-1.5">
            <span className={`font-semibold shrink-0 ${badgeText}`}>
              {status.statusLabel}
            </span>
            <span className="hidden sm:inline text-slate-400 truncate">
              — {status.statusDetail}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {isPending && !isOffline && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="text-[10px] px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>立即同步</span>
            </button>
          )}

          <button
            onClick={() => setShowModal(true)}
            className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
          >
            詳細說明
          </button>
        </div>
      </div>

      {/* Network & Supabase Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl relative text-slate-200 flex flex-col max-h-[88dvh] sm:max-h-[85vh] my-auto overflow-hidden">
            
            {/* Header (Sticky top) */}
            <div className="shrink-0 p-4 sm:p-5 pb-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white">網路狀態與 Supabase 雲端同步說明</h3>
                  <p className="text-[11px] text-slate-400">離線自動暫存本機 • 聯網自動即時上傳</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
                title="關閉視窗"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs overscroll-contain">
              {/* Connection Specs */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">瀏覽器網路狀態:</span>
                  <span className={`font-bold flex items-center gap-1 ${status.isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {status.isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                    {status.isOnline ? '正常連線中' : '連線中斷 (離線)'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Supabase 連線方式:</span>
                  {(() => {
                    const info = getSupabaseConnectionInfo();
                    if (info.isDirect) {
                      return (
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Vercel 直連 (免輸入 Key)</span>
                        </span>
                      );
                    } else if (info.configured) {
                      return (
                        <span className="font-bold text-blue-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>手動配置連線</span>
                        </span>
                      );
                    }
                    return (
                      <span className="font-bold text-slate-400">
                        未連線 (本機快取模式)
                      </span>
                    );
                  })()}
                </div>

                {getSupabaseConnectionInfo().url && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">雲端資料庫網址:</span>
                    <span className="text-slate-300 font-mono text-[11px] truncate max-w-[200px] sm:max-w-[220px]">
                      {getSupabaseConnectionInfo().url}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">本機待上傳暫存隊列:</span>
                  <span className={`font-bold font-mono ${status.pendingCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                    {status.pendingCount} 筆待同步項目
                  </span>
                </div>

                {status.lastSyncTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">最近成功同步時間:</span>
                    <span className="text-slate-300 font-mono">
                      {new Date(status.lastSyncTime).toLocaleString('zh-TW', { hour12: false })}
                    </span>
                  </div>
                )}
              </div>

              {/* Supabase 4 Tables Status Badge */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-[11px]">
                <div className="font-bold text-slate-200 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>全系統 4 大 Supabase 雲端資料表：</span>
                  </div>
                  {tableStatus && (
                    <span className="text-[10px] text-slate-400">
                      {tableStatus.tablesCreated ? '✅ 全部就緒' : '⚠️ 待在雲端執行建表 SQL'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-slate-400">
                  <div className="flex items-center justify-between p-1.5 bg-slate-900 rounded border border-slate-800">
                    <span className="truncate">dorm_roster_versions</span>
                    {tableStatus?.tableDetails.dorm_roster_versions ? (
                      <span className="text-[10px] text-emerald-400 font-bold">就緒</span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-bold">待建表</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-slate-900 rounded border border-slate-800">
                    <span className="truncate">dorm_daily_sessions</span>
                    {tableStatus?.tableDetails.dorm_daily_sessions ? (
                      <span className="text-[10px] text-emerald-400 font-bold">就緒</span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-bold">待建表</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-slate-900 rounded border border-slate-800">
                    <span className="truncate">dorm_auth_config</span>
                    {tableStatus?.tableDetails.dorm_auth_config ? (
                      <span className="text-[10px] text-emerald-400 font-bold">就緒</span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-bold">待建表</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between p-1.5 bg-slate-900 rounded border border-slate-800">
                    <span className="truncate">dorm_audit_logs</span>
                    {tableStatus?.tableDetails.dorm_audit_logs ? (
                      <span className="text-[10px] text-emerald-400 font-bold">就緒</span>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-bold">待建表</span>
                    )}
                  </div>
                </div>

                {tableStatus && tableStatus.tablesCreated && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-[11px] text-emerald-200 flex items-center gap-2 mt-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>4 大資料表已全部在 Supabase 建立完畢，雙向同步就緒</span>
                  </div>
                )}

                {tableStatus && !tableStatus.tablesCreated && (
                  <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/80 text-[11px] text-amber-200 flex flex-col gap-2 mt-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-bold">4 大資料表尚未在 Supabase 建立</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href="https://supabase.com/dashboard/project/qjlmelvzxoyopjvzisgg/sql/new"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-slate-700"
                      >
                        <span>開啟專案 SQL Editor ↗</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleCopySQL}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-sm transition-colors"
                      >
                        {copiedSQL ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSQL ? '已複製！' : '複製建表 SQL'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Behavior explanation */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-slate-300 leading-relaxed text-[11px]">
                <div className="font-bold text-slate-200 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>離線與自動同步機制：</span>
                </div>
                <p>
                  1. <strong>離線/弱網無縫作業</strong>：巡房訊號不良或斷線時，點名、幹部自建帳號、名冊更動皆以 0 毫秒極速快取於本機，絕不中斷。
                </p>
                <p>
                  2. <strong>恢復連線自動上傳</strong>：一旦偵測到網路連線，系統在背景自動依序上傳至 Supabase 4 大資料表，多幹部巡房即時同步。
                </p>
              </div>

              {manualResult && (
                <div className="p-2.5 rounded-xl bg-blue-950/50 border border-blue-800/80 text-blue-200 text-xs">
                  {manualResult}
                </div>
              )}
            </div>

            {/* Footer (Always pinned at bottom with pb-safe, 100% accessible on mobile) */}
            <div className="shrink-0 p-3 sm:p-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-end gap-2.5 pb-safe">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors active:scale-95"
              >
                關閉
              </button>

              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 transition-colors active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? '同步中...' : '手動重試立即同步'}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
