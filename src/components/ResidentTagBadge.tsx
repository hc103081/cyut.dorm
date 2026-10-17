import React from 'react';
import { Crown, Star, Award, Shield, Tag } from 'lucide-react';
import { ResidentTag } from '../types/dorm.ts';

interface ResidentTagBadgeProps {
  tag?: ResidentTag | null;
  size?: 'xs' | 'sm' | 'md';
  onClick?: () => void;
  className?: string;
  showIcon?: boolean;
}

export const ResidentTagBadge: React.FC<ResidentTagBadgeProps> = ({
  tag,
  size = 'sm',
  onClick,
  className = '',
  showIcon = true,
}) => {
  if (!tag || tag === '無') return null;

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';
  let IconComponent = Tag;

  if (tag === '舍長') {
    colorClasses = 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-950/20';
    IconComponent = Crown;
  } else if (tag === '樓長') {
    colorClasses = 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-950/20';
    IconComponent = Star;
  } else if (tag === '副樓長') {
    colorClasses = 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm shadow-sky-950/20';
    IconComponent = Award;
  } else if (tag === '室長') {
    colorClasses = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    IconComponent = Shield;
  } else {
    // Custom label
    colorClasses = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
    IconComponent = Tag;
  }

  const sizeClasses =
    size === 'xs'
      ? 'text-[10px] px-1.5 py-0.2 gap-1 rounded font-semibold'
      : size === 'md'
      ? 'text-xs px-2.5 py-1 gap-1.5 rounded-lg font-bold'
      : 'text-[11px] px-2 py-0.5 gap-1 rounded-md font-bold';

  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center border shrink-0 tracking-wide select-none ${sizeClasses} ${colorClasses} ${
        onClick ? 'cursor-pointer hover:brightness-110 active:scale-95 transition-all' : ''
      } ${className}`}
    >
      {showIcon && <IconComponent className={`${iconSize} shrink-0`} />}
      <span>{tag}</span>
    </span>
  );
};
