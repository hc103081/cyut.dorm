import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DailySession, RosterVersion } from '../types/dorm.ts';
import type { AuthConfig, AuditLog } from '../types/auth.ts';

const SUPABASE_CONFIG_KEY = 'dorm_supabase_config_v1';

// Direct environment variables deployed on Vercel or in .env
const ENV_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string)?.trim() || '';
const ENV_SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string)?.trim() || '';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Returns true if Supabase is directly configured via Vercel / build environment variables.
 * When true, users never have to enter keys manually!
 */
export function isDirectEnvConfigured(): boolean {
  return Boolean(ENV_SUPABASE_URL && ENV_SUPABASE_ANON_KEY);
}

/**
 * Returns connection diagnostic info for UI display
 */
export function getSupabaseConnectionInfo(): {
  isDirect: boolean;
  configured: boolean;
  url: string;
  maskedKey: string;
} {
  const config = getStoredSupabaseConfig();
  const configured = Boolean(config.url && config.anonKey);
  const isDirect = isDirectEnvConfigured() && config.url === ENV_SUPABASE_URL;

  let maskedKey = '';
  if (config.anonKey) {
    maskedKey = config.anonKey.length > 10
      ? `${config.anonKey.substring(0, 6)}...${config.anonKey.substring(config.anonKey.length - 4)}`
      : '******';
  }

  return {
    isDirect,
    configured,
    url: config.url || '',
    maskedKey,
  };
}

/**
 * Get Supabase configuration.
 * Prioritizes direct Vercel environment variables so users never have to input anything.
 * Falls back to localStorage only if env variables are not present (e.g. local testing).
 */
export function getStoredSupabaseConfig(): SupabaseConfig {
  // 1. Direct Vercel / Environment variable connection (Primary)
  if (ENV_SUPABASE_URL && ENV_SUPABASE_ANON_KEY) {
    return {
      url: ENV_SUPABASE_URL,
      anonKey: ENV_SUPABASE_ANON_KEY,
    };
  }

  // 2. Fallback to localStorage (for local manual overrides/testing when env vars are not set)
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.url && parsed.anonKey) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load supabase config', e);
  }

  return {
    url: '',
    anonKey: '',
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  try {
    localStorage.setItem(
      SUPABASE_CONFIG_KEY,
      JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
    );
    cachedClient = null;
    cachedConfigKey = '';
  } catch (e) {
    console.error('Failed to save supabase config', e);
  }
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(SUPABASE_CONFIG_KEY);
  cachedClient = null;
  cachedConfigKey = '';
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  const currentKey = `${config.url}::${config.anonKey}`;
  if (cachedClient && cachedConfigKey === currentKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey);
    cachedConfigKey = currentKey;
    return cachedClient;
  } catch (e) {
    console.error('Failed to initialize Supabase client', e);
    return null;
  }
}

export interface SupabaseDetailedStatus {
  connected: boolean;
  url: string;
  isDirectEnv: boolean;
  tablesCreated: boolean;
  tableDetails: {
    dorm_roster_versions: boolean;
    dorm_daily_sessions: boolean;
    dorm_auth_config: boolean;
    dorm_audit_logs: boolean;
  };
  tableErrors?: Record<string, string>;
  message: string;
}

/**
 * Test connectivity with Supabase instance
 */
export async function testSupabaseConnection(config?: SupabaseConfig): Promise<{
  success: boolean;
  tablesCreated?: boolean;
  message: string;
}> {
  const client = config
    ? createClient(config.url, config.anonKey)
    : getSupabaseClient();

  if (!client) {
    return {
      success: false,
      tablesCreated: false,
      message: '未偵測到 Supabase 連線資訊。請確認已配置 Vercel 環境變數 (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)。',
    };
  }

  try {
    const { error } = await client.from('dorm_roster_versions').select('id').limit(1);
    if (error) {
      if (
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        error.message.includes('relation') ||
        error.message.includes('does not exist') ||
        error.message.includes('schema cache')
      ) {
        return {
          success: true,
          tablesCreated: false,
          message: '已成功連線至 Supabase 專案！但資料表尚未建立，請至 Supabase Dashboard -> SQL Editor 執行建表語法。',
        };
      }
      return { success: false, tablesCreated: false, message: `連線失敗: ${error.message}` };
    }
    return { success: true, tablesCreated: true, message: 'Supabase 雲端資料庫直連正常！4 大核心資料表均已連線就緒。' };
  } catch (err: any) {
    return { success: false, tablesCreated: false, message: `連線異常: ${err.message || '無法連線至 Supabase'}` };
  }
}

