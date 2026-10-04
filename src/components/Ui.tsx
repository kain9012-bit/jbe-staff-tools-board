import React from 'react';

/** 상태·부서 배지 — 기준 저장소(jbe-weekly-policy-meeting)와 같은 규격 */
export const Badge: React.FC<{
  tone?: 'blue' | 'slate' | 'amber' | 'green' | 'red';
  children: React.ReactNode;
}> = ({ tone = 'slate', children }) => {
  const cls = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-700 border-red-200',
  }[tone];
  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-bold whitespace-nowrap ${cls}`}>
      {children}
    </span>
  );
};

export const SectionTitle: React.FC<{
  children: React.ReactNode;
  count?: number;
  desc?: string;
}> = ({ children, count, desc }) => (
  <div className="flex items-baseline gap-2 flex-wrap">
    <h2 className="jbe-display text-xl font-extrabold text-slate-900">{children}</h2>
    {count !== undefined && (
      <span className="jbe-count text-sm font-bold tabular-nums">{count}건</span>
    )}
    {desc && <span className="text-xs text-slate-500">{desc}</span>}
  </div>
);

/** 지표 카드 */
export const Stat: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  desc?: string;
  tone?: 'slate' | 'red' | 'amber';
}> = ({ icon, label, value, desc, tone = 'slate' }) => {
  const vc = { slate: 'text-slate-900', red: 'text-red-700', amber: 'text-amber-800' }[tone];
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${vc}`}>{value}</div>
      {desc && <div className="text-xs text-slate-500">{desc}</div>}
    </div>
  );
};

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc?: string;
}> = ({ icon, title, desc }) => (
  <div className="bg-white rounded-lg border border-slate-200 p-12 text-center space-y-3">
    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
      {icon}
    </div>
    <h3 className="text-base font-bold text-slate-800">{title}</h3>
    {desc && <p className="text-sm text-slate-500 max-w-md mx-auto">{desc}</p>}
  </div>
);

/** 고른 갈래를 켜고 끄는 알약 단추 */
export const Chip: React.FC<{
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}> = ({ on, onClick, children, count }) => (
  <button
    type="button"
    aria-pressed={on}
    onClick={onClick}
    className={`px-3.5 py-1.5 rounded-full border text-sm font-bold transition-colors ${
      on
        ? 'bg-slate-900 border-slate-900 text-white'
        : 'bg-white border-slate-300 text-slate-600 hover:border-blue-600 hover:text-blue-700'
    }`}
  >
    {children}
    {count !== undefined && <span className="ml-1 tabular-nums font-normal opacity-80">{count}</span>}
  </button>
);

/** 일·주·월 같은 몇 개 중 하나를 고르는 묶음 단추 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-md text-sm font-bold transition-colors ${
            value === o.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-blue-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 카드 틀 */
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`bg-white rounded-lg border border-slate-200 ${className}`}>{children}</div>;
