import React, { useState, useEffect, useMemo } from 'react';
import {
  Resident,
  DailySession,
  AttendanceStatus,
  AttendanceRecord
} from '../types/dorm.ts';
import {
  createAllAbsentRecordsForRoom,
  createAllPresentRecordsForRoom
} from '../utils/rollcallLogic.ts';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ChevronLeft,
  ChevronRight,
  Zap,
  DoorClosed,
  Search,
  Check,
  CheckCheck,
  Edit3,
  Star,
  Tag,
  Volume2,
  VolumeX,
  Sparkles,
  LayoutGrid,
  X
} from 'lucide-react';
import { ResidentTagBadge } from './ResidentTagBadge.tsx';
import { ResidentEditModal } from './ResidentEditModal.tsx';
import { TagEditModal } from './TagEditModal.tsx';
import { FloorPlanLayout } from './FloorPlanLayout.tsx';
import { soundEffects } from '../utils/soundEffects.ts';

interface RollCallModeProps {
  residents: Resident[];
  session: DailySession;
  onSaveRoomRecords: (room: string, records: Record<string, AttendanceRecord>, advanceToNext: boolean) => void;
  selectedFloor: string;
  onSelectFloor: (floor: string) => void;
  currentRoom?: string;
  onSelectRoom?: (room: string) => void;
  onUpdateResident?: (updatedResident: Resident, originalResidentId: string) => void;
}

const QUICK_NOTES = ['圖書館自習', '打工晚歸', '家因返鄉', '系隊練球', '生病就醫', '敲門未應'];