/**
 * Detailed diagnostic check on all 4 Supabase tables
 */
export async function testSupabaseDetailedStatus(): Promise<SupabaseDetailedStatus> {
  const info = getSupabaseConnectionInfo();
  const client = getSupabaseClient();

  if (!client || !info.url) {
    return {
      connected: false,
      url: info.url || '',
      isDirectEnv: info.isDirect,
      tablesCreated: false,
      tableDetails: {
        dorm_roster_versions: false,
        dorm_daily_sessions: false,
        dorm_auth_config: false,
        dorm_audit_logs: false,
      },
      message: '未偵測到 Supabase 連線資訊，請在 Vercel 部署設定中加入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY。',
    };
  }

  const tables = ['dorm_roster_versions', 'dorm_daily_sessions', 'dorm_auth_config', 'dorm_audit_logs'] as const;
  const tableDetails = {
    dorm_roster_versions: false,
    dorm_daily_sessions: false,
    dorm_auth_config: false,
    dorm_audit_logs: false,
  };
  const tableErrors: Record<string, string> = {};

  try {
    for (const tbl of tables) {
      const res = await client.from(tbl).select('*', { count: 'exact' }).limit(1);
      if (res.error) {
        tableDetails[tbl] = false;
        tableErrors[tbl] = res.error.message;
      } else {
        tableDetails[tbl] = true;
      }
    }

    const allCreated = Object.values(tableDetails).every(v => v === true);
    const anyCreated = Object.values(tableDetails).some(v => v === true);

    let message = '';
    if (allCreated) {
      message = 'Supabase 連線成功！4 大核心資料表皆已就緒，即時同步功能正常運作中。';
    } else if (anyCreated) {
      message = 'Supabase 連線成功，但部分資料表缺失，請至 SQL Editor 重新執行建表語法。';
    } else {
      message = 'Supabase 專案連線正常（金鑰認證通過），但 4 大資料表尚未建立，請至 Supabase Dashboard 貼上 SQL 語法執行建立！';
    }

    return {
      connected: true,
      url: info.url,
      isDirectEnv: info.isDirect,
      tablesCreated: allCreated,
      tableDetails,
      tableErrors,
      message,
    };
  } catch (err: any) {
    return {
      connected: false,
      url: info.url,
      isDirectEnv: info.isDirect,
      tablesCreated: false,
      tableDetails,
      message: `連線發生錯誤: ${err.message || err}`,
    };
  }
}

/**
 * Upload single session to Supabase
 */
export async function syncSessionToSupabase(session: DailySession): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('dorm_daily_sessions')
      .upsert({
        date: session.date,
        roster_version_id: session.rosterVersionId || null,
        records: session.records,
        completed_rooms: session.completedRooms,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
      }, { onConflict: 'date' });

    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Sync session to Supabase failed', e);
    return false;
  }
}

/**
 * Upload AuthConfig to Supabase
 */
export async function syncAuthConfigToSupabase(config: AuthConfig): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('dorm_auth_config')
      .upsert({
        id: 'current_config',
        admin_password: config.adminPassword,
        cadre_offline_passcode: config.cadreOfflinePasscode,
        registered_cadres: config.registeredCadres,
        updated_at: Date.now(),
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Sync authConfig to Supabase failed', e);
    return false;
  }
}

/**
 * Upload single or batch audit logs to Supabase
 */
export async function syncAuditLogsToSupabase(logs: AuditLog[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || logs.length === 0) return false;

  try {
    const rows = logs.slice(0, 100).map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      operator_name: l.operatorName,
      role: l.role,
      action: l.action,
      action_name: l.actionName,
      description: l.description,
      details: l.details || {},
    }));

    const { error } = await client
      .from('dorm_audit_logs')
      .upsert(rows, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Sync audit logs to Supabase failed', e);
    return false;
  }
}

/**
 * Upload roster versions to Supabase
 */
export async function syncRosterVersionsToSupabase(versions: RosterVersion[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    for (const v of versions) {
      const { error } = await client
        .from('dorm_roster_versions')
        .upsert({
          id: v.id,
          name: v.name,
          effective_date: v.effectiveDate,
          created_at: v.createdAt,
          is_current: v.isCurrent,
          residents: v.residents,
          note: v.note || null,
        }, { onConflict: 'id' });

      if (error) throw error;
    }
    return true;
  } catch (e) {
    console.warn('Sync roster versions to Supabase failed', e);
    return false;
  }
}

/**
 * Delete a roster version from Supabase
 */
