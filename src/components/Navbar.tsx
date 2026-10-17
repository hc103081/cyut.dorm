import React from 'react';
import {
  CheckCircle2,
  Search,
  Users,
  ShieldCheck,
  Calendar,
  Layers,
  Laptop,
  Shield,
  User,
  LogOut,
  SlidersHorizontal
} from 'lucide-react';
import type { UserSession } from '../types/auth.ts';

export type AppMode = 'rollcall' | 'query' | 'roster' | 'admin';

interface NavbarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  selectedDate: string;
  totalResidents: number;
  rosterVersionName: string;
  currentUser: UserSession;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  selectedDate,
  totalResidents,
  rosterVersionName,
  currentUser,
  onLogout,
}) => {
  const isAdmin = currentUser.role === 'admin';

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 py-2 flex items-center justify-between gap-2">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="font-bold text-xs sm:text-base tracking-tight text-slate-100 truncate">
                宿舍點名
              </h1>
              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded font-bold border shrink-0 ${
                isAdmin
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {isAdmin ? '總幹部 Admin' : '幹部版'}
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
              <span className="shrink-0">{selectedDate}</span>
              <span>•</span>
              <span className="truncate max-w-[110px] sm:max-w-none text-slate-300">
                {rosterVersionName} ({totalResidents}人)
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
          <button
            onClick={() => onSelectMode('rollcall')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentMode === 'rollcall'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>點名模式</span>
          </button>

          <button
            onClick={() => onSelectMode('query')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentMode === 'query'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>查詢統計與平面圖</span>
          </button>

          <button
            onClick={() => onSelectMode('roster')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentMode === 'roster'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>名單版本庫</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => onSelectMode('admin')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                currentMode === 'admin'
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                  : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/80 hover:bg-indigo-900/60'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4 text-indigo-300" />
              <span>Admin 稽核與帳密</span>
            </button>
          )}
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* User tag */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] sm:text-xs">
            {isAdmin ? (
              <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            ) : (
              <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span className="font-semibold text-slate-200 truncate max-w-[80px] sm:max-w-[130px]">
              {currentUser.username}
            </span>
          </div>

          {/* Prominent Logout button */}
          <button
            onClick={onLogout}
            title="登出系統"
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-rose-950/80 hover:border-rose-800 hover:text-rose-300 text-slate-300 border border-slate-700 text-xs font-medium transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>登出</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Tabs - Clean, compact grid without awkward wrapping */}
      <nav className={`md:hidden max-w-md mx-auto px-1.5 pt-0.5 pb-1 grid ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} gap-1 bg-slate-950/85 text-[11px] font-medium border-t border-slate-800/80`}>
        <button
          onClick={() => onSelectMode('rollcall')}
          className={`flex items-center justify-center gap-1 py-1.5 px-0.5 rounded-lg transition-all cursor-pointer whitespace-nowrap min-w-0 ${
            currentMode === 'rollcall'
              ? 'bg-emerald-600 text-white shadow-sm font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          aria-label="點名模式"
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>點名</span>
        </button>

        <button
          onClick={() => onSelectMode('query')}
          className={`flex items-center justify-center gap-1 py-1.5 px-0.5 rounded-lg transition-all cursor-pointer whitespace-nowrap min-w-0 ${
            currentMode === 'query'
              ? 'bg-blue-600 text-white shadow-sm font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          aria-label="查詢紀錄"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span>查詢</span>
        </button>

        <button
          onClick={() => onSelectMode('roster')}
          className={`flex items-center justify-center gap-1 py-1.5 px-0.5 rounded-lg transition-all cursor-pointer whitespace-nowrap min-w-0 ${
            currentMode === 'roster'
              ? 'bg-purple-600 text-white shadow-sm font-bold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          aria-label="名單版本"
        >
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>名冊</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => onSelectMode('admin')}
            className={`flex items-center justify-center gap-1 py-1.5 px-0.5 rounded-lg transition-all cursor-pointer whitespace-nowrap min-w-0 ${
              currentMode === 'admin'
                ? 'bg-indigo-600 text-white shadow-sm font-bold'
                : 'text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/50'
            }`}
            aria-label="Admin管理"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span>Admin</span>
          </button>
        )}
      </nav>
    </header>
  );
};
