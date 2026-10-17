/**
 * Offline-first Sync Manager
 * Handles local caching, network status monitoring, and automatic background upload to Supabase when reconnected.
 */

import {
  getSupabaseClient,
  getStoredSupabaseConfig,
  isDirectEnvConfigured,
  syncSessionToSupabase,
  syncAuthConfigToSupabase,
  syncAuditLogsToSupabase,
  syncRosterVersionsToSupabase,
  fetchFromSupabase,
} from './supabaseClient.ts';
import type { DailySession, RosterVersion } from '../types/dorm.ts';
import type { AuthConfig, AuditLog } from '../types/auth.ts';

const PENDING_QUEUE_KEY = 'dorm_pending_sync_queue_v1';
const LAST_SYNC_KEY = 'dorm_last_sync_timestamp_v1';

export type SyncState = 'synced' | 'syncing' | 'offline_cached' | 'pending' | 'local_only' | 'error';

export interface SyncStatusInfo {
  isOnline: boolean;
  hasSupabaseConfig: boolean;
  syncState: SyncState;
  pendingCount: number;
  lastSyncTime: number | null;
  statusLabel: string;
  statusDetail: string;
}

export interface PendingSyncItem {
  id: string;
  entity: 'session' | 'auth' | 'audit' | 'roster';
  timestamp: number;
  data: any;
}

// In-memory listeners
type StatusListener = (status: SyncStatusInfo) => void;
const listeners = new Set<StatusListener>();

let currentSyncState: SyncState = 'synced';
let isSyncing = false;

function getStoredQueue(): PendingSyncItem[] {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read pending sync queue', e);
  }
  return [];
}

function saveStoredQueue(queue: PendingSyncItem[]): void {
  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save pending sync queue', e);
  }
}

function getLastSyncTime(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    if (raw) return Number(raw);
  } catch (e) {
    // ignore
  }
  return null;
}

function setLastSyncTime(ts: number): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(ts));
  } catch (e) {
    // ignore
  }
}

/**
 * Returns current computed sync and network status
 */
export function getSyncStatus(): SyncStatusInfo {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const config = getStoredSupabaseConfig();
  const hasSupabaseConfig = Boolean(config.url && config.anonKey);
  const queue = getStoredQueue();
  const pendingCount = queue.length;
  const lastSyncTime = getLastSyncTime();

  let state: SyncState = currentSyncState;
  let statusLabel = '';
  let statusDetail = '';

  const isDirect = isDirectEnvConfigured();

  if (!hasSupabaseConfig) {
    state = 'local_only';
    statusLabel = '☁️ 本機快取模式';
    statusDetail = '離線運作正常。可在 Vercel 部署設定中加入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY 自動直連。';
  } else if (!isOnline) {
    state = 'offline_cached';
    statusLabel = pendingCount > 0
      ? `🟠 離線狀態：已暫存本機 (${pendingCount} 筆待同步)`
      : '🟠 離線模式：已暫存本地快取';
    statusDetail = '目前無網路連線，所有更動均已妥善快取於本機。待網路恢復後將自動同步上傳至 Supabase。';
  } else if (isSyncing) {
    state = 'syncing';
    statusLabel = '🔄 正在同步 Supabase 雲端...';
    statusDetail = `正在將 ${pendingCount} 筆本機暫存資料上傳至 Supabase 雲端資料庫...`;
  } else if (pendingCount > 0) {
    state = 'pending';
    statusLabel = `🟡 待同步：${pendingCount} 筆暫存更動`;
    statusDetail = '已偵測到網路，正排隊自動上傳至 Supabase。';
  } else if (state === 'error') {
    statusLabel = '⚠️ 雲端連線失敗 (已暫存本機)';
    statusDetail = '無法連線至 Supabase 資料庫，所有資料已保存在本機快取中，可點擊重試。';
  } else {
    state = 'synced';
    statusLabel = isDirect
      ? '🟢 Supabase 雲端已直連 (Vercel)'
      : '🟢 雲端已連線 (Supabase 同步正常)';
    statusDetail = lastSyncTime
      ? `所有資料均已與 Supabase 雲端同步 (最近同步: ${new Date(lastSyncTime).toLocaleTimeString('zh-TW', { hour12: false })})`
      : 'Supabase 雲端直連正常，全系統 4 大資料表即時保存。';
  }

  return {
    isOnline,
    hasSupabaseConfig,
    syncState: state,
    pendingCount,
    lastSyncTime,
    statusLabel,
    statusDetail,
  };
}

