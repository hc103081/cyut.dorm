import React, { useState, useMemo } from 'react';
import {
  Resident,
  DailySession,
  AttendanceStatus,
  RosterVersion
} from '../types/dorm.ts';
import {
  calculateSummary,
  generateLineReportText,
  exportToCSV
} from '../utils/rollcallLogic.ts';
import {
  Search,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  Clock,
  Copy,
  Download,
  Share2,
  Check,
  X,
  UserX,
  Edit2,
  Printer,
  LayoutGrid,
  Table as TableIcon,
  Layers,
  ChevronDown,
  Building,
  RotateCcw,
  DoorOpen
} from 'lucide-react';
import { ResidentTagBadge } from './ResidentTagBadge.tsx';
import { FloorPlanLayout } from './FloorPlanLayout.tsx';

interface QueryModeProps {
  residents: Resident[];
  session: DailySession;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  allSessionDates: string[];
  onUpdateRecord: (residentId: string, status: AttendanceStatus, note?: string) => void;
  rosterVersions: RosterVersion[];
  currentRosterVersion: RosterVersion;
  onSelectRosterVersion?: (versionId: string) => void;
  onGoToRollCallRoom?: (room: string) => void;
}

type FilterTab = 'all' | 'absent' | 'leave' | 'late' | 'present' | 'unmarked';
type DesktopViewType = 'table' | 'matrix';