export const RollCallMode: React.FC<RollCallModeProps> = ({
  residents,
  session,
  onSaveRoomRecords,
  selectedFloor,
  onSelectFloor,
  currentRoom: propCurrentRoom,
  onSelectRoom,
  onUpdateResident,
}) => {
  // Get all unique floors and rooms
  const floors = useMemo(() => {
    const set = new Set<string>();
    residents.forEach(r => set.add(r.floor));
    return Array.from(set).sort();
  }, [residents]);

  const floorResidents = useMemo(() => {
    if (selectedFloor === 'all') return residents;
    return residents.filter(r => r.floor === selectedFloor);
  }, [residents, selectedFloor]);

  const roomsInFloor = useMemo(() => {
    const set = new Set<string>();
    floorResidents.forEach(r => set.add(r.room));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [floorResidents]);

  // Current selected room state: prioritized from prop to preserve when returning
  const [internalRoom, setInternalRoom] = useState<string>(() => {
    if (propCurrentRoom && roomsInFloor.includes(propCurrentRoom)) return propCurrentRoom;
    const has416 = roomsInFloor.includes('416');
    if (has416) return '416';
    return roomsInFloor[0] || '401';
  });

  const currentRoom = (propCurrentRoom && roomsInFloor.includes(propCurrentRoom)) ? propCurrentRoom : internalRoom;

  useEffect(() => {
    if (propCurrentRoom && propCurrentRoom !== internalRoom && roomsInFloor.includes(propCurrentRoom)) {
      setInternalRoom(propCurrentRoom);
    }
  }, [propCurrentRoom, roomsInFloor, internalRoom]);

  const [roomSearchInput, setRoomSearchInput] = useState<string>('');
  const [showRoomDrawer, setShowRoomDrawer] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [tagEditingResident, setTagEditingResident] = useState<Resident | null>(null);

  // Interactive Room Switch visual & audio effects state
  const [navDirection, setNavDirection] = useState<'next' | 'prev' | 'jump'>('next');
  const [roomSwitchCounter, setRoomSwitchCounter] = useState<number>(0);
  const [activeSwitchBanner, setActiveSwitchBanner] = useState<{
    room: string;
    direction: 'next' | 'prev' | 'jump';
    count: number;
  } | null>(null);
  const [soundFxEnabled, setSoundFxEnabled] = useState<boolean>(() => soundEffects.isEnabled());

  // Residents in currently selected room
  const currentRoomResidents = useMemo(() => {
    return residents
      .filter(r => r.room === currentRoom)
      .sort((a, b) => a.bed.localeCompare(b.bed, undefined, { numeric: true }));
  }, [residents, currentRoom]);

  // Draft records
  const [draftRecords, setDraftRecords] = useState<Record<string, { status: AttendanceStatus; note: string }>>({});

  // Sync draft whenever room or session changes
  useEffect(() => {
    const nextDraft: Record<string, { status: AttendanceStatus; note: string }> = {};
    for (const res of currentRoomResidents) {
      const existing = session.records[res.id];
      if (existing) {
        nextDraft[res.id] = {
          status: existing.status,
          note: existing.note || '',
        };
      } else {
        // KEEP AS UNMARKED! Do NOT default to present!
        nextDraft[res.id] = {
          status: 'unmarked',
          note: '',
        };
      }
    }
    setDraftRecords(nextDraft);
  }, [currentRoom, session, currentRoomResidents]);

  // Update room when floor changes if current room is not in new floor
  useEffect(() => {
    if (roomsInFloor.length > 0 && !roomsInFloor.includes(currentRoom)) {
      setInternalRoom(roomsInFloor[0]);
      if (onSelectRoom) {
        onSelectRoom(roomsInFloor[0]);
      }
    }
  }, [roomsInFloor, currentRoom, onSelectRoom]);

  // Navigation indices
  const currentIndex = roomsInFloor.indexOf(currentRoom);
  const prevRoom = currentIndex > 0 ? roomsInFloor[currentIndex - 1] : null;
  const nextRoom = currentIndex < roomsInFloor.length - 1 ? roomsInFloor[currentIndex + 1] : null;

  // AUTO-SAVE HELPER: Preserves exact status without coercing 'unmarked' into 'present'!
  const autoSaveDraftState = (newDraft: Record<string, { status: AttendanceStatus; note: string }>) => {
    const now = Date.now();
    const recordsToSave: Record<string, AttendanceRecord> = {};

    for (const res of currentRoomResidents) {
      const draft = newDraft[res.id];
      const finalStatus: AttendanceStatus = draft?.status || 'unmarked';

      recordsToSave[res.id] = {
        residentId: res.id,
        status: finalStatus,
        note: draft?.note?.trim() || undefined,
        updatedAt: now,
      };
    }

    onSaveRoomRecords(currentRoom, recordsToSave, false);
  };

  // 1. One-Tap ALL PRESENT: Explicitly sets everyone in room to 'present'
  const handleMarkAllPresent = () => {
    const updated: Record<string, { status: AttendanceStatus; note: string }> = {};
    for (const res of currentRoomResidents) {
      updated[res.id] = {
        status: 'present',
        note: draftRecords[res.id]?.note || '',
      };
    }
    setDraftRecords(updated);
    autoSaveDraftState(updated);

    setSaveToast(`房號 ${currentRoom} 全員到齊！已即時存檔`);
    setTimeout(() => setSaveToast(null), 1800);
  };

  // 2. One-Tap ALL ABSENT (DOOR UNOPENED / NO ANSWER): Explicitly sets everyone in room to 'absent'
  const handleMarkAllAbsentUnopened = () => {
    const updated: Record<string, { status: AttendanceStatus; note: string }> = {};
    for (const res of currentRoomResidents) {
      updated[res.id] = {
        status: 'absent',
        note: '房門未開/敲門未應 (一鍵全員未到)',
      };
    }
    setDraftRecords(updated);
    autoSaveDraftState(updated);

    setSaveToast(`房號 ${currentRoom} 全未到 (門未開)！已即時存檔`);
    setTimeout(() => setSaveToast(null), 1800);
  };

  // Individual toggle status with INSTANT AUTO-SAVE
  const handleSetStatus = (residentId: string, status: AttendanceStatus) => {
    // If clicking same status, toggle back to unmarked
    const currentStatus = draftRecords[residentId]?.status;
    const nextStatus = currentStatus === status ? 'unmarked' : status;

    const updated = {
      ...draftRecords,
      [residentId]: {
        ...(draftRecords[residentId] || { note: '' }),
        status: nextStatus,
      },
    };
    setDraftRecords(updated);
    autoSaveDraftState(updated);
  };

  // Individual set note with INSTANT AUTO-SAVE
  const handleSetNote = (residentId: string, note: string) => {
    const updated = {
      ...draftRecords,
      [residentId]: {
        ...(draftRecords[residentId] || { status: 'unmarked' }),
        note,
      },
    };
    setDraftRecords(updated);
    autoSaveDraftState(updated);
  };

  // Navigate room with rich visual direction, sound effects, and feedback banner
  const handleNavigateRoom = (targetRoom: string, dir: 'next' | 'prev' | 'jump' = 'jump') => {
    if (targetRoom === currentRoom) return;
    autoSaveDraftState(draftRecords);

    // 1. Direction & animation counter
    setNavDirection(dir);
    setRoomSwitchCounter(prev => prev + 1);

    // 2. Synthesized audio chime & mobile haptic vibration
    soundEffects.playRoomSwitch(dir);

    // 3. Transient visual confirmation banner
    const bedsCount = residents.filter(r => r.room === targetRoom).length;
    setActiveSwitchBanner({
      room: targetRoom,
      direction: dir,
      count: bedsCount,
    });

    setInternalRoom(targetRoom);
    if (onSelectRoom) {
      onSelectRoom(targetRoom);
    }
    setShowRoomDrawer(false);
  };

  // Auto-dismiss room transition banner
  useEffect(() => {
    if (activeSwitchBanner) {
      const timer = setTimeout(() => {
        setActiveSwitchBanner(null);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [activeSwitchBanner]);

  const handlePrevRoom = () => {
    if (prevRoom) handleNavigateRoom(prevRoom, 'prev');
  };

  const handleNextRoom = () => {
    if (nextRoom) handleNavigateRoom(nextRoom, 'next');
  };

  // Advance button: Keeps unmarked students as unmarked!
  const handleSaveAndAdvance = () => {
    autoSaveDraftState(draftRecords);
    if (nextRoom) {
      handleNavigateRoom(nextRoom, 'next');
    }
  };

  // Search room submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = roomSearchInput.trim();
    if (!query) return;

    const matchingResident = residents.find(r => r.room === query || r.room.includes(query));
    if (matchingResident) {
      if (selectedFloor !== 'all' && matchingResident.floor !== selectedFloor) {
        onSelectFloor(matchingResident.floor);
      }
      handleNavigateRoom(matchingResident.room, 'jump');
      setRoomSearchInput('');
    } else {
      setSaveToast(`⚠️ 找不到房號「${query}」，請確認後重試`);
      setTimeout(() => setSaveToast(null), 2500);
    }
  };

  // Check if room is fully marked (no unmarked beds)
  const isRoomFullyMarked = useMemo(() => {
    if (currentRoomResidents.length === 0) return false;
    return currentRoomResidents.every(res => {
      const rec = session.records[res.id] || draftRecords[res.id];
      return rec && rec.status !== 'unmarked';
    });
  }, [currentRoomResidents, session.records, draftRecords]);

  // Progress stats
  const completedCount = roomsInFloor.filter(rm => session.completedRooms.includes(rm)).length;
  const totalCount = roomsInFloor.length;

  return (
    <div className="w-full max-w-md mx-auto pb-36 sm:pb-32 px-3 pt-2">
      {/* Save Toast notification */}
      {saveToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <CheckCheck className="w-4 h-4" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Floor Selector & Room Drawer Bar */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5">
        {/* Floor switcher */}
        <div className="flex items-center gap-1 overflow-x-auto py-1 no-scrollbar min-w-0 flex-1">
          <button
            onClick={() => onSelectFloor('all')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium whitespace-nowrap transition-colors shrink-0 ${
              selectedFloor === 'all'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            全部
          </button>
          {floors.map(floor => (
            <button
              key={floor}
              onClick={() => onSelectFloor(floor)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium whitespace-nowrap transition-colors shrink-0 ${
                selectedFloor === floor
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {floor} 樓
            </button>
          ))}
        </div>

        {/* Room Drawer / Blueprint Overview Toggle */}
        <button
          onClick={() => setShowRoomDrawer(true)}
          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-1.5 font-bold whitespace-nowrap shrink-0 transition-colors shadow-sm cursor-pointer"
          title="開啟樓層平面格局圖 (按建築佈局一覽)"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-emerald-400" />
          <span>房間一覽</span>
          <span className="text-[10px] px-1 bg-slate-900 rounded font-mono text-emerald-400 font-bold">
            {completedCount}/{totalCount}
          </span>
        </button>
      </div>

      {/* Quick Search & Switcher Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 mb-3 shadow-sm relative overflow-hidden">
        {/* Dynamic Room Switch Confirmation Banner */}
        {activeSwitchBanner && (
          <div className="mb-2 py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600/30 via-teal-600/30 to-blue-600/30 border border-emerald-400/50 flex items-center justify-between text-xs text-emerald-200 animate-room-banner shadow-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="font-bold text-white text-sm">
                🚪 已切換至 {activeSwitchBanner.room} 房
              </span>
              <span className="text-[11px] text-emerald-300 font-medium">
                ({activeSwitchBanner.direction === 'next' ? '下一間 →' : activeSwitchBanner.direction === 'prev' ? '← 前一間' : '快速跳轉'})
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-300 font-bold bg-slate-950/80 px-2 py-0.5 rounded-lg border border-emerald-500/30">
              共 {activeSwitchBanner.count} 床
            </span>
          </div>
        )}

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 mb-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
            <input
              type="text"
              inputMode="numeric"
              placeholder="輸入房號快速跳轉 (例: 416)"
              value={roomSearchInput}
              onChange={e => setRoomSearchInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 shrink-0 cursor-pointer"
          >
            跳轉
          </button>
          {/* Sound FX Toggle Button */}
          <button
            type="button"
            onClick={() => setSoundFxEnabled(soundEffects.toggle())}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
              soundFxEnabled
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title={soundFxEnabled ? '切換房間音效已開啟 (點擊關閉)' : '切換房間音效已關閉 (點擊開啟)'}
          >
            {soundFxEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </form>

        {/* Room Navigation Header */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={handlePrevRoom}
            disabled={!prevRoom}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border shrink-0 transition-all ${
              prevRoom
                ? 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700 active:scale-95 cursor-pointer'
                : 'opacity-40 text-slate-500 border-transparent cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="truncate max-w-[65px]">{prevRoom ? `${prevRoom}房` : '無前間'}</span>
          </button>

          {/* Current Room Indicator with Pop & Glow Animation */}
          <div className="text-center min-w-0 px-1">
            <div
              key={`room-indicator-${currentRoom}-${roomSwitchCounter}`}
              className={`flex items-center justify-center gap-1.5 py-0.5 px-3 rounded-2xl transition-all duration-300 ${
                activeSwitchBanner
                  ? 'animate-room-pop animate-room-glow bg-emerald-500/15 ring-2 ring-emerald-400/50'
                  : ''
              }`}
            >
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {currentRoom}
              </span>
              <span className="text-xs font-bold text-slate-400">房</span>
              {isRoomFullyMarked ? (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                  <Check className="w-3 h-3" />
                  已點齊
                </span>
              ) : (
                <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                  待點名
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleNextRoom}
            disabled={!nextRoom}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border shrink-0 transition-all ${
              nextRoom
                ? 'bg-slate-800/80 text-slate-200 border-slate-700 hover:bg-slate-700 active:scale-95 cursor-pointer'
                : 'opacity-40 text-slate-500 border-transparent cursor-not-allowed'
            }`}
          >
            <span className="truncate max-w-[65px]">{nextRoom ? `${nextRoom}房` : '已到底'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* Room Overview Architectural Blueprint Modal */}
      {showRoomDrawer && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-3 overflow-y-auto">
          <div className="w-full max-w-3xl sm:max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="font-black text-xs sm:text-sm text-white tracking-wide flex items-center gap-2">
                  <span>樓層房間格局一覽 (01~32 號房)</span>
                </h2>
                <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">
                  · 已完成 {completedCount}/{totalCount} 間
                </span>
              </div>
              <button
                onClick={() => setShowRoomDrawer(false)}
                className="px-2.5 py-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer border border-slate-800 hover:border-slate-700"
              >
                <span>關閉</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Modal Body with FloorPlanLayout */}
            <div className="p-2 sm:p-3 flex-1 overflow-y-auto">
              <FloorPlanLayout
                residents={residents}
                records={session.records}
                completedRooms={session.completedRooms}
                selectedFloor={selectedFloor}
                onSelectFloor={onSelectFloor}
                currentRoom={currentRoom}
                onSelectRoom={(targetRoom) => {
                  handleNavigateRoom(targetRoom, 'jump');
                  setShowRoomDrawer(false);
                }}
                availableFloors={floors}
              />
            </div>
          </div>
        </div>
      )}

      {/* DUAL SPEED SHORTCUT ACTIONS - Compact responsive layout without awkward wrapping */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* 1. All Present */}
        <button
          onClick={handleMarkAllPresent}
          className="py-2.5 px-2 bg-emerald-600/95 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl font-bold text-[11px] sm:text-xs shadow-md flex items-center justify-center gap-1 border border-emerald-400/40 cursor-pointer whitespace-nowrap min-w-0"
        >
          <Zap className="w-3.5 h-3.5 fill-current text-amber-300 shrink-0" />
          <span className="truncate">一鍵全員到齊</span>
        </button>

        {/* 2. All Absent (Door unopened / No response) */}
        <button
          onClick={handleMarkAllAbsentUnopened}
          className="py-2.5 px-2 bg-rose-950/85 hover:bg-rose-900/90 active:scale-[0.98] text-rose-200 rounded-xl font-bold text-[11px] sm:text-xs shadow-md flex items-center justify-center gap-1 border border-rose-700/60 cursor-pointer whitespace-nowrap min-w-0"
        >
          <DoorClosed className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="truncate">一鍵全未到 (未開門)</span>
        </button>
      </div>

      {/* Resident Beds List for Current Room with Directional Slide & Stagger Animation */}
      <div
        key={`room-list-${currentRoom}-${roomSwitchCounter}`}
        className={`space-y-2.5 ${
          navDirection === 'next'
            ? 'animate-slide-right'
            : navDirection === 'prev'
            ? 'animate-slide-left'
            : 'animate-room-pop'
        }`}
      >
        {currentRoomResidents.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 text-sm">
            此房間尚無安排學生名單
          </div>
        ) : (
          currentRoomResidents.map((resident, idx) => {
            const draft = draftRecords[resident.id] || { status: 'unmarked', note: '' };
            const status = draft.status;
            const staggerClass = `animate-card-stagger-${Math.min((idx % 4) + 1, 4)}`;

            return (
              <div
                key={resident.id}
                className={`p-3 rounded-2xl border transition-all ${staggerClass} ${
                  status === 'present'
                    ? 'bg-emerald-950/20 border-emerald-800/60'
                    : status === 'absent'
                    ? 'bg-rose-950/30 border-rose-800/80 shadow-rose-950/30 shadow-md'
                    : status === 'leave'
                    ? 'bg-amber-950/25 border-amber-800/60'
                    : status === 'late'
                    ? 'bg-sky-950/25 border-sky-800/60'
                    : 'bg-slate-900/90 border-slate-800'
                }`}
              >
                {/* Resident Header info */}
                <div className="flex items-center justify-between mb-2 gap-1.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-100 font-black text-sm flex items-center justify-center border border-slate-700 shrink-0">
                      {resident.bed}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-base text-white tracking-wide truncate">
                          {resident.name}
                        </span>
                        {/* TAG BADGE */}
                        {resident.tag && (
                          <ResidentTagBadge
                            tag={resident.tag}
                            size="xs"
                            onClick={() => onUpdateResident && setTagEditingResident(resident)}
                            className="cursor-pointer hover:ring-1 hover:ring-purple-400"
                          />
                        )}
                        {resident.defaultNote && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium shrink-0">
                            {resident.defaultNote}
                          </span>
                        )}
                        {/* QUICK TAG EDIT BUTTON */}
                        {onUpdateResident && (
                          <button
                            type="button"
                            onClick={() => setTagEditingResident(resident)}
                            className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                              resident.tag
                                ? 'bg-purple-950/70 hover:bg-purple-900/80 text-purple-200 border-purple-700/80 shadow-sm'
                                : 'bg-slate-800/80 hover:bg-purple-950/50 text-slate-400 hover:text-purple-300 border-slate-700 hover:border-purple-800/60'
                            }`}
                            title="修改身分職銜標籤 (舍長/樓長/副樓長/室長/自訂)"
                          >
                            <Tag className="w-3 h-3 text-purple-400 shrink-0" />
                            <span>{resident.tag ? '修改標籤' : '設標籤'}</span>
                          </button>
                        )}
                        {/* EDIT BUTTON */}
                        {onUpdateResident && (
                          <button
                            type="button"
                            onClick={() => setEditingResident(resident)}
                            className="p-1 text-slate-500 hover:text-purple-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title="編輯完整資料 (房號/姓名/學號/電話)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono truncate">
                        <span>學號:</span>
                        <span className="text-slate-300">{resident.studentId}</span>
                        {resident.phone && (
                          <span className="ml-1 text-slate-400">· {resident.phone}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {status === 'unmarked' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap">
                        待點名
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 font-mono border border-slate-700 whitespace-nowrap">
                      {resident.id}
                    </span>
                  </div>
                </div>

                {/* Status Toggle Buttons - Tight padding to fit 360px screen */}
                <div className="grid grid-cols-4 gap-1 sm:gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSetStatus(resident.id, 'present')}
                    className={`py-2 px-0.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all active:scale-95 cursor-pointer ${
                      status === 'present'
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-slate-800/70 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                    }`}
                  >
                    <CheckCircle className={`w-4 h-4 ${status === 'present' ? 'text-white' : 'text-emerald-400'}`} />
                    <span>已到</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetStatus(resident.id, 'absent')}
                    className={`py-2 px-0.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all active:scale-95 cursor-pointer ${
                      status === 'absent'
                        ? 'bg-rose-600 text-white border-rose-400 shadow-sm ring-2 ring-rose-500/20'
                        : 'bg-slate-800/70 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                    }`}
                  >
                    <XCircle className={`w-4 h-4 ${status === 'absent' ? 'text-white' : 'text-rose-400'}`} />
                    <span>未到</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetStatus(resident.id, 'leave')}
                    className={`py-2 px-0.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all active:scale-95 cursor-pointer ${
                      status === 'leave'
                        ? 'bg-amber-600 text-white border-amber-400 shadow-sm ring-2 ring-amber-500/20'
                        : 'bg-slate-800/70 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                    }`}
                  >
                    <FileText className={`w-4 h-4 ${status === 'leave' ? 'text-white' : 'text-amber-400'}`} />
                    <span>請假</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetStatus(resident.id, 'late')}
                    className={`py-2 px-0.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all active:scale-95 cursor-pointer ${
                      status === 'late'
                        ? 'bg-sky-600 text-white border-sky-400 shadow-sm ring-2 ring-sky-500/20'
                        : 'bg-slate-800/70 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                    }`}
                  >
                    <Clock className={`w-4 h-4 ${status === 'late' ? 'text-white' : 'text-sky-400'}`} />
                    <span>晚歸</span>
                  </button>
                </div>

                {/* Optional Note / Remarks */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">備註快捷:</span>
                    {QUICK_NOTES.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSetNote(resident.id, preset)}
                        className={`text-[10px] px-2 py-0.5 rounded-md border whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                          draft.note === preset
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="輸入自訂備註說明 (如: 外宿假單、體育館練球)..."
                    value={draft.note}
                    onChange={e => handleSetNote(resident.id, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* STICKY BOTTOM ACTION BAR - Clean, robust, single prominent button without redundant tags */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSaveAndAdvance}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white rounded-xl font-black text-sm shadow-lg flex items-center justify-center gap-2 border border-emerald-400/40 cursor-pointer transition-all touch-manipulation min-h-[48px]"
          >
            <ChevronRight className="w-4 h-4" />
            <span>下一間房 {nextRoom ? `(${nextRoom}房 →)` : '✓ 已到底'}</span>
          </button>
        </div>
      </div>

      {/* Resident Edit Modal */}
      {editingResident && onUpdateResident && (
        <ResidentEditModal
          resident={editingResident}
          isOpen={Boolean(editingResident)}
          onClose={() => setEditingResident(null)}
          onSave={(updated, origId) => {
            onUpdateResident(updated, origId);
            setEditingResident(null);
            setSaveToast(`已成功更新 [${updated.room}-${updated.bed}] ${updated.name} 的資料與身分標籤！`);
            setTimeout(() => setSaveToast(null), 2200);
          }}
        />
      )}

      {/* Quick Tag Edit Modal for Resident */}
      {tagEditingResident && onUpdateResident && (
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
            onUpdateResident(updated, tagEditingResident.id);
            setTagEditingResident(null);
            setSaveToast(`已將 [${tagEditingResident.room}-${tagEditingResident.bed} ${tagEditingResident.name}] 標籤更新為 ${newTag ? `「${newTag}」` : '一般生 (無標籤)'}`);
            setTimeout(() => setSaveToast(null), 2200);
          }}
        />
      )}
    </div>
  );
};
