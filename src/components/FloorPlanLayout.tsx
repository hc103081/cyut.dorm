import React, { useState, useMemo } from 'react';
import { Resident, AttendanceRecord } from '../types/dorm.ts';
import {
  FLOOR_BLUEPRINT_SLOTS,
  findMatchingRoomInFloor,
  computeRoomStatus,
  formatRoomNumber,
  RoomStatusSummary
} from '../utils/floorLayoutLogic.ts';
import {
  Star,
  Check,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Trash2,
  HelpCircle,
  Building,
  User,
  Info
} from 'lucide-react';

interface FloorPlanLayoutProps {
  residents: Resident[];
  records: Record<string, AttendanceRecord>;
  completedRooms?: string[];
  selectedFloor: string;
  onSelectFloor?: (floor: string) => void;
  currentRoom?: string;
  onSelectRoom: (room: string) => void;
  availableFloors?: string[];
  className?: string;
}

export const FloorPlanLayout: React.FC<FloorPlanLayoutProps> = ({
  residents,
  records,
  completedRooms = [],
  selectedFloor,
  onSelectFloor,
  currentRoom,
  onSelectRoom,
  availableFloors = ['4', '3', '2'],
  className = '',
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'blueprint' | 'compact'>('blueprint');

  // Extract all rooms in the selected floor
  const activeFloor = selectedFloor === 'all' ? '4' : selectedFloor;

  const floorResidents = useMemo(() => {
    return residents.filter(r => r.floor === activeFloor);
  }, [residents, activeFloor]);

  const roomsInFloor = useMemo(() => {
    const set = new Set<string>();
    floorResidents.forEach(r => set.add(r.room));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [floorResidents]);

  // Compute status map for all 32 blueprint slots
  const slotStatusMap = useMemo(() => {
    const map = new Map<string, { fullRoom: string; summary: RoomStatusSummary; beds: Resident[] }>();

    for (const slot of FLOOR_BLUEPRINT_SLOTS) {
      const fullRoom = findMatchingRoomInFloor(roomsInFloor, slot.suffix, activeFloor);
      const summary = computeRoomStatus(floorResidents, records, fullRoom);
      const beds = floorResidents.filter(r => r.room === fullRoom).sort((a, b) => a.bed.localeCompare(b.bed, undefined, { numeric: true }));

      map.set(slot.suffix, {
        fullRoom,
        summary,
        beds,
      });
    }

    return map;
  }, [roomsInFloor, floorResidents, records, activeFloor]);

  // Active hover/selected room detail
  const activeDetailRoom = hoveredRoom || currentRoom;
  const activeDetailData = useMemo(() => {
    if (!activeDetailRoom) return null;
    const beds = floorResidents.filter(r => r.room === activeDetailRoom);
    const summary = computeRoomStatus(floorResidents, records, activeDetailRoom);
    return { room: activeDetailRoom, beds, summary };
  }, [activeDetailRoom, floorResidents, records]);

  return (
    <div className={`flex flex-col bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl ${className}`}>
      {/* Top Toolbar: Floor Switcher, View Mode, Zoom */}
      <div className="px-3 py-2.5 sm:px-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-slate-200">
            <Building className="w-4 h-4 text-emerald-400" />
            <span>樓層房間格局一覽</span>
          </div>

          {/* Floor selection pills */}
          {onSelectFloor && (
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 ml-1">
              {availableFloors.map(floor => (
                <button
                  key={floor}
                  onClick={() => onSelectFloor(floor)}
                  className={`px-2 py-0.5 text-xs rounded-md font-bold transition-all cursor-pointer ${
                    activeFloor === floor
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {floor} 樓
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View Mode & Zoom Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('blueprint')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                viewMode === 'blueprint' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📐 平面圖格局
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                viewMode === 'compact' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📋 方格清單
            </button>
          </div>

          {/* Zoom controls (only in blueprint mode) */}
          {viewMode === 'blueprint' && (
            <div className="hidden sm:flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-slate-400">
              <button
                onClick={() => setZoomLevel(prev => Math.max(0.8, prev - 0.15))}
                className="p-1 hover:text-white rounded hover:bg-slate-800"
                title="縮小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] px-1 font-mono text-slate-300 font-bold">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel(prev => Math.min(1.6, prev + 0.15))}
                className="p-1 hover:text-white rounded hover:bg-slate-800"
                title="放大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1 hover:text-white rounded hover:bg-slate-800"
                title="重設大小"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Floor Plan Canvas / SVG View */}
      {viewMode === 'blueprint' ? (
        <div className="relative w-full overflow-x-auto overflow-y-hidden bg-[#0d1527] p-2 sm:p-4 select-none touch-pan-x no-scrollbar">
          {/* Architectural Drawing Watermark / Header */}
          <div className="absolute top-3 left-4 text-[10px] font-mono text-slate-500 uppercase tracking-widest pointer-events-none flex items-center gap-2">
            <span>DORMITORY {activeFloor}F FLOOR BLUEPRINT</span>
            <span>·</span>
            <span className="text-emerald-500/80 font-bold">32 ROOMS</span>
          </div>

          <div
            className="transition-transform duration-200 origin-top mx-auto"
            style={{
              maxWidth: '885px',
              width: '100%',
              transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
              transformOrigin: 'center top',
            }}
          >
            <svg
              viewBox="0 0 885 450"
              className="w-full h-auto max-w-full"
              style={{
                fontFamily: "'WenQuanYi Zen Hei', 'Noto Sans TC', system-ui, -apple-system, sans-serif",
                filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))'
              }}
            >
              {/* Grid Background Pattern */}
              <defs>
                <pattern id="archGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="0.8" />
                </pattern>
                <linearGradient id="hallwayGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#1e293b" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#1e293b" stopOpacity="0.4" />
                </linearGradient>
              </defs>

              <rect x="0" y="0" width="885" height="450" fill="url(#archGrid)" />

              {/* Architectural Main Central Corridor (走廊) */}
              {/* Horizontal hallway */}
              <path
                d="M 50 275 L 835 275 L 835 335 L 50 335 Z"
                fill="url(#hallwayGrad)"
                stroke="#334155"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              {/* Left Wing vertical hallway branch */}
              <path
                d="M 249 243 L 309 243 L 309 335 L 249 335 Z"
                fill="url(#hallwayGrad)"
                stroke="#334155"
                strokeWidth="1.2"
                strokeDasharray="3 2"
              />
              {/* Right Wing vertical hallway branch */}
              <path
                d="M 577 243 L 637 243 L 637 335 L 577 335 Z"
                fill="url(#hallwayGrad)"
                stroke="#334155"
                strokeWidth="1.2"
                strokeDasharray="3 2"
              />

              {/* Hallway Label */}
              <text x="440" y="308" fill="#64748b" fontSize="12" fontWeight="bold" textAnchor="middle" letterSpacing="6">
                走 廊 (HALLWAY)
              </text>

              {/* STAIRCASE 1: 一號樓梯 (Far Left next to Room 02) */}
              <g>
                <rect
                  x="23"
                  y="215"
                  width="36"
                  height="70"
                  rx="4"
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                {/* Stair steps lines */}
                {[0, 1, 2, 3, 4, 5].map(step => (
                  <line
                    key={`stair1-${step}`}
                    x1="23"
                    y1={222 + step * 9}
                    x2="59"
                    y2={222 + step * 9}
                    stroke="#475569"
                    strokeWidth="1.2"
                  />
                ))}
                {/* Label with pointer line */}
                <line x1="32" y1="202" x2="41" y2="215" stroke="#94a3b8" strokeWidth="1.2" />
                <text x="41" y="196" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">
                  一號樓梯
                </text>
              </g>

              {/* STAIRCASE 2: 二號樓梯 (Center-Left next to Room 06 & 12) */}
              <g>
                <rect
                  x="305"
                  y="205"
                  width="22"
                  height="42"
                  rx="3"
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="1.2"
                />
                {[0, 1, 2, 3].map(step => (
                  <line
                    key={`stair2-${step}`}
                    x1="305"
                    y1={212 + step * 8}
                    x2="327"
                    y2={212 + step * 8}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                ))}
                {/* Diagonal connection line from blueprint */}
                <line x1="300" y1="190" x2="315" y2="212" stroke="#94a3b8" strokeWidth="1.2" />
                <text x="300" y="182" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">
                  二號樓梯
                </text>
              </g>

              {/* STAIRCASE 3: 三號樓梯 (Center-Right next to Room 18 & 19) */}
              <g>
                <rect
                  x="555"
                  y="205"
                  width="22"
                  height="42"
                  rx="3"
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="1.2"
                />
                {[0, 1, 2, 3].map(step => (
                  <line
                    key={`stair3-${step}`}
                    x1="555"
                    y1={212 + step * 8}
                    x2="577"
                    y2={212 + step * 8}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                ))}
                {/* Diagonal connection line from blueprint */}
                <line x1="550" y1="190" x2="565" y2="212" stroke="#94a3b8" strokeWidth="1.2" />
                <text x="550" y="182" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">
                  三號樓梯
                </text>
              </g>

              {/* STAIRCASE 4: 四號樓梯 (Far Right next to Room 28) */}
              <g>
                <rect
                  x="825"
                  y="215"
                  width="36"
                  height="70"
                  rx="4"
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                {[0, 1, 2, 3, 4, 5].map(step => (
                  <line
                    key={`stair4-${step}`}
                    x1="825"
                    y1={222 + step * 9}
                    x2="861"
                    y2={222 + step * 9}
                    stroke="#475569"
                    strokeWidth="1.2"
                  />
                ))}
                {/* Label with pointer line */}
                <line x1="850" y1="202" x2="843" y2="215" stroke="#94a3b8" strokeWidth="1.2" />
                <text x="843" y="196" fill="#94a3b8" fontSize="11" fontWeight="bold" textAnchor="middle">
                  四號樓梯
                </text>
              </g>

              {/* PIPE SHAFTS / SERVICE SPACES (☒ Crossed squares) */}
              {/* Shaft below room 05 (Left wing bottom) */}
              <g>
                <rect x="185" y="243" width="60" height="32" fill="#0f172a" stroke="#475569" strokeWidth="1.2" />
                <line x1="185" y1="243" x2="215" y2="275" stroke="#475569" strokeWidth="1" />
                <line x1="215" y1="243" x2="185" y2="275" stroke="#475569" strokeWidth="1" />
                <line x1="215" y1="243" x2="245" y2="275" stroke="#475569" strokeWidth="1" />
                <line x1="245" y1="243" x2="215" y2="275" stroke="#475569" strokeWidth="1" />
              </g>

              {/* Shaft between room 20 and room 26 (Right wing bottom) */}
              <g>
                <rect x="655" y="205" width="54" height="70" fill="#0f172a" stroke="#475569" strokeWidth="1.2" />
                <line x1="655" y1="205" x2="709" y2="228" stroke="#475569" strokeWidth="1" />
                <line x1="709" y1="205" x2="655" y2="228" stroke="#475569" strokeWidth="1" />
                <line x1="655" y1="228" x2="709" y2="251" stroke="#475569" strokeWidth="1" />
                <line x1="709" y1="228" x2="655" y2="251" stroke="#475569" strokeWidth="1" />
                <line x1="655" y1="251" x2="709" y2="275" stroke="#475569" strokeWidth="1" />
                <line x1="709" y1="251" x2="655" y2="275" stroke="#475569" strokeWidth="1" />
              </g>

              {/* ALL 32 INTERACTIVE ROOM BLOCKS */}
              {FLOOR_BLUEPRINT_SLOTS.map(slot => {
                const data = slotStatusMap.get(slot.suffix);
                const fullRoom = data ? data.fullRoom : formatRoomNumber(activeFloor, slot.suffix);
                const summary = data?.summary;
                const isSelected = fullRoom === currentRoom;
                const isHovered = fullRoom === hoveredRoom;
                const isDone = completedRooms.includes(fullRoom);

                // Status colors
                const primaryStatus = summary?.primaryStatus || 'unmarked';
                let fillColor = '#1e293b'; // default dark
                let strokeColor = '#475569';
                let strokeWidth = 1.5;

                if (isSelected) {
                  fillColor = '#1e3a8a'; // bright indigo/blue
                  strokeColor = '#60a5fa';
                  strokeWidth = 3;
                } else if (primaryStatus === 'absent') {
                  fillColor = '#450a0a'; // rose dark
                  strokeColor = '#f43f5e';
                  strokeWidth = 2;
                } else if (primaryStatus === 'leave') {
                  fillColor = '#451a03'; // amber dark
                  strokeColor = '#f59e0b';
                } else if (primaryStatus === 'late') {
                  fillColor = '#082f49'; // sky dark
                  strokeColor = '#38bdf8';
                } else if (primaryStatus === 'present' && isDone) {
                  fillColor = '#064e3b'; // emerald dark
                  strokeColor = '#10b981';
                } else if (isDone) {
                  fillColor = '#064e3b';
                  strokeColor = '#059669';
                }

                if (isHovered && !isSelected) {
                  strokeColor = '#38bdf8';
                  strokeWidth = 2.5;
                }

                return (
                  <g
                    key={`room-slot-${slot.suffix}`}
                    onClick={() => onSelectRoom(fullRoom)}
                    onMouseEnter={() => setHoveredRoom(fullRoom)}
                    onMouseLeave={() => setHoveredRoom(null)}
                    className="cursor-pointer transition-all duration-150"
                  >
                    {/* Room Box Container */}
                    <rect
                      x={slot.x}
                      y={slot.y}
                      width={slot.width}
                      height={slot.height}
                      rx="5"
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                    />

                    {/* Active Pulsing Indicator if Selected */}
                    {isSelected && (
                      <rect
                        x={slot.x - 3}
                        y={slot.y - 3}
                        width={slot.width + 6}
                        height={slot.height + 6}
                        rx="8"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                        className="animate-pulse"
                      />
                    )}

                    {/* Cadre Star Icon (Top Right of Room) */}
                    {summary?.hasCadre && (
                      <g transform={`translate(${slot.x + slot.width - 16}, ${slot.y + 4})`}>
                        <polygon
                          points="6,0 7.8,3.8 12,4.4 9,7.3 9.7,11.5 6,9.5 2.3,11.5 3,7.3 0,4.4 4.2,3.8"
                          fill="#fbbf24"
                        />
                      </g>
                    )}

                    {/* Completed Checkmark Icon (Top Left of Room) */}
                    {isDone && (
                      <g transform={`translate(${slot.x + 4}, ${slot.y + 4})`}>
                        <circle cx="5" cy="5" r="5" fill="#10b981" />
                        <path
                          d="M 3 5 L 4.5 7 L 7.5 3.5"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </g>
                    )}

                    {/* Room Suffix Label (Large, exact 01~32 as in blueprint) */}
                    <text
                      x={slot.x + slot.width / 2}
                      y={slot.y + slot.height / 2 - 2}
                      fill="#ffffff"
                      fontSize={slot.zone === 'protruding' ? '18' : '17'}
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="tracking-tight"
                    >
                      {slot.suffix}
                    </text>

                    {/* Full Room Number Subtitle (e.g. "416") */}
                    <text
                      x={slot.x + slot.width / 2}
                      y={slot.y + slot.height / 2 + 15}
                      fill="#94a3b8"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {fullRoom}
                    </text>

                    {/* Bed Status Dots (Bottom of room) */}
                    {summary && summary.totalBeds > 0 && (
                      <g transform={`translate(${slot.x + slot.width / 2}, ${slot.y + slot.height - 10})`}>
                        {(() => {
                          const beds = data?.beds || [];
                          const dotSpacing = 8;
                          const startX = -((beds.length - 1) * dotSpacing) / 2;

                          return beds.map((bed, idx) => {
                            const rec = records[bed.id];
                            const st = rec?.status || 'unmarked';
                            let dotColor = '#64748b'; // unmarked
                            if (st === 'present') dotColor = '#10b981';
                            else if (st === 'absent') dotColor = '#ef4444';
                            else if (st === 'leave') dotColor = '#f59e0b';
                            else if (st === 'late') dotColor = '#38bdf8';

                            return (
                              <circle
                                key={bed.id}
                                cx={startX + idx * dotSpacing}
                                cy="0"
                                r="2.8"
                                fill={dotColor}
                              />
                            );
                          });
                        })()}
                      </g>
                    )}

                    {/* Protruding Label text for 29, 30, 31, 32 */}
                    {slot.zone === 'protruding' && (
                      <text
                        x={slot.x + slot.width / 2}
                        y={slot.y + slot.height - 22}
                        fill="#64748b"
                        fontSize="9"
                        fontWeight="semibold"
                        textAnchor="middle"
                      >
                        南向房
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      ) : (
        /* COMPACT GRID VIEW (For quick fingertip selection) */
        <div className="p-3 sm:p-4 max-h-[460px] overflow-y-auto">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {FLOOR_BLUEPRINT_SLOTS.map(slot => {
              const data = slotStatusMap.get(slot.suffix);
              const fullRoom = data ? data.fullRoom : formatRoomNumber(activeFloor, slot.suffix);
              const summary = data?.summary;
              const isSelected = fullRoom === currentRoom;
              const isDone = completedRooms.includes(fullRoom);

              return (
                <button
                  key={`grid-${slot.suffix}`}
                  onClick={() => onSelectRoom(fullRoom)}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-500/50'
                      : summary?.hasAbsent
                      ? 'bg-rose-950/70 border-rose-800 text-rose-200 hover:border-rose-600'
                      : isDone
                      ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200 hover:border-emerald-600'
                      : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400 font-mono">#{slot.suffix}</span>
                    {summary?.hasCadre && <Star className="w-3 h-3 text-amber-300 fill-amber-300" />}
                    {isDone && <Check className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <div className="font-black text-sm text-white">{fullRoom}</div>
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    {data?.beds.map(b => {
                      const st = records[b.id]?.status || 'unmarked';
                      let c = 'bg-slate-700';
                      if (st === 'present') c = 'bg-emerald-400';
                      else if (st === 'absent') c = 'bg-rose-500 animate-pulse';
                      else if (st === 'leave') c = 'bg-amber-400';
                      else if (st === 'late') c = 'bg-sky-400';
                      return <span key={b.id} className={`w-1.5 h-1.5 rounded-full ${c}`} />;
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected / Hovered Room Real-Time Information Panel */}
      {activeDetailData && (
        <div className="px-3 py-2.5 sm:px-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 font-mono">
              {activeDetailData.room} 房
            </span>
            {activeDetailData.summary.hasCadre && (
              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                <Star className="w-3 h-3 fill-amber-300" />
                幹部：{activeDetailData.summary.cadreTags.join('、')}
              </span>
            )}
            <span className="text-slate-400">
              共 {activeDetailData.beds.length} 床位
              (已到: <strong className="text-emerald-400">{activeDetailData.summary.presentCount}</strong>,
              未到: <strong className="text-rose-400">{activeDetailData.summary.absentCount}</strong>,
              請假: <strong className="text-amber-400">{activeDetailData.summary.leaveCount}</strong>)
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {activeDetailData.beds.map(bed => {
              const rec = records[bed.id];
              const st = rec?.status || 'unmarked';
              const stLabel = st === 'present' ? '已到' : st === 'absent' ? '未到' : st === 'leave' ? '請假' : st === 'late' ? '晚歸' : '待點';
              const stColor = st === 'present' ? 'text-emerald-400' : st === 'absent' ? 'text-rose-400 font-bold' : st === 'leave' ? 'text-amber-400' : st === 'late' ? 'text-sky-400' : 'text-slate-400';

              return (
                <div key={bed.id} className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                  <span className="text-slate-400 font-mono font-bold">{bed.bed}床:</span>
                  <span className="font-semibold text-slate-200">{bed.name}</span>
                  <span className={`text-[11px] ${stColor}`}>[{stLabel}]</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Blueprint Legend Footer */}
      <div className="px-3 py-2 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 font-semibold text-slate-300">圖例說明:</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />全到/已到</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" />有缺席/未到</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />請假</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" />晚歸</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-600" />待確認</span>
          <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-300 fill-amber-300" />幹部房</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600 border border-blue-400" />當前房</span>
        </div>
        <div className="text-slate-500 text-[10px]">
          點選圖中任一房號即可直接進入該房點名
        </div>
      </div>
    </div>
  );
};