export const QueryMode: React.FC<QueryModeProps> = ({
  residents,
  session,
  selectedDate,
  onSelectDate,
  allSessionDates,
  onUpdateRecord,
  rosterVersions,
  currentRosterVersion,
  onSelectRosterVersion,
  onGoToRollCallRoom,
}) => {
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [currentTab, setCurrentTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [desktopView, setDesktopView] = useState<DesktopViewType>('table');
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [copyToast, setCopyToast] = useState<boolean>(false);
  const [editingResidentId, setEditingResidentId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('present');
  const [editNote, setEditNote] = useState<string>('');
  const [selectedMatrixRoom, setSelectedMatrixRoom] = useState<string | null>(null);

  // Extract unique floors
  const floors = useMemo(() => {
    const set = new Set<string>();
    residents.forEach(r => set.add(r.floor));
    return Array.from(set).sort();
  }, [residents]);

  // Extract unique rooms for current floor
  const roomsInFloor = useMemo(() => {
    const target = selectedFloor === 'all' ? residents : residents.filter(r => r.floor === selectedFloor);
    const set = new Set<string>();
    target.forEach(r => set.add(r.room));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [residents, selectedFloor]);

  // Calculate summary based on current floor selection
  const summary = useMemo(() => {
    return calculateSummary(residents, session, selectedFloor);
  }, [residents, session, selectedFloor]);

  // Filter residents list
  const filteredList = useMemo(() => {
    let list = residents;

    if (selectedFloor !== 'all') {
      list = list.filter(r => r.floor === selectedFloor);
    }

    if (selectedMatrixRoom) {
      list = list.filter(r => r.room === selectedMatrixRoom);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        r =>
          r.room.includes(q) ||
          r.bed.includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.studentId.includes(q) ||
          r.id.toLowerCase().includes(q) ||
          (r.tag && r.tag.toLowerCase().includes(q))
      );
    }

    // Filter by tab status
    if (currentTab !== 'all') {
      list = list.filter(r => {
        const rec = session.records[r.id];
        const status = rec?.status || 'unmarked';
        return status === currentTab;
      });
    }

    // Sort by room then bed
    return list.sort((a, b) => {
      const roomDiff = a.room.localeCompare(b.room, undefined, { numeric: true });
      if (roomDiff !== 0) return roomDiff;
      return a.bed.localeCompare(b.bed, undefined, { numeric: true });
    });
  }, [residents, session, selectedFloor, selectedMatrixRoom, searchQuery, currentTab]);

  // Generate LINE text
  const lineReportText = useMemo(() => {
    const floorLabel = selectedFloor === 'all' ? '全棟' : `${selectedFloor} 樓`;
    return generateLineReportText(selectedDate, floorLabel, summary);
  }, [selectedDate, selectedFloor, summary]);

  // Handle Copy Report
  const handleCopyReport = () => {
    navigator.clipboard.writeText(lineReportText).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    }).catch(() => {
      // Fallback
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  };

  // Handle Export CSV
  const handleDownloadCSV = () => {
    const csvData = exportToCSV(
      selectedFloor === 'all' ? residents : residents.filter(r => r.floor === selectedFloor),
      session,
      selectedDate
    );
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `宿舍點名紀錄_${selectedDate}_${selectedFloor === 'all' ? '全棟' : selectedFloor + 'F'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Quick edit modal handler
  const handleStartEdit = (resident: Resident) => {
    setEditingResidentId(resident.id);
    const rec = session.records[resident.id];
    setEditStatus(rec?.status || 'present');
    setEditNote(rec?.note || '');
  };

  const handleSaveEdit = () => {
    if (editingResidentId) {
      onUpdateRecord(editingResidentId, editStatus, editNote);
      setEditingResidentId(null);
    }
  };

  return (
    <div className="w-full pb-24 px-3 pt-3 md:px-6 md:pt-6">
      {/* Toast */}
      {copyToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" />
          回報文字已複製到剪貼簿！
        </div>
      )}

      {/* TOP CONTROLS & DESKTOP HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Date Picker & Jumpers */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <Calendar className="w-5 h-5 text-blue-400" />
              <span>查詢點名日期</span>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={selectedDate}
                onChange={e => e.target.value && onSelectDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sm text-slate-100 font-medium focus:outline-none focus:border-blue-500"
              />

              <button
                onClick={() => {
                  const now = new Date();
                  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                  onSelectDate(today);
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-medium"
              >
                今日
              </button>
              <button
                onClick={() => {
                  const yesterday = new Date(Date.now() - 86400000);
                  const yDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                  onSelectDate(yDate);
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-medium"
              >
                昨日
              </button>
            </div>

            {/* Roster Version Indicator on Desktop */}
            {rosterVersions.length > 0 && onSelectRosterVersion && (
              <div className="hidden lg:flex items-center gap-1.5 ml-3 pl-3 border-l border-slate-800 text-xs text-slate-400">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>名單版本:</span>
                <select
                  value={currentRosterVersion.id}
                  onChange={e => onSelectRosterVersion(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-purple-300 font-medium focus:outline-none"
                >
                  {rosterVersions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.residents.length}人){v.isCurrent ? ' [最新預設]' : ' [歷史存檔]'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReportModal(true)}
              className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm border border-blue-400/40 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>生成 LINE 回報</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>匯出 Excel/CSV</span>
            </button>

            {/* View Switcher (Mobile & Desktop) */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800">
              <button
                onClick={() => setDesktopView('table')}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  desktopView === 'table' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="清單列表模式"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">清單表格</span>
                <span className="sm:hidden">清單</span>
              </button>
              <button
                onClick={() => setDesktopView('matrix')}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  desktopView === 'matrix' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="樓層格局平面圖總覽"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">房間平面格局</span>
                <span className="sm:hidden">格局圖</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Roster Version Tag */}
        <div className="lg:hidden mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            名單: {currentRosterVersion.name}
          </span>
          <span className="text-slate-500 font-mono">({residents.length} 人)</span>
        </div>
      </div>

      {/* KPI METRIC CARDS - WIDE RESPONSIVE LAYOUT */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-4">
        {/* Total */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>應到住宿生</span>
            <Building className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">{summary.totalResidents}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-500 mt-1 truncate">
            共 {summary.totalRooms} 間房 ({summary.completedRoomsCount} 完成)
          </div>
        </div>

        {/* Present */}
        <div
          onClick={() => setCurrentTab('present')}
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
            currentTab === 'present'
              ? 'bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-1">
            <span>實到在宿</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">{summary.presentCount}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">
            到齊率: {summary.totalResidents > 0 ? Math.round((summary.presentCount / summary.totalResidents) * 100) : 0}%
          </div>
        </div>

        {/* Absent - HIGHLIGHTED RED ALERT */}
        <div
          onClick={() => setCurrentTab('absent')}
          className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
            summary.absentCount > 0 ? 'bg-rose-950/50 border-rose-800/80 shadow-rose-950/40 shadow-md' : 'bg-slate-900 border-slate-800'
          } ${currentTab === 'absent' ? 'ring-2 ring-rose-500 border-rose-500' : ''}`}
        >
          <div className="flex items-center justify-between text-xs text-rose-400 font-bold mb-1">
            <span className="flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              未到需追查
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">緊急</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-200">{summary.absentCount}</div>
          <div className="text-[10px] sm:text-[11px] text-rose-400/90 font-medium mt-1 truncate">
            點選篩選未到名單
          </div>
        </div>

        {/* Leave */}
        <div
          onClick={() => setCurrentTab('leave')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
            currentTab === 'leave'
              ? 'bg-amber-950/70 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-400 font-semibold mb-1">
            <span>請假公假</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{summary.leaveCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            返鄉 / 系隊 / 事假
          </div>
        </div>

        {/* Late */}
        <div
          onClick={() => setCurrentTab('late')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
            currentTab === 'late'
              ? 'bg-sky-950/70 border-sky-500 ring-2 ring-sky-500/20'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-sky-400 font-semibold mb-1">
            <span>晚歸補點</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">{summary.lateCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            自習 / 打工晚歸報備
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS: Floor Chips, Status Tabs & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 mb-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Floor & Status Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Floor chips */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 mr-2">
              <button
                onClick={() => {
                  setSelectedFloor('all');
                  setSelectedMatrixRoom(null);
                }}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                  selectedFloor === 'all'
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                全棟樓層
              </button>
              {floors.map(floor => (
                <button
                  key={floor}
                  onClick={() => {
                    setSelectedFloor(floor);
                    setSelectedMatrixRoom(null);
                  }}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                    selectedFloor === floor
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {floor} 樓
                </button>
              ))}
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar text-xs">
              <button
                onClick={() => setCurrentTab('all')}
                className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  currentTab === 'all'
                    ? 'bg-slate-700 text-white font-semibold'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                全部名單 ({residents.length})
              </button>

              <button
                onClick={() => setCurrentTab('absent')}
                className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                  currentTab === 'absent'
                    ? 'bg-rose-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-800/80 text-rose-400 hover:text-rose-300'
                }`}
              >
                <UserX className="w-3.5 h-3.5" />
                <span>僅看未到 ({summary.absentCount})</span>
              </button>

              <button
                onClick={() => setCurrentTab('leave')}
                className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  currentTab === 'leave'
                    ? 'bg-amber-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-800/80 text-amber-400 hover:text-amber-300'
                }`}
              >
                請假 ({summary.leaveCount})
              </button>

              <button
                onClick={() => setCurrentTab('late')}
                className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  currentTab === 'late'
                    ? 'bg-sky-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-800/80 text-sky-400 hover:text-sky-300'
                }`}
              >
                晚歸 ({summary.lateCount})
              </button>

              <button
                onClick={() => setCurrentTab('present')}
                className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  currentTab === 'present'
                    ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                    : 'bg-slate-800/80 text-emerald-400 hover:text-emerald-300'
                }`}
              >
                實到 ({summary.presentCount})
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋房號、床號、姓名或學號..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Active room filter badge */}
        {selectedMatrixRoom && (
          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-blue-300">
            <span>正在篩選房間：<strong>{selectedMatrixRoom} 號房</strong></span>
            <button
              onClick={() => setSelectedMatrixRoom(null)}
              className="text-slate-400 hover:text-white underline text-[11px]"
            >
              清除房間過濾 (顯示全部)
            </button>
          </div>
        )}
      </div>

      {/* ARCHITECTURAL ROOM BLUEPRINT VIEW (大螢幕/手機 樓層房間平面格局圖) */}
      {desktopView === 'matrix' && (
        <div className="mb-4">
          <FloorPlanLayout
            residents={residents}
            records={session.records}
            completedRooms={session.completedRooms}
            selectedFloor={selectedFloor}
            onSelectFloor={setSelectedFloor}
            currentRoom={selectedMatrixRoom || undefined}
            onSelectRoom={(rm) => setSelectedMatrixRoom(selectedMatrixRoom === rm ? null : rm)}
            availableFloors={floors}
          />
        </div>
      )}

      {/* DESKTOP TABLE VIEW (電腦網頁專屬表格模式 - 寬螢幕超清晰) */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm mb-6">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-100">
            住宿生點名查核清冊 (共 {filteredList.length} 筆)
          </span>
          <span className="text-xs text-slate-400">
            點選狀態標籤或編輯按鈕可直接修改人員狀態
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-3 px-4">房號-床位</th>
                <th className="py-3 px-4">姓名</th>
                <th className="py-3 px-4">學號</th>
                <th className="py-3 px-4">樓層</th>
                <th className="py-3 px-4">點名狀態</th>
                <th className="py-3 px-4">備註 / 事由</th>
                <th className="py-3 px-4">記錄時間</th>
                <th className="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    無符合條件的點名紀錄
                  </td>
                </tr>
              ) : (
                filteredList.map(resident => {
                  const rec = session.records[resident.id];
                  const status: AttendanceStatus = rec?.status || 'unmarked';
                  const note = rec?.note;
                  const timeText = rec ? new Date(rec.updatedAt).toLocaleTimeString('zh-TW', { hour12: false }) : '-';

                  return (
                    <tr
                      key={resident.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        status === 'absent' ? 'bg-rose-950/15' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-100">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {resident.room}-{resident.bed}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-sm">{resident.name}</span>
                          {resident.tag && (
                            <ResidentTagBadge tag={resident.tag} size="xs" />
                          )}
                          {resident.defaultNote && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-normal">
                              {resident.defaultNote}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {resident.studentId}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {resident.floor} 樓
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-bold border ${
                            status === 'present'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : status === 'absent'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-black'
                              : status === 'leave'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : status === 'late'
                              ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {status === 'present' && '已到'}
                          {status === 'absent' && '未到'}
                          {status === 'leave' && '請假'}
                          {status === 'late' && '晚歸'}
                          {status === 'unmarked' && '未點名'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-amber-300/90 font-medium">
                        {note || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {timeText}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {onGoToRollCallRoom && (
                            <button
                              onClick={() => onGoToRollCallRoom(resident.room)}
                              className="px-2.5 py-1 text-emerald-300 hover:text-white rounded-lg bg-emerald-950/60 hover:bg-emerald-800 border border-emerald-700/60 text-xs inline-flex items-center gap-1 font-medium cursor-pointer transition-colors"
                              title="前往點名此房間"
                            >
                              <DoorOpen className="w-3 h-3 text-emerald-400" />
                              <span>點此房</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleStartEdit(resident)}
                            className="px-2.5 py-1 text-slate-300 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs inline-flex items-center gap-1 font-medium cursor-pointer transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>更動狀態</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE LIST VIEW (手機端專用卡片式清單) */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1 px-1">
          <span>共 {filteredList.length} 筆紀錄</span>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700"
          >
            <Download className="w-3 h-3" />
            <span>匯出 CSV</span>
          </button>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            無符合條件的點名紀錄
          </div>
        ) : (
          filteredList.map(resident => {
            const rec = session.records[resident.id];
            const status: AttendanceStatus = rec?.status || 'unmarked';
            const note = rec?.note;

            return (
              <div
                key={resident.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                  status === 'absent'
                    ? 'bg-rose-950/30 border-rose-800/80'
                    : status === 'leave'
                    ? 'bg-amber-950/20 border-amber-800/60'
                    : status === 'late'
                    ? 'bg-sky-950/20 border-sky-800/60'
                    : status === 'present'
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-900/60 border-slate-800/80 opacity-70'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="text-center min-w-[44px] shrink-0">
                    <div className="text-xs font-bold text-slate-200">
                      {resident.room}-{resident.bed}
                    </div>
                    <div className="text-[10px] text-slate-500">床位 {resident.bed}</div>
                  </div>

                  <div className="h-7 w-[1px] bg-slate-800 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-white truncate">{resident.name}</span>
                      {resident.tag && (
                        <ResidentTagBadge tag={resident.tag} size="xs" />
                      )}
                      {resident.defaultNote && (
                        <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 shrink-0">
                          {resident.defaultNote}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 truncate">
                      <span>學號: {resident.studentId}</span>
                      {note && <span className="text-amber-300 font-sans truncate">({note})</span>}
                    </div>
                  </div>
                </div>

                {/* Status Badge & Quick Edit Button */}
                <div className="flex items-center gap-1 shrink-0">
                  {onGoToRollCallRoom && (
                    <button
                      onClick={() => onGoToRollCallRoom(resident.room)}
                      className="p-1.5 text-emerald-400 hover:text-white rounded-lg hover:bg-emerald-950/60 border border-emerald-800/60 cursor-pointer"
                      title="前往點名此房"
                    >
                      <DoorOpen className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span
                    className={`text-xs px-2.5 py-1 rounded-lg font-bold border ${
                      status === 'present'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : status === 'absent'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        : status === 'leave'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : status === 'late'
                        ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {status === 'present' && '已到'}
                    {status === 'absent' && '未到'}
                    {status === 'leave' && '請假'}
                    {status === 'late' && '晚歸'}
                    {status === 'unmarked' && '未點名'}
                  </span>

                  <button
                    onClick={() => handleStartEdit(resident)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 cursor-pointer"
                    title="修改此生狀態"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* LINE Report Preview & Copy Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-base text-slate-100">幹部晚點名回報格式 (LINE/群組)</span>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-2">
              可直接點擊「一鍵複製」，貼上至宿舍幹部 LINE 群組或交接日誌：
            </p>

            <textarea
              readOnly
              value={lineReportText}
              className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 resize-none focus:outline-none mb-3 min-h-[260px]"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyReport}
                className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>一鍵複製回報文字</span>
              </button>

              <button
                onClick={() => setShowReportModal(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Quick Edit Status Modal */}
      {editingResidentId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <span className="font-bold text-sm text-slate-100">
                修改點名狀態 ({editingResidentId})
              </span>
              <button onClick={() => setEditingResidentId(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {(['present', 'absent', 'leave', 'late'] as AttendanceStatus[]).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setEditStatus(st)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                    editStatus === st
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {st === 'present' && '已到'}
                  {st === 'absent' && '未到'}
                  {st === 'leave' && '請假'}
                  {st === 'late' && '晚歸'}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="更新備註 (例如: 23:20 返宿銷假、補交假單)"
              value={editNote}
              onChange={e => setEditNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 mb-3 focus:outline-none focus:border-blue-500"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
              >
                儲存變更
              </button>
              <button
                onClick={() => setEditingResidentId(null)}
                className="py-2 px-3 bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
