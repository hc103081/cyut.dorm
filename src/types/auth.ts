export type UserRole = 'admin' | 'cadre';

export interface UserSession {
  username: string; // e.g. "宿舍總幹部 (Admin)" or "林大為"
  role: UserRole;
  loginAt: number;
}

export interface CadreAccount {
  id: string;
  name: string;
  role: UserRole;
  customPassword?: string;
  assignedFloor?: string;
  tag?: string; // e.g. "舍長" | "樓長" | "副樓長" | "室長" | "幹部"
  phone?: string;
  status?: 'active' | 'suspended'; // 'active' 正常啟用 / 'suspended' 停用
  createdAt: number;
  lastLoginAt?: number;
  note?: string;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  operatorName: string;
  role: UserRole;
  action: 'ROLL_CALL' | 'ROSTER_IMPORT' | 'ROSTER_EDIT' | 'VERSION_SWITCH' | 'ACCOUNT_MANAGE' | 'DATABASE_OP';
  actionName: string; // e.g. "點名更新", "名冊異動"
  description: string; // e.g. "416-2 陳冠宇 標記為 已到"
  details?: Record<string, any>;
}

export interface AuthConfig {
  adminPassword: string; // Admin password (default: admin888)
  cadreOfflinePasscode: string; // The offline password Admin gives to regular cadres (default: dorm2026)
  registeredCadres: CadreAccount[];
}