export async function deleteRosterVersionFromSupabase(versionId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('dorm_roster_versions')
      .delete()
      .eq('id', versionId);

    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Delete roster version from Supabase failed', e);
    return false;
  }
}

/**
 * Full Sync of All Tables: Local to Supabase
 */
export async function syncLocalToSupabase(
  rosterVersions: RosterVersion[],
  sessions: Record<string, DailySession>,
  authConfig?: AuthConfig,
  auditLogs?: AuditLog[]
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: '未連線 Supabase，請確認已在 Vercel 部署環境變數 (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)',
    };
  }

  try {
    // 1. Sync roster versions
    const rOk = await syncRosterVersionsToSupabase(rosterVersions);
    if (!rOk) throw new Error('名冊版本同步失敗');

    // 2. Sync daily sessions
    for (const date of Object.keys(sessions)) {
      await syncSessionToSupabase(sessions[date]);
    }

    // 3. Sync auth config if provided
    if (authConfig) {
      await syncAuthConfigToSupabase(authConfig);
    }

    // 4. Sync audit logs if provided
    if (auditLogs && auditLogs.length > 0) {
      await syncAuditLogsToSupabase(auditLogs);
    }

    return {
      success: true,
      message: `已成功將全系統資料（名冊版本、點名紀錄、幹部帳號、操作異動歷史）完整同步至 Supabase 雲端資料庫！`,
    };
  } catch (err: any) {
    return { success: false, message: `同步失敗: ${err.message || err}` };
  }
}

/**
 * Fetch latest data across all tables from Supabase
 */
export async function fetchFromSupabase(): Promise<{
  success: boolean;
  rosterVersions?: RosterVersion[];
  sessions?: Record<string, DailySession>;
  authConfig?: AuthConfig;
  auditLogs?: AuditLog[];
  message: string;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: '未連線 Supabase' };
  }

  try {
    // 1. Fetch roster versions
    const { data: vData, error: vErr } = await client
      .from('dorm_roster_versions')
      .select('*')
      .order('created_at', { ascending: false });

    if (vErr && (vErr.code === '42P01' || vErr.message.includes('relation') || vErr.message.includes('does not exist'))) {
      return {
        success: false,
        message: 'Supabase 資料表尚未建立，請至 Supabase Dashboard SQL Editor 執行建立表格語法。',
      };
    }

    // 2. Fetch daily sessions
    const { data: sData } = await client
      .from('dorm_daily_sessions')
      .select('*')
      .order('date', { ascending: false });

    // 3. Fetch auth config
    const { data: aData } = await client
      .from('dorm_auth_config')
      .select('*')
      .eq('id', 'current_config')
      .maybeSingle();

    // 4. Fetch audit logs
    const { data: lData } = await client
      .from('dorm_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(300);

    const fetchedVersions: RosterVersion[] = (vData || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      effectiveDate: row.effective_date,
      createdAt: Number(row.created_at),
      isCurrent: Boolean(row.is_current),
      residents: row.residents,
      note: row.note || undefined,
    }));

    const fetchedSessions: Record<string, DailySession> = {};
    (sData || []).forEach((row: any) => {
      fetchedSessions[row.date] = {
        date: row.date,
        rosterVersionId: row.roster_version_id || undefined,
        records: row.records || {},
        completedRooms: row.completed_rooms || [],
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
      };
    });

    let fetchedAuthConfig: AuthConfig | undefined;
    if (aData) {
      fetchedAuthConfig = {
        adminPassword: aData.admin_password || 'admin888',
        cadreOfflinePasscode: aData.cadre_offline_passcode || 'dorm2026',
        registeredCadres: aData.registered_cadres || [],
      };
    }

    const fetchedAuditLogs: AuditLog[] = (lData || []).map((row: any) => ({
      id: row.id,
      timestamp: Number(row.timestamp),
      operatorName: row.operator_name,
      role: row.role,
      action: row.action,
      actionName: row.action_name,
      description: row.description,
      details: row.details || undefined,
    }));

    return {
      success: true,
      rosterVersions: fetchedVersions.length > 0 ? fetchedVersions : undefined,
      sessions: Object.keys(fetchedSessions).length > 0 ? fetchedSessions : undefined,
      authConfig: fetchedAuthConfig,
      auditLogs: fetchedAuditLogs.length > 0 ? fetchedAuditLogs : undefined,
      message: `從 Supabase 下載成功！已更新全系統資料庫。`,
    };
  } catch (err: any) {
    return { success: false, message: `下載失敗: ${err.message || err}` };
  }
}

/**
 * Setup Realtime multi-user live synchronization via Supabase postgres_changes
 */
