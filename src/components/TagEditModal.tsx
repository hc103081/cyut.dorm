import React, { useState } from 'react';
import { ResidentTag } from '../types/dorm.ts';
import { ResidentTagBadge } from './ResidentTagBadge.tsx';
import {
  X,
  Tag,
  Crown,
  Star,
  Award,
  Shield,
  Check,
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface TagEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetName: string; // e.g. "黃柏翰" or "416-2 陳冠宇"
  currentTag?: ResidentTag | null;
  targetType: 'cadre' | 'resident';
  onSaveTag: (newTag?: string) => void;
}

export const TagEditModal: React.FC<TagEditModalProps> = ({
  isOpen,
  onClose,
  targetName,
  currentTag,
  targetType,
  onSaveTag,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>(() => currentTag || '');
  const [customTagInput, setCustomTagInput] = useState<string>(() => {
    if (currentTag && !['舍長', '樓長', '副樓長', '室長', '幹部'].includes(currentTag)) {
      return currentTag;
    }
    return '';
  });
  const [isCustomMode, setIsCustomMode] = useState<boolean>(() => {
    return Boolean(currentTag && !['舍長', '樓長', '副樓長', '室長', '幹部'].includes(currentTag));
  });

  if (!isOpen) return null;

  const presetTags: Array<{ tag: string; label: string; icon: React.ReactNode; desc: string }> = [
    {
      tag: '舍長',
      label: '舍長',
      icon: <Crown className="w-4 h-4 text-amber-400" />,
      desc: '宿舍最高總負責幹部，掌管全棟秩序與點名總覽',
    },
    {
      tag: '樓長',
      label: '樓長',
      icon: <Star className="w-4 h-4 text-purple-400" />,
      desc: '負責該樓層主要巡房、點名與住宿生聯絡',
    },
    {
      tag: '副樓長',
      label: '副樓長',
      icon: <Award className="w-4 h-4 text-sky-400" />,
      desc: '協助樓長巡房、代理點名與寢室宣導',
    },
    {
      tag: '室長',
      label: '室長',
      icon: <Shield className="w-4 h-4 text-emerald-400" />,
      desc: '個別寢室代表，協助同寢點名回報與公物維護',
    },
    {
      tag: '幹部',
      label: '一般幹部',
      icon: <Tag className="w-4 h-4 text-indigo-400" />,
      desc: '宿舍生活輔導員、實習幹部或活動巡查人員',
    },
  ];

  const effectiveTag = isCustomMode ? customTagInput.trim() : selectedPreset;

  const handleSave = () => {
    const finalTag = effectiveTag ? effectiveTag.trim() : undefined;
    onSaveTag(finalTag);
    onClose();
  };

  const handleClearTag = () => {
    onSaveTag(undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative text-slate-200 flex flex-col max-h-[90dvh] my-auto overflow-hidden">
        
        {/* Header (Sticky top) */}
        <div className="shrink-0 p-4 sm:p-5 pb-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">修改身分職銜標籤</h3>
              <p className="text-xs text-slate-400">
                對象：<span className="text-purple-300 font-bold">{targetName}</span> ({targetType === 'cadre' ? '幹部帳號' : '住宿生'})
              </p>
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

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain text-xs">
          
          {/* Live Preview Box */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 font-medium">標籤即時預覽效果：</span>
            <div>
              {effectiveTag ? (
                <ResidentTagBadge tag={effectiveTag} size="md" />
              ) : (
                <span className="text-slate-500 italic text-[11px] bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                  (無標籤 / 一般身分)
                </span>
              )}
            </div>
          </div>

          {/* Preset Tags Grid */}
          <div className="space-y-2">
            <label className="block text-slate-300 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>點選快速賦予職銜標籤：</span>
            </label>

            <div className="grid grid-cols-1 gap-2">
              {presetTags.map(p => {
                const isSelected = !isCustomMode && selectedPreset === p.tag;
                return (
                  <button
                    key={p.tag}
                    type="button"
                    onClick={() => {
                      setIsCustomMode(false);
                      setSelectedPreset(p.tag);
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-950/60 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/50'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                        {p.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 flex items-center gap-2">
                          <span>{p.label}</span>
                          <ResidentTagBadge tag={p.tag} size="xs" />
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {p.desc}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-purple-400 bg-purple-600' : 'border-slate-700 bg-slate-900'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Tag Option */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsCustomMode(true)}
                className={`font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
                  isCustomMode ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                  isCustomMode ? 'border-blue-400 bg-blue-600' : 'border-slate-700 bg-slate-900'
                }`}>
                  {isCustomMode && <Check className="w-2 h-2 text-white" />}
                </div>
                <span>自訂特殊職銜標籤</span>
              </button>
              <span className="text-[10px] text-slate-500">自由輸入任意稱謂</span>
            </div>

            {isCustomMode && (
              <div className="space-y-1.5 pt-1">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={e => setCustomTagInput(e.target.value)}
                  placeholder="例如：活動總召、總務幹部、各樓代表、實習幹部"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-bold"
                />
                <p className="text-[11px] text-slate-400">
                  自訂標籤將以典雅靛藍色徽章顯示在點名房卡、名冊清單與報表中。
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Footer (Sticky bottom, fully visible on mobile) */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-2.5 pb-safe">
          <button
            type="button"
            onClick={handleClearTag}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="移除標籤，恢復一般無標籤狀態"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>清除標籤</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-950/50 cursor-pointer transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>套用標籤</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
