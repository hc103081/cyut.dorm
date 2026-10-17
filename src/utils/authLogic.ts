import type { AuthConfig, AuditLog, UserSession, UserRole, CadreAccount } from '../types/auth.ts';

export interface ValidateLoginResult {
  success: boolean;
  session?: UserSession;
  message?: string;
  updatedAuthConfig?: AuthConfig;
  isNewCadre?: boolean;
}

/**
 * Validates login credentials against AuthConfig.
 * If user logs in with a new cadre name and the correct offline passcode,
 * the account is AUTOMATICALLY registered into AuthConfig without requiring Admin pre-creation!
 */
export function validateLogin(
  nameInput: string,
  passwordInput: string,
  authConfig: AuthConfig
): ValidateLoginResult {
  const trimmedName = nameInput.trim();
  const trimmedPassword = passwordInput.trim();

  if (!trimmedName) {
    return { success: false, message: '請輸入您的姓名或帳號' };
  }
  if (!trimmedPassword) {
    return { success: false, message: '請輸入通行密碼' };
  }

  // 1. Check Admin login
  if (trimmedName.toLowerCase() === 'admin' || trimmedName === '管理員' || trimmedName === '總幹部') {
    if (trimmedPassword === authConfig.adminPassword) {
      return {
        success: true,
        session: {
          username: '總管理員 (Admin)',
          role: 'admin',
          loginAt: Date.now(),
        },
      };
    }
    return { success: false, message: '管理員密碼錯誤' };
  }

  // 2. Check Cadre login
  // Check if this cadre has an individual custom password
  const existingCadre = authConfig.registeredCadres.find(
    c => c.name.toLowerCase() === trimmedName.toLowerCase()
  );

  if (existingCadre && existingCadre.status === 'suspended') {
    return { success: false, message: '此幹部帳號已被管理員停用，請聯繫總幹部(Admin)' };
  }

  if (existingCadre && existingCadre.customPassword) {
    if (trimmedPassword === existingCadre.customPassword) {
      return {
        success: true,
        session: {
          username: existingCadre.name,
          role: 'cadre',
          loginAt: Date.now(),
        },
        isNewCadre: false,
      };
    }
    return { success: false, message: '個別幹部密碼錯誤，請重新確認' };
  }

  // Otherwise, check against the offline passcode given by Admin
  if (trimmedPassword === authConfig.cadreOfflinePasscode) {
    if (existingCadre) {
      // Existing cadre logging in with general offline passcode
      return {
        success: true,
        session: {
          username: existingCadre.name,
          role: 'cadre',
          loginAt: Date.now(),
        },
        isNewCadre: false,
      };
    }

    // NEW CADRE: Automatically create and register this cadre!
    // No need for Admin to add them first!
    const newCadre: CadreAccount = {
      id: `cadre-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmedName,
      role: 'cadre',
      createdAt: Date.now(),
      note: '幹部自主登入自動註冊',
    };

    const updatedAuthConfig: AuthConfig = {
      ...authConfig,
      registeredCadres: [...authConfig.registeredCadres, newCadre],
    };

    return {
      success: true,
      session: {
        username: trimmedName,
        role: 'cadre',
        loginAt: Date.now(),
      },
      updatedAuthConfig,
      isNewCadre: true,
    };
  }

  return {
    success: false,
    message: '通行密碼錯誤！請向宿舍總幹部(Admin)確認線下分配的密碼',
  };
}

/**
 * Creates an audit log entry
 */
export function createAuditLogEntry(
  operatorName: string,
  role: UserRole,
  action: AuditLog['action'],
  actionName: string,
  description: string,
  details?: Record<string, any>
): AuditLog {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    operatorName,
    role,
    action,
    actionName,
    description,
    details,
  };
}

/**
 * Filters audit logs
 */
export function filterAuditLogs(
  logs: AuditLog[],
  searchQuery?: string,
  actionFilter?: string
): AuditLog[] {
  let result = logs;

  if (actionFilter && actionFilter !== 'all') {
    result = result.filter(l => l.action === actionFilter);
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter(
      l =>
        l.operatorName.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.actionName.toLowerCase().includes(q)
    );
  }

  return result.sort((a, b) => b.timestamp - a.timestamp);
}
