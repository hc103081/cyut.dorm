import React, { useState, useEffect } from 'react';
import { AuthConfig, UserSession } from '../types/auth.ts';
import { validateLogin, ValidateLoginResult } from '../utils/authLogic.ts';
import {
  ShieldCheck,
  User,
  KeyRound,
  Lock,
  ArrowRight,
  ShieldAlert,
  Info,
  CheckCircle2,
  Sparkles,
  UserPlus
} from 'lucide-react';

interface LoginScreenProps {
  authConfig: AuthConfig;
  onLoginSuccess: (params: {
    session: UserSession;
    updatedAuthConfig?: AuthConfig;
    isNewCadre?: boolean;
    keepLoggedIn: boolean;
  }) => void;
  loggedOutMessage?: string | null;
}

const LAST_LOGIN_NAME_KEY = 'dorm_last_cadre_name_v1';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  authConfig,
  onLoginSuccess,
  loggedOutMessage,
}) => {
  const [loginTab, setLoginTab] = useState<'cadre' | 'admin'>('cadre');
  const [nameInput, setNameInput] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_LOGIN_NAME_KEY) || '';
    } catch {
      return '';
    }
  });
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [keepLoggedIn, setKeepLoggedIn] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const targetName = loginTab === 'admin' ? 'admin' : nameInput;
    const result: ValidateLoginResult = validateLogin(targetName, passwordInput, authConfig);

    if (result.success && result.session) {
      if (loginTab === 'cadre') {
        try {
          localStorage.setItem(LAST_LOGIN_NAME_KEY, nameInput.trim());
        } catch {
          // ignore
        }
      }

      onLoginSuccess({
        session: result.session,
        updatedAuthConfig: result.updatedAuthConfig,
        isNewCadre: result.isNewCadre,
        keepLoggedIn,
      });
    } else {
      setErrorMessage(result.message || '登入失敗，請確認名稱與密碼');
    }
  };

  const handleQuickFill = (name: string, pass: string) => {
    setNameInput(name);
    setPasswordInput(pass);
    setErrorMessage(null);
  };

  return (
    <div className="w-full min-h-[calc(100dvh-40px)] bg-slate-950 flex flex-col justify-start sm:justify-center items-center px-3.5 py-4 sm:py-8 overflow-y-auto">
      {/* Logged out notice */}
      {loggedOutMessage && (
        <div className="mb-4 py-2 px-4 rounded-xl bg-blue-950/80 border border-blue-800 text-blue-200 text-xs flex items-center gap-2 animate-fade-in shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-blue-400" />
          <span>{loggedOutMessage}</span>
        </div>
      )}

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl relative mb-16 sm:mb-8">
        {/* Decorative background glow */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Icon & Title */}
        <div className="text-center mb-5">
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 mx-auto mb-2.5 shadow-lg shadow-emerald-950/50 flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
            宿舍點名助手 • 幹部安全通道
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            防止外人隨意訪問 • 實名操作查核日誌追蹤
          </p>
        </div>

        {/* Role Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800 mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setLoginTab('cadre');
              setPasswordInput('');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginTab === 'cadre'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            <span className="truncate">幹部登入 (自填名稱)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginTab('admin');
              setPasswordInput('');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              loginTab === 'admin'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span className="truncate">管理員 (Admin)</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {loginTab === 'cadre' ? (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center justify-between">
                  <span>您的幹部姓名 / 自取名稱</span>
                  <span className="text-[10px] text-emerald-400 font-normal flex items-center gap-1">
                    <UserPlus className="w-3 h-3" />
                    無帳號將自動註冊
                  </span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="輸入自訂名字 (例: 黃柏翰、4F 樓長)"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                  />
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  💡 不需 Admin 事先建立帳號，只要名稱 + 通行密碼即可自動新增帳號並登入。
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center justify-between">
                  <span>幹部通行密碼</span>
                  <span className="text-[10px] text-emerald-400 font-normal">由總幹部(Admin)線下告知</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="請輸入線下通行密碼"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Quick Fill suggestions for cadres */}
              <div className="pt-0.5">
                <span className="text-[11px] text-slate-500 block mb-1">快捷代入預設密碼測試：</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickFill('416-2 樓長 (黃柏翰)', authConfig.cadreOfflinePasscode)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 cursor-pointer"
                  >
                    416-2 樓長 (黃柏翰)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('3F 樓長', authConfig.cadreOfflinePasscode)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 cursor-pointer"
                  >
                    3F 樓長
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  管理員帳號
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-blue-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    disabled
                    value="admin (宿舍總幹部)"
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-400 focus:outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center justify-between">
                  <span>管理員最高密碼</span>
                  <span className="text-[10px] text-blue-400 font-normal">預設: admin888</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="請輸入管理員密碼"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setPasswordInput(authConfig.adminPassword)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800/80 cursor-pointer"
                >
                  代入預設管理員密碼 ({authConfig.adminPassword})
                </button>
              </div>
            </>
          )}

          {/* Keep Logged In Checkbox */}
          <div className="pt-1 flex items-center gap-2">
            <input
              type="checkbox"
              id="keepLoggedIn"
              checked={keepLoggedIn}
              onChange={e => setKeepLoggedIn(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-800 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer"
            />
            <label htmlFor="keepLoggedIn" className="text-xs text-slate-300 select-none cursor-pointer">
              保持瀏覽器登入狀態 (關閉瀏覽器或重整後不需重新登入)
            </label>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2 animate-shake">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full py-3.5 rounded-2xl text-sm font-black text-white shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer touch-manipulation min-h-[48px] select-none ${
              loginTab === 'cadre'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/60'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/60'
            }`}
          >
            <span>{loginTab === 'cadre' ? '以幹部身分進入系統' : '進入 Admin 管理後台'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Security Note Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            {loginTab === 'cadre'
              ? '您輸入的幹部姓名將如實記錄於每次點名與操作歷史日誌中，供宿舍總管理員查核。'
              : '管理員可管理通行密碼、查看幹部名冊自主註冊紀錄，以及審核全系統操作異動歷史。'}
          </span>
        </div>
      </div>
    </div>
  );
};
