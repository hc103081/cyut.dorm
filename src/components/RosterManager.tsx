import React, { useState, useRef, useMemo } from 'react';
import { Resident, RosterVersion, ResidentTag } from '../types/dorm.ts';
import { parseRosterText, getFloorFromRoom } from '../utils/rollcallLogic.ts';
import { ResidentTagBadge } from './ResidentTagBadge.tsx';
import { ResidentEditModal } from './ResidentEditModal.tsx';
import { TagEditModal } from './TagEditModal.tsx';
import {
  Users,
  Plus,
  Upload,
  RefreshCw,
  Check,
  AlertCircle,
  Trash2,
  Download,
  Info,
  Layers,
  Database,
  Calendar,
  Star,
  FileSpreadsheet,
  FileText,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  Edit3,
  Search,
  Tag,
  Crown,
  Award,
  Shield,
  Filter
} from 'lucide-react';

interface RosterManagerProps {
  rosterVersions: RosterVersion[];
  currentRosterVersion: RosterVersion;
  onSetActiveVersion: (versionId: string) => void;
  onAddNewVersion: (name: string, effectiveDate: string, residents: Resident[], setAsCurrent: boolean, note?: string) => void;
  onUpdateVersionResidents: (versionId: string, residents: Resident[]) => void;
  onDeleteVersion: (versionId: string) => void;
  onExportDatabase: () => void;
  onImportDatabase: (jsonStr: string) => boolean;
  onResetDatabase: () => void;
  onRefreshSessions?: () => void;
}