export function setupSupabaseRealtime(callbacks: {
  onSessionChange?: (session: DailySession) => void;
  onRosterChange?: () => void;
  onAuthConfigChange?: (config: AuthConfig) => void;
  onAuditLogAdded?: (log: AuditLog) => void;
}): (() => void) | null {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const channel = client
      .channel('dorm_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dorm_daily_sessions' },
        payload => {
          if (payload.new && callbacks.onSessionChange) {
            const row: any = payload.new;
            callbacks.onSessionChange({
              date: row.date,
              rosterVersionId: row.roster_version_id || undefined,
              records: row.records || {},
              completedRooms: row.completed_rooms || [],
              createdAt: Number(row.created_at),
              updatedAt: Number(row.updated_at),
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dorm_roster_versions' },
        () => {
          if (callbacks.onRosterChange) {
            callbacks.onRosterChange();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dorm_auth_config' },
        payload => {
          if (payload.new && callbacks.onAuthConfigChange) {
            const row: any = payload.new;
            callbacks.onAuthConfigChange({
              adminPassword: row.admin_password || 'admin888',
              cadreOfflinePasscode: row.cadre_offline_passcode || 'dorm2026',
              registeredCadres: row.registered_cadres || [],
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dorm_audit_logs' },
        payload => {
          if (payload.new && callbacks.onAuditLogAdded) {
            const row: any = payload.new;
            callbacks.onAuditLogAdded({
              id: row.id,
              timestamp: Number(row.timestamp),
              operatorName: row.operator_name,
              role: row.role,
              action: row.action,
              actionName: row.action_name,
              description: row.description,
              details: row.details || undefined,
            });
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch (e) {
    console.warn('Realtime subscription not supported or failed to initialize', e);
    return null;
  }
}

/**
 * Returns complete SQL code snippet for all 4 tables for Supabase SQL editor
 */
export function getSupabaseSQLSchema(): string {
  return `-- ========================================================
-- 宿舍點名助手 (Dorm Roll Call) - Supabase 完整資料庫建立語法
-- 請在 Supabase Dashboard -> SQL Editor 貼上並點擊 Run
-- ========================================================

-- 1. 宿舍名冊版本表 (支援 115 最新名單與歷史存檔名冊)
create table if not exists public.dorm_roster_versions (
  id text primary key,
  name text not null,
  effective_date text not null,
  created_at bigint not null,
  is_current boolean default false,
  residents jsonb not null default '[]'::jsonb,
  note text
);

-- 2. 每日點名紀錄表 (每日紀錄綁定房號、床位點名狀態與備註)
create table if not exists public.dorm_daily_sessions (
  date text primary key,
  roster_version_id text references public.dorm_roster_versions(id) on delete set null,
  records jsonb not null default '{}'::jsonb,
  completed_rooms jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null
);

-- 3. 系統帳號與權限設定表 (管理者最高密碼、通用線下密碼、幹部名單自主註冊)
create table if not exists public.dorm_auth_config (
  id text primary key default 'current_config',
  admin_password text not null default 'admin888',
  cadre_offline_passcode text not null default 'dorm2026',
  registered_cadres jsonb not null default '[]'::jsonb,
  updated_at bigint not null
);

-- 4. 歷史異動稽核紀錄表 (誰在何時做了什麼操作紀錄)
create table if not exists public.dorm_audit_logs (
  id text primary key,
  timestamp bigint not null,
  operator_name text not null,
  role text not null,
  action text not null,
  action_name text not null,
  description text not null,
  details jsonb default '{}'::jsonb
);

-- 5. 開放存取權限 (支援離線暫存與幹部自動同步)
alter table public.dorm_roster_versions enable row level security;
alter table public.dorm_daily_sessions enable row level security;
alter table public.dorm_auth_config enable row level security;
alter table public.dorm_audit_logs enable row level security;

create policy "允許存取名冊版本" on public.dorm_roster_versions for all using (true) with check (true);
create policy "允許存取點名紀錄" on public.dorm_daily_sessions for all using (true) with check (true);
create policy "允許存取帳號設定" on public.dorm_auth_config for all using (true) with check (true);
create policy "允許存取稽核紀錄" on public.dorm_audit_logs for all using (true) with check (true);

-- 6. 啟用 Realtime 實時推送 (多幹部同步巡房)
alter publication supabase_realtime add table public.dorm_daily_sessions;
alter publication supabase_realtime add table public.dorm_roster_versions;
alter publication supabase_realtime add table public.dorm_auth_config;
alter publication supabase_realtime add table public.dorm_audit_logs;
`;
}