function notifyListeners(): void {
  const status = getSyncStatus();
  listeners.forEach(fn => {
    try {
      fn(status);
    } catch (e) {
      console.error('Error in sync listener', e);
    }
  });
}

/**
 * Subscribe to network and sync status changes
 */
export function subscribeSyncStatus(fn: StatusListener): () => void {
  listeners.add(fn);
  fn(getSyncStatus());
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Enqueue a sync action. Immediately attempts sync if online.
 */
export async function queueSyncAction(entity: PendingSyncItem['entity'], data: any): Promise<void> {
  const queue = getStoredQueue();
  const newItem: PendingSyncItem = {
    id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    entity,
    timestamp: Date.now(),
    data,
  };

  // For same entity, keep latest to prevent duplicate queue buildup
  const filtered = queue.filter(item => {
    if (entity === 'session' && item.entity === 'session' && item.data.date === data.date) {
      return false;
    }
    if (entity === 'auth' && item.entity === 'auth') {
      return false;
    }
    return true;
  });

  filtered.push(newItem);
  saveStoredQueue(filtered);
  notifyListeners();

  // If online, process right away!
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    await processSyncQueue();
  }
}

/**
 * Process all items in pending sync queue
 */
export async function processSyncQueue(): Promise<{ success: boolean; count: number }> {
  const client = getSupabaseClient();
  if (!client) {
    currentSyncState = 'local_only';
    notifyListeners();
    return { success: false, count: 0 };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    currentSyncState = 'offline_cached';
    notifyListeners();
    return { success: false, count: 0 };
  }

  if (isSyncing) return { success: true, count: 0 };

  isSyncing = true;
  currentSyncState = 'syncing';
  notifyListeners();

  const queue = getStoredQueue();
  if (queue.length === 0) {
    isSyncing = false;
    currentSyncState = 'synced';
    setLastSyncTime(Date.now());
    notifyListeners();
    return { success: true, count: 0 };
  }

  let successCount = 0;
  const remainingQueue: PendingSyncItem[] = [];

  for (const item of queue) {
    try {
      let ok = false;
      if (item.entity === 'session') {
        ok = await syncSessionToSupabase(item.data);
      } else if (item.entity === 'auth') {
        ok = await syncAuthConfigToSupabase(item.data);
      } else if (item.entity === 'audit') {
        ok = await syncAuditLogsToSupabase([item.data]);
      } else if (item.entity === 'roster') {
        ok = await syncRosterVersionsToSupabase(item.data);
      }

      if (ok) {
        successCount++;
      } else {
        remainingQueue.push(item);
      }
    } catch (err) {
      remainingQueue.push(item);
    }
  }

  saveStoredQueue(remainingQueue);
  isSyncing = false;

  if (remainingQueue.length === 0) {
    currentSyncState = 'synced';
    setLastSyncTime(Date.now());
  } else {
    currentSyncState = 'error';
  }

  notifyListeners();
  return { success: remainingQueue.length === 0, count: successCount };
}

// Auto-wire window online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncManager] Network online detected. Initiating auto-sync upload...');
    notifyListeners();
    processSyncQueue();
  });

  window.addEventListener('offline', () => {
    console.log('[SyncManager] Network offline detected. Switching to offline cache mode.');
    currentSyncState = 'offline_cached';
    notifyListeners();
  });
}