export const RosterManager: React.FC<RosterManagerProps> = ({
  rosterVersions,
  currentRosterVersion,
  onSetActiveVersion,
  onAddNewVersion,
  onUpdateVersionResidents,
  onDeleteVersion,
  onExportDatabase,
  onImportDatabase,
  onResetDatabase,
  onRefreshSessions,
}) => {
  const [activeTab, setActiveTab] = useState<'import_file' | 'versions' | 'view_residents'>('import_file');
  const [inspectingVersionId, setInspectingVersionId] = useState<string>(currentRosterVersion.id);

  // File import state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New version form state
  const [newVersionName, setNewVersionName] = useState<string>('115 學年度第 1 學期最新名單');
  const [newEffectiveDate, setNewEffectiveDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [setAsDefault, setSetAsDefault] = useState<boolean>(true);
  const [versionNote, setVersionNote] = useState<string>('檔案匯入之最新在宿學生名單');
  const [rawText, setRawText] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<{ residents: Resident[]; errors: string[] } | null>(null);
  const [inputMethod, setInputMethod] = useState<'file' | 'text'>('file');

  // Single add form state
  const [newRoom, setNewRoom] = useState<string>('');
  const [newBed, setNewBed] = useState<string>('1');
  const [newName, setNewName] = useState<string>('');
  const [newStudentId, setNewStudentId] = useState<string>('');
  const [newTag, setNewTag] = useState<string>('');
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [tagEditingResident, setTagEditingResident] = useState<Resident | null>(null);
  const [residentToDelete, setResidentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [quickConfirmResidentId, setQuickConfirmResidentId] = useState<string | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<RosterVersion | null>(null);
  const [residentSearchQuery, setResidentSearchQuery] = useState<string>('');
  const [residentFilterFloor, setResidentFilterFloor] = useState<string>('all');
  const [residentFilterTag, setResidentFilterTag] = useState<string>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const inspectedVersion = rosterVersions.find(v => v.id === inspectingVersionId) || currentRosterVersion;

  // File processor: read .csv, .txt, .tsv
  const processUploadedFile = (file: File) => {
    if (!file) return;

    setUploadedFileName(file.name);
    const sizeKB = (file.size / 1024).toFixed(1);
    setUploadedFileSize(`${sizeKB} KB`);

    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      if (text) {
        setRawText(text);
        const result = parseRosterText(text);
        setParsedPreview(result);

        // Auto-suggest version name from file name if appropriate
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        if (cleanName.length > 2) {
          setNewVersionName(cleanName.includes('名單') ? cleanName : `${cleanName} 學生名單`);
        }
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  // Text parsing preview
  const handleParseText = () => {
    if (!rawText.trim()) return;
    const result = parseRosterText(rawText);
    setParsedPreview(result);
  };

  // Confirm create new version
  const handleConfirmCreateVersion = () => {
    if (!parsedPreview || parsedPreview.residents.length === 0) {
      showToast('⚠️ 請先上傳名單檔案並成功解析內容！');
      return;
    }
    if (!newVersionName.trim()) {
      showToast('⚠️ 請填寫名單版本名稱！');
      return;
    }

    onAddNewVersion(
      newVersionName.trim(),
      newEffectiveDate,
      parsedPreview.residents,
      setAsDefault,
      versionNote.trim() || undefined
    );

    showToast(`已成功建立最新名單版本「${newVersionName}」(${parsedPreview.residents.length}人)！`);
    setUploadedFileName(null);
    setRawText('');
    setParsedPreview(null);
    setActiveTab('versions');
  };

  // Single resident add
  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.trim() || !newBed.trim() || !newName.trim()) {
      showToast('⚠️ 請填寫房號、床號與姓名');
      return;
    }

    const room = newRoom.trim();
    const bed = newBed.trim();
    const id = `${room}-${bed}`;
    const floor = getFloorFromRoom(room);

    const newResident: Resident = {
      id,
      room,
      bed,
      name: newName.trim(),
      studentId: newStudentId.trim() || '未提供',
      floor,
      tag: newTag.trim() || undefined,
    };

    const updated = inspectedVersion.residents.filter(r => r.id !== id);
    updated.push(newResident);
    onUpdateVersionResidents(inspectedVersion.id, updated);

    showToast(`已在名單「${inspectedVersion.name}」中新增 [${id}] ${newName}${newTag ? ` [${newTag}]` : ''}`);
    setNewRoom('');
    setNewName('');
    setNewStudentId('');
    setNewTag('');
  };

  // Save edited resident
  const handleSaveEditResident = (updated: Resident, originalId: string) => {
    const updatedList = inspectedVersion.residents.map(r => r.id === originalId ? updated : r);
    if (!inspectedVersion.residents.some(r => r.id === originalId)) {
      updatedList.push(updated);
    }
    onUpdateVersionResidents(inspectedVersion.id, updatedList);
    showToast(`已成功修改 [${updated.room}-${updated.bed}] ${updated.name} 的資料與身分標籤！`);
    setEditingResident(null);
  };

  // Direct delete execution
  const confirmDirectDeleteResident = (id: string, name: string) => {
    const updated = inspectedVersion.residents.filter(r => r.id !== id);
    onUpdateVersionResidents(inspectedVersion.id, updated);
    showToast(`已成功移除 [${id}] ${name}！`);
    setResidentToDelete(null);
    setQuickConfirmResidentId(null);
  };

  // Delete single resident (Direct double-tap or Modal, safe for iframes)
  const handleDeleteResident = (id: string, name: string) => {
    if (quickConfirmResidentId === id) {
      confirmDirectDeleteResident(id, name);
      return;
    }
    setQuickConfirmResidentId(id);
    setResidentToDelete({ id, name });
  };

  const confirmDeleteResident = () => {
    if (!residentToDelete) return;
    confirmDirectDeleteResident(residentToDelete.id, residentToDelete.name);
  };

  // Delete version (In-App Modal, safe for iframes)
  const confirmDeleteVersion = () => {
    if (!versionToDelete) return;
    onDeleteVersion(versionToDelete.id);
    showToast(`已成功刪除版本「${versionToDelete.name}」！`);
    setVersionToDelete(null);
  };

  return (
    <div className="w-full pb-24 px-3 pt-3 md:px-6 md:pt-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-purple-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          {toastMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl mb-4 text-xs font-medium max-w-4xl mx-auto">
        <button
          onClick={() => setActiveTab('import_file')}
          className={`flex-1 py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'import_file' ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>檔案傳入名單</span>
        </button>

        <button
          onClick={() => setActiveTab('versions')}
          className={`flex-1 py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'versions' ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>名單版本庫 ({rosterVersions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('view_residents')}
          className={`flex-1 py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'view_residents' ? 'bg-purple-600 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>檢視人員名冊</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* TAB 1: FILE IMPORT (人員名單匯入使用檔案傳入) */}
        {activeTab === 'import_file' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 space-y-4">
            <div className="flex items-start gap-2.5 bg-purple-950/40 border border-purple-800/60 p-3 rounded-xl text-xs text-purple-200">
              <FileSpreadsheet className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm">人員名單檔案匯入說明：</span>
                <p className="text-xs text-purple-300 mt-1 leading-relaxed">
                  支援直接拖曳或選取 <strong>.csv、.txt、.tsv</strong> 檔案（例如從學校住宿組系統、Excel「另存為 CSV」的檔案）。<br />
                  檔案中每行欄位順序：<strong>第一欄 房號、第二欄 床號、第三欄 姓名、第四欄 學號</strong>
                </p>
              </div>
            </div>

            {/* Input Method Toggle */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setInputMethod('file')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  inputMethod === 'file' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>上傳 CSV / TXT 檔案</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMethod('text')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  inputMethod === 'text' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>手動貼上文字</span>
              </button>
            </div>

            {/* 1. FILE UPLOAD DROPZONE */}
            {inputMethod === 'file' && (
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-purple-400 bg-purple-950/40 scale-[1.01]'
                    : uploadedFileName
                    ? 'border-emerald-500/80 bg-emerald-950/20'
                    : 'border-slate-700 bg-slate-950 hover:border-purple-500/60 hover:bg-slate-900/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {uploadedFileName ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">{uploadedFileName}</div>
                      <div className="text-xs text-emerald-400 mt-0.5">
                        檔案大小: {uploadedFileSize} • 點擊可重新選擇檔案
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-200">
                        點擊選取檔案 或 將名單檔案拖曳至此
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        支援學校名單 .csv、.txt、.tsv 格式 (自動偵測編碼)
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. TEXT PASTING ALTERNATIVE */}
            {inputMethod === 'text' && (
              <div>
                <textarea
                  rows={6}
                  placeholder={`在此貼上名單文字，例如：\n416\t1\t張家豪\t11527013\n416\t2\t陳冠宇\t11527014\n416\t3\t林子軒\t11527015\n416\t4\t黃建廷\t11527016`}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={handleParseText}
                  disabled={!rawText.trim()}
                  className="mt-2 py-1.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-bold border border-slate-700"
                >
                  解析文字名單
                </button>
              </div>
            )}

            {/* Version Metadata Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">新名單版本名稱</label>
                <input
                  type="text"
                  placeholder="例如: 115 學年度第 1 學期最新名單"
                  value={newVersionName}
                  onChange={e => setNewVersionName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-medium focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">生效起算日期</label>
                <input
                  type="date"
                  value={newEffectiveDate}
                  onChange={e => setNewEffectiveDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-medium focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">備註說明 (選填)</label>
              <input
                type="text"
                placeholder="例如: 開學第 3 週換宿更新名單"
                value={versionNote}
                onChange={e => setVersionNote(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-purple-300 font-medium">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={e => setSetAsDefault(e.target.checked)}
                  className="w-4 h-4 accent-purple-500 rounded"
                />
                <span>直接設為預設使用名單（之後的點名自動套用此版本，歷史紀錄仍完整保留）</span>
              </label>
            </div>

            {/* Parse Preview */}
            {parsedPreview && (
              <div className="border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    成功解析 {parsedPreview.residents.length} 筆人員
                  </span>
                  {parsedPreview.errors.length > 0 && (
                    <span className="text-xs text-rose-400">
                      有 {parsedPreview.errors.length} 行格式有誤
                    </span>
                  )}
                </div>

                {parsedPreview.errors.length > 0 && (
                  <div className="bg-rose-950/40 border border-rose-800/80 p-2.5 rounded-xl text-[11px] text-rose-300 mb-2 max-h-24 overflow-y-auto">
                    {parsedPreview.errors.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl p-3 bg-slate-950 mb-3 text-xs space-y-1">
                  {parsedPreview.residents.slice(0, 20).map(r => (
                    <div key={r.id} className="text-slate-300 flex justify-between py-0.5 border-b border-slate-900">
                      <span className="font-mono font-bold text-slate-200">[{r.room}-{r.bed}]</span>
                      <span className="font-bold text-white">{r.name}</span>
                      <span className="font-mono text-slate-400">{r.studentId}</span>
                      <span className="text-slate-500">{r.floor} 樓</span>
                    </div>
                  ))}
                  {parsedPreview.residents.length > 20 && (
                    <div className="text-center text-slate-500 text-xs py-1">
                      ...以及其他 {parsedPreview.residents.length - 20} 筆
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleConfirmCreateVersion}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>確認匯入並建立名單版本「${newVersionName}」</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ROSTER VERSIONS LIST */}
        {activeTab === 'versions' && (
          <div className="space-y-3">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
              <div>
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  <span>宿舍人員名單版本管理</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  支援維護多學期或最新換宿名單；設定為「預設」的名單將自動套用於今日起的新點名，過去日期的點名仍完整保留該日生效的歷史名冊！
                </p>
              </div>

              <button
                onClick={() => setActiveTab('import_file')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>檔案匯入最新名單</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rosterVersions.map(version => {
                const isCurrent = version.isCurrent;
                return (
                  <div
                    key={version.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-purple-950/30 border-purple-600/80 ring-2 ring-purple-500/20 shadow-md'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-white">{version.name}</span>
                          {isCurrent ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current text-amber-400" />
                              當前最新預設
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                              歷史存檔
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                          <span>生效日: {version.effectiveDate}</span>
                          <span>•</span>
                          <span>在宿人數: <strong>{version.residents.length}</strong> 人</span>
                        </div>
                      </div>
                    </div>

                    {version.note && (
                      <p className="text-xs text-slate-400/90 bg-slate-950/60 p-2 rounded-xl mb-3 border border-slate-800/80">
                        {version.note}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                      {!isCurrent && (
                        <button
                          onClick={() => {
                            onSetActiveVersion(version.id);
                            showToast(`已切換預設使用「${version.name}」！`);
                          }}
                          className="flex-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold"
                        >
                          設為最新預設
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setInspectingVersionId(version.id);
                          setActiveTab('view_residents');
                        }}
                        className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700"
                      >
                        查看名單 ({version.residents.length}人)
                      </button>

                      {rosterVersions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setVersionToDelete(version)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 cursor-pointer transition-colors"
                          title="刪除此版本"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 本機資料庫 JSON 匯出備份與還原 */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 mt-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    <span>本機資料庫 JSON 檔案備份與重設</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    系統已直接透過 Vercel 連線 Supabase 雲端資料庫；在此您亦可隨時匯出完整本機離線 JSON 檔案進行實體備份或進行備份還原。
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onExportDatabase}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 shadow-sm"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>下載完整備份 (JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => {
                        const content = ev.target?.result as string;
                        if (content && onImportDatabase(content)) {
                          showToast('成功由 JSON 檔案還原資料庫！');
                        } else {
                          showToast('還原失敗：檔案格式不正確');
                        }
                      };
                      reader.readAsText(file);
                    };
                    input.click();
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 shadow-sm"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>從 JSON 備份檔還原</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 rounded-xl text-xs font-medium border border-slate-700 transition-colors ml-auto cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>重設示範資料庫</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VIEW & EDIT RESIDENTS */}
        {activeTab === 'view_residents' && (
          <div className="space-y-3">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">目前檢視名單版本:</span>
                <select
                  value={inspectedVersion.id}
                  onChange={e => setInspectingVersionId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-purple-300 font-bold focus:outline-none"
                >
                  {rosterVersions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.residents.length}人){v.isCurrent ? ' [最新使用中]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-slate-400">
                本版本共 <strong>{inspectedVersion.residents.length}</strong> 位住宿生
                {inspectedVersion.residents.filter(r => r.tag && r.tag !== '無').length > 0 && (
                  <span className="ml-2 text-purple-300 font-semibold">
                    (含幹部標籤 {inspectedVersion.residents.filter(r => r.tag && r.tag !== '無').length} 人)
                  </span>
                )}
              </div>
            </div>

            {/* Quick Add Single Resident */}
            <form onSubmit={handleAddSingle} className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
              <span className="text-xs font-bold text-slate-200 block mb-2">
                ＋ 新增單筆人員到此版本 (可直接指定 舍長 / 樓長 / 副樓長)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                <input
                  type="text"
                  placeholder="房號 (例: 416)"
                  value={newRoom}
                  onChange={e => setNewRoom(e.target.value)}
                  required
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
                />
                <select
                  value={newBed}
                  onChange={e => setNewBed(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                >
                  <option value="1">1 床</option>
                  <option value="2">2 床</option>
                  <option value="3">3 床</option>
                  <option value="4">4 床</option>
                  <option value="5">5 床</option>
                  <option value="6">6 床</option>
                </select>
                <input
                  type="text"
                  placeholder="姓名 (例: 陳冠宇)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-bold"
                />
                <input
                  type="text"
                  placeholder="學號 (例: 11527014)"
                  value={newStudentId}
                  onChange={e => setNewStudentId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500 font-mono"
                />
                <select
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-purple-300 font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="">無標籤 (一般生)</option>
                  <option value="舍長">👑 舍長</option>
                  <option value="樓長">🌟 樓長</option>
                  <option value="副樓長">🔷 副樓長</option>
                  <option value="室長">🟢 室長</option>
                </select>
                <button
                  type="submit"
                  className="col-span-2 sm:col-span-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm"
                >
                  新增至名單
                </button>
              </div>
            </form>

            {/* Filter and Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={residentSearchQuery}
                    onChange={e => setResidentSearchQuery(e.target.value)}
                    placeholder="搜尋姓名、學號、房號、或標籤 (如: 樓長)..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  {residentSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setResidentSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={residentFilterFloor}
                    onChange={e => setResidentFilterFloor(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="all">全部樓層</option>
                    {Array.from(new Set(inspectedVersion.residents.map(r => r.floor))).sort().map(f => (
                      <option key={f} value={f}>{f} 樓</option>
                    ))}
                  </select>

                  <select
                    value={residentFilterTag}
                    onChange={e => setResidentFilterTag(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-purple-300 font-bold focus:outline-none"
                  >
                    <option value="all">全部身分標籤</option>
                    <option value="舍長">👑 僅看舍長</option>
                    <option value="樓長">🌟 僅看樓長</option>
                    <option value="副樓長">🔷 僅看副樓長</option>
                    <option value="室長">🟢 僅看室長</option>
                    <option value="none">僅看一般生</option>
                  </select>
                </div>
              </div>

              {/* Tag shortcut quick pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pt-1">
                <span className="text-slate-400 shrink-0 flex items-center gap-1 text-[10px]">
                  <Filter className="w-3 h-3" />
                  <span>快捷篩選:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setResidentFilterTag('all')}
                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                    residentFilterTag === 'all'
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  全部 ({inspectedVersion.residents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setResidentFilterTag('舍長')}
                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                    residentFilterTag === '舍長'
                      ? 'bg-amber-500/30 text-amber-300 border-amber-500 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  👑 舍長 ({inspectedVersion.residents.filter(r => r.tag === '舍長').length})
                </button>
                <button
                  type="button"
                  onClick={() => setResidentFilterTag('樓長')}
                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                    residentFilterTag === '樓長'
                      ? 'bg-purple-500/30 text-purple-300 border-purple-500 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  🌟 樓長 ({inspectedVersion.residents.filter(r => r.tag === '樓長').length})
                </button>
                <button
                  type="button"
                  onClick={() => setResidentFilterTag('副樓長')}
                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                    residentFilterTag === '副樓長'
                      ? 'bg-sky-500/30 text-sky-300 border-sky-500 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  🔷 副樓長 ({inspectedVersion.residents.filter(r => r.tag === '副樓長').length})
                </button>
              </div>
            </div>

            {/* Residents List */}
            <div className="space-y-1.5 max-h-[58vh] overflow-y-auto pr-1">
              {(() => {
                const filtered = inspectedVersion.residents.filter(r => {
                  if (residentFilterFloor !== 'all' && r.floor !== residentFilterFloor) return false;
                  if (residentFilterTag !== 'all') {
                    if (residentFilterTag === 'none') {
                      if (r.tag && r.tag !== '無') return false;
                    } else {
                      if (r.tag !== residentFilterTag) return false;
                    }
                  }
                  if (residentSearchQuery.trim()) {
                    const q = residentSearchQuery.toLowerCase().trim();
                    return (
                      r.room.includes(q) ||
                      r.bed.includes(q) ||
                      r.name.toLowerCase().includes(q) ||
                      r.studentId.includes(q) ||
                      (r.tag && r.tag.toLowerCase().includes(q))
                    );
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                      查無符合篩選條件的學生名單
                    </div>
                  );
                }

                return filtered.map(r => (
                  <div
                    key={r.id}
                    className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="font-mono font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 shrink-0">
                        {r.room}-{r.bed}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-sm">{r.name}</span>
                          {/* TAG BADGE */}
                          {r.tag && (
                            <ResidentTagBadge
                              tag={r.tag}
                              size="xs"
                              onClick={() => setTagEditingResident(r)}
                              className="cursor-pointer hover:ring-1 hover:ring-purple-400"
                            />
                          )}
                          {r.defaultNote && (
                            <span className="text-[10px] text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/30 truncate max-w-[160px]">
                              {r.defaultNote}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 font-mono text-[11px] truncate flex items-center gap-2">
                          <span>學號: {r.studentId}</span>
                          {r.phone && <span>• 電話: {r.phone}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setTagEditingResident(r)}
                        className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="修改身分職銜標籤 (舍長/樓長/副樓長/室長/自訂)"
                      >
                        <Tag className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingResident(r)}
                        className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="編輯人員完整資料"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {/* Delete Resident: Quick Inline Confirm or Trash Icon */}
                      {quickConfirmResidentId === r.id ? (
                        <div className="flex items-center gap-1 bg-rose-950/90 border border-rose-500 rounded-xl px-2 py-1 animate-fade-in shadow-md">
                          <span className="text-[10px] text-rose-200 font-bold whitespace-nowrap">移除？</span>
                          <button
                            type="button"
                            onClick={() => confirmDirectDeleteResident(r.id, r.name)}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            確定
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickConfirmResidentId(null);
                              setResidentToDelete(null);
                            }}
                            className="px-1.5 py-0.5 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteResident(r.id, r.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="刪除"
                          aria-label={`刪除住宿生 ${r.name}`}
                        >
                          <Trash2 className="w-4 h-4 pointer-events-none" />
                        </button>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Resident Edit Modal */}
      {editingResident && (
        <ResidentEditModal
          resident={editingResident}
          isOpen={Boolean(editingResident)}
          onClose={() => setEditingResident(null)}
          onSave={handleSaveEditResident}
        />
      )}

      {/* Tag Edit Modal for Resident */}
      {tagEditingResident && (
        <TagEditModal
          isOpen={Boolean(tagEditingResident)}
          onClose={() => setTagEditingResident(null)}
          targetName={`[${tagEditingResident.room}-${tagEditingResident.bed}] ${tagEditingResident.name}`}
          currentTag={tagEditingResident.tag}
          targetType="resident"
          onSaveTag={(newTag) => {
            const updated: Resident = {
              ...tagEditingResident,
              tag: newTag,
            };
            handleSaveEditResident(updated, tagEditingResident.id);
            setTagEditingResident(null);
          }}
        />
      )}

      {/* In-App Delete Resident Confirmation Modal (Mobile-Safe Sticky Buttons) */}
      {residentToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl text-slate-200 flex flex-col max-h-[90dvh] my-auto overflow-hidden">
            <div className="shrink-0 flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">確認移除住宿生？</h3>
                <p className="text-xs text-slate-400">名冊人員移除確認</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">房號與床號：</span>
                  <span className="font-mono font-bold text-white text-sm bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {residentToDelete.id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">學生姓名：</span>
                  <span className="font-bold text-white text-sm">{residentToDelete.name}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                確定要從名單「<span className="text-purple-300 font-bold">{inspectedVersion.name}</span>」中移除住宿生「<span className="text-white font-bold">{residentToDelete.name}</span>」({residentToDelete.id}) 嗎？
              </p>

              <p className="text-[11px] text-amber-400/90 bg-amber-950/30 p-2 rounded-xl border border-amber-900/40">
                💡 移除後若需加回，可隨時使用上方「新增單筆人員」功能重新鍵入。
              </p>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2 pt-3 border-t border-slate-800 mt-3">
              <button
                type="button"
                onClick={() => {
                  setResidentToDelete(null);
                  setQuickConfirmResidentId(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeleteResident}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
              >
                <Trash2 className="w-4 h-4 pointer-events-none" />
                <span>確定移除</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Version Confirmation Modal (Mobile-Safe Sticky Buttons) */}
      {versionToDelete && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl text-slate-200 flex flex-col max-h-[90dvh] my-auto overflow-hidden">
            <div className="shrink-0 flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">確認刪除名冊版本？</h3>
                <p className="text-xs text-slate-400">歷史名冊刪除確認</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                確定要刪除歷史名冊版本「<span className="text-purple-300 font-bold">{versionToDelete.name}</span>」（共 {versionToDelete.residents.length} 位住宿生）嗎？
              </p>
              <p className="text-[11px] text-rose-300/90 bg-rose-950/30 p-2 rounded-xl border border-rose-900/40">
                ⚠️ 刪除歷史名冊版本後將無法復原，請確認此版本已不再需要。
              </p>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2 pt-3 border-t border-slate-800 mt-3">
              <button
                type="button"
                onClick={() => setVersionToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeleteVersion}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
              >
                <Trash2 className="w-4 h-4 pointer-events-none" />
                <span>確定刪除版本</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Database Confirmation Modal (In-App, Mobile & Iframe Safe) */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl text-slate-200 flex flex-col max-h-[90dvh] my-auto overflow-hidden">
            <div className="shrink-0 flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">確認重設示範資料庫？</h3>
                <p className="text-xs text-slate-400">重設為初始示範名冊</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3 text-xs text-slate-300">
              <p className="bg-slate-950 p-3 rounded-2xl border border-slate-800 leading-relaxed">
                確定要將資料庫重設回初始示範狀態嗎？現有自訂名單將被 115 最新示範名單 (包含 416-2 樓長黃柏翰等 180 位住宿生) 覆蓋。
              </p>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2 pt-3 border-t border-slate-800 mt-3">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetDatabase();
                  setShowResetConfirmModal(false);
                  showToast('已重設為示範資料庫 (416-2 黃柏翰等 180 人)');
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
              >
                <RefreshCw className="w-4 h-4 pointer-events-none" />
                <span>確定重設</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
