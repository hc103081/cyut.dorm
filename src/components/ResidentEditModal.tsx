import React, { useState } from 'react';
import { Resident, ResidentTag } from '../types/dorm.ts';
import { getFloorFromRoom } from '../utils/rollcallLogic.ts';
import {
  X,
  User,
  Hash,
  Bed,
  Tag,
  Phone,
  FileText,
  Save,
  Crown,
  Star,
  Award,
  Shield,
  Sparkles
} from 'lucide-react';

interface ResidentEditModalProps {
  resident: Resident;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedResident: Resident, originalResidentId: string) => void;
}

const PRESET_TAGS: Array<{ label: string; value: ResidentTag; color: string; icon: React.ReactNode }> = [
  { label: '無標籤 (一般生)', value: '', color: 'bg-slate-800 text-slate-300 border-slate-700', icon: null },
  { label: '舍長', value: '舍長', color: 'bg-amber-500/20 text-amber-300 border-amber-500/50', icon: <Crown className="w-3.5 h-3.5 text-amber-400" /> },
  { label: '樓長', value: '樓長', color: 'bg-purple-500/20 text-purple-300 border-purple-500/50', icon: <Star className="w-3.5 h-3.5 text-purple-400" /> },
  { label: '副樓長', value: '副樓長', color: 'bg-sky-500/20 text-sky-300 border-sky-500/50', icon: <Award className="w-3.5 h-3.5 text-sky-400" /> },
  { label: '室長', value: '室長', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50', icon: <Shield className="w-3.5 h-3.5 text-emerald-400" /> },
];

export const ResidentEditModal: React.FC<ResidentEditModalProps> = ({
  resident,
  isOpen,
  onClose,
  onSave,
}) => {
  const [room, setRoom] = useState<string>(resident.room);
  const [bed, setBed] = useState<string>(resident.bed);
  const [name, setName] = useState<string>(resident.name);
  const [studentId, setStudentId] = useState<string>(resident.studentId);
  const [selectedTag, setSelectedTag] = useState<ResidentTag>(resident.tag || '');
  const [customTagInput, setCustomTagInput] = useState<string>(
    resident.tag && !['舍長', '樓長', '副樓長', '室長', ''].includes(resident.tag)
      ? resident.tag
      : ''
  );
  const [isCustomTag, setIsCustomTag] = useState<boolean>(
    Boolean(resident.tag && !['舍長', '樓長', '副樓長', '室長', ''].includes(resident.tag))
  );
  const [phone, setPhone] = useState<string>(resident.phone || '');
  const [defaultNote, setDefaultNote] = useState<string>(resident.defaultNote || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRoom = room.trim();
    const finalBed = bed.trim();
    const finalName = name.trim();
    const finalStudentId = studentId.trim();

    if (!finalRoom || !finalBed || !finalName) {
      return;
    }

    const finalTag: ResidentTag | undefined = isCustomTag
      ? customTagInput.trim() || undefined
      : selectedTag || undefined;

    const floor = getFloorFromRoom(finalRoom);
    const newId = `${finalRoom}-${finalBed}`;

    const updated: Resident = {
      ...resident,
      id: newId,
      room: finalRoom,
      bed: finalBed,
      name: finalName,
      studentId: finalStudentId || resident.studentId || '未提供',
      floor,
      tag: finalTag,
      phone: phone.trim() || undefined,
      defaultNote: defaultNote.trim() || undefined,
    };

    onSave(updated, resident.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-2xl relative text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">編輯住宿人員資料</h3>
            <p className="text-xs text-slate-400">
              調整房號、姓名、學號，並設定「舍長 / 樓長 / 副樓長」專屬職稱標籤
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Room & Bed */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-blue-400" />
                <span>房號</span>
              </label>
              <input
                type="text"
                required
                value={room}
                onChange={e => setRoom(e.target.value)}
                placeholder="例如: 416"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
                <Bed className="w-3.5 h-3.5 text-blue-400" />
                <span>床號</span>
              </label>
              <select
                value={bed}
                onChange={e => setBed(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                <option value="1">1 床</option>
                <option value="2">2 床</option>
                <option value="3">3 床</option>
                <option value="4">4 床</option>
                <option value="5">5 床</option>
                <option value="6">6 床</option>
              </select>
            </div>
          </div>

          {/* Name & StudentId */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>住宿生姓名</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例如: 陳冠宇"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>學號</span>
              </label>
              <input
                type="text"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="例如: 11527014"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* TAG ASSIGNMENT - Highlighted Feature */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                <Tag className="w-4 h-4 text-purple-400" />
                <span>身分與職稱標籤 (舍長 / 樓長 / 副樓長)</span>
              </label>
              <span className="text-[10px] text-slate-400">
                點名與名單中將醒目標記
              </span>
            </div>

            {/* Preset Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.map(item => {
                const isSelected = !isCustomTag && selectedTag === item.value;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setIsCustomTag(false);
                      setSelectedTag(item.value);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? `${item.color} ring-2 ring-purple-500/50 shadow-md`
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setIsCustomTag(true);
                  if (!customTagInput) setCustomTagInput('特殊備註');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isCustomTag
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 ring-2 ring-indigo-500/50'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>自訂標籤...</span>
              </button>
            </div>

            {/* Custom Tag Input */}
            {isCustomTag && (
              <div className="pt-2">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={e => setCustomTagInput(e.target.value)}
                  placeholder="輸入自訂身分標籤 (例如: 常駐幹部、大專生、交換生)"
                  className="w-full bg-slate-900 border border-indigo-700/60 rounded-xl px-3 py-1.5 text-xs text-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>
            )}
          </div>

          {/* Optional Phone & Default Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>聯絡電話 (選填)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="例如: 0912-345-678"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>預設備註 / 叮嚀 (選填)</span>
              </label>
              <input
                type="text"
                value={defaultNote}
                onChange={e => setDefaultNote(e.target.value)}
                placeholder="例如: 實習晚歸、週四固定請假"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-purple-950/50 cursor-pointer transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>儲存人員資料</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
