import React, { useState } from 'react';
import { CadreAccount, AuthConfig } from '../types/auth.ts';
import {
  X,
  User,
  Shield,
  KeyRound,
  Check,
  Phone,
  FileText,
  Crown,
  Star,
  Award,
  Layers,
  Power,
  RotateCcw
} from 'lucide-react';

interface CadreEditModalProps {
  cadre: CadreAccount;
  authConfig: AuthConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCadre: CadreAccount) => void;
}

export const CadreEditModal: React.FC<CadreEditModalProps> = ({
  cadre,
  authConfig,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState<string>(cadre.name);
  const [assignedFloor, setAssignedFloor] = useState<string>(cadre.assignedFloor || '全棟');
  const [tag, setTag] = useState<string>(cadre.tag || '幹部');
  const [customTag, setCustomTag] = useState<string>('');
  const [isCustomTag, setIsCustomTag] = useState<boolean>(
    !['舍長', '樓長', '副樓長', '室長', '幹部'].includes(cadre.tag || '幹部')
  );
  const [status, setStatus] = useState<'active' | 'suspended'>(cadre.status || 'active');
  const [phone, setPhone] = useState<string>(cadre.phone || '');
  const [note, setNote] = useState<string>(cadre.note || '');
  
  // Password management
  const [hasCustomPassword, setHasCustomPassword] = useState<boolean>(Boolean(cadre.customPassword));
  const [customPassword, setCustomPassword] = useState<string>(cadre.customPassword || '');

  if (!isOpen) return null;

  const presetTags = ['舍長', '樓長', '副樓長', '室長', '幹部'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalTag = isCustomTag ? customTag.trim() || '幹部' : tag;

    const updatedCadre: CadreAccount = {
      ...cadre,
      name: name.trim(),
      assignedFloor: assignedFloor === '全棟' ? undefined : assignedFloor,
      tag: finalTag,
      status,
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      customPassword: hasCustomPassword && customPassword.trim() ? customPassword.trim() : undefined,
    };

    onSave(updatedCadre);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative text-slate-200 flex flex-col max-h-[90dvh] my-auto overflow-hidden">
        
        {/* Header (Sticky top) */}
        <div className="shrink-0 p-4 sm:p-5 pb-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">編輯幹部個人資料與狀態</h3>
              <p className="text-xs text-slate-400">管理幹部帳號權限、負責區域與線下通行密碼</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="cadre-edit-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain text-xs">
          
          {/* Status Toggle Box (啟用 / 停用) */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Power className="w-4 h-4 text-emerald-400" />
                <span>帳號使用狀態</span>
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                status === 'active'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                {status === 'active' ? '● 正常啟用中' : '● 已停用 (禁止登入)'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                  status === 'active'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span>正常啟用 (允許登入)</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('suspended')}
                className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                  status === 'suspended'
                    ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${status === 'suspended' ? 'bg-rose-400' : 'bg-slate-600'}`} />
                <span>停用帳號 (拒絕登入)</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              若幹部已卸任、調寢或暫停巡房，可將狀態切換為「已停用」，系統將安全阻擋其登入並保留所有過往稽核日誌。
            </p>
          </div>

          {/* Name & Floor Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-400" />
                <span>幹部真實姓名 *</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="例如：黃柏翰"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>負責樓層責任區</span>
              </label>
              <select
                value={assignedFloor}
                onChange={e => setAssignedFloor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="4">4 樓負責人</option>
                <option value="3">3 樓負責人</option>
                <option value="2">2 樓負責人</option>
                <option value="全棟">全棟幹部 (巡房可看全部樓層)</option>
              </select>
            </div>
          </div>

          {/* Cadre Role / Tag Selection */}
          <div className="space-y-2">
            <label className="block text-slate-300 font-bold flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>幹部職銜標籤</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {presetTags.map(t => {
                const isSelected = !isCustomTag && tag === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setIsCustomTag(false);
                      setTag(t);
                    }}
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === '舍長' && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    {t === '樓長' && <Star className="w-3.5 h-3.5 text-purple-400" />}
                    {t === '副樓長' && <Award className="w-3.5 h-3.5 text-blue-400" />}
                    <span>{t}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsCustomTag(true)}
                className={`px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
                  isCustomTag
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                ＋ 自訂稱謂
              </button>
            </div>

            {isCustomTag && (
              <input
                type="text"
                value={customTag}
                onChange={e => setCustomTag(e.target.value)}
                placeholder="請輸入自訂幹部稱謂 (例如: 總務長、活動副社長)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 mt-2"
              />
            )}
          </div>

          {/* Password Management Box */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>登入密碼模式</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {hasCustomPassword ? '個別專屬密碼' : `通用通行密碼 (${authConfig.cadreOfflinePasscode})`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setHasCustomPassword(false);
                  setCustomPassword('');
                }}
                className={`flex-1 py-1.5 px-2.5 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                  !hasCustomPassword
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                使用全域通用密碼
              </button>

              <button
                type="button"
                onClick={() => setHasCustomPassword(true)}
                className={`flex-1 py-1.5 px-2.5 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                  hasCustomPassword
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                設定專屬個別密碼
              </button>
            </div>

            {hasCustomPassword ? (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customPassword}
                    onChange={e => setCustomPassword(e.target.value)}
                    placeholder="請輸入該幹部專屬登入密碼"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setHasCustomPassword(false);
                      setCustomPassword('');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 cursor-pointer shrink-0"
                    title="清除專屬密碼"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>清除</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  設定個別密碼後，該幹部僅能使用此專屬密碼登入，通用線下密碼對其不再生效。
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                目前使用全校幹部通用密碼 <code className="text-emerald-400 font-mono font-bold bg-slate-900 px-1 py-0.5 rounded">{authConfig.cadreOfflinePasscode}</code>。
              </p>
            )}
          </div>

          {/* Contact Phone & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>聯絡電話 (選填)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="例如：0912-345-678"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>幹部備註說明 (選填)</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="例如：416 室室長、巡房代理人"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

        </form>

        {/* Footer (Sticky bottom, fully visible on mobile) */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-end gap-2.5 pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="submit"
            form="cadre-edit-form"
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-950/50 cursor-pointer transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>儲存幹部資料</span>
          </button>
        </div>

      </div>
    </div>
  );
};
