import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import { addDays, bucketize, n, rangeLabel, type Bucket, type Model } from '../lib/stats';
import type { Grain, Period } from '../types';
import { Segmented } from './Ui';

const GRAINS: { value: Grain; label: string }[] = [
  { value: 'day', label: '일별' },
  { value: 'week', label: '주별' },
  { value: 'month', label: '월별' },
];

type Preset = '7' | '30' | '90' | 'all' | 'custom';
const PRESETS: { value: Preset; label: string }[] = [
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
  { value: '90', label: '90일' },
  { value: 'all', label: '전체' },
];

/** 기간을 직접 고르기 전 기본값 — 일별은 막대가 읽히는 30일, 주·월별은 흐름을 보는 전체 */
const defaultPreset = (g: Grain): Preset => (g === 'day' ? '30' : 'all');

const BAR = 'var(--nr-p1)';
const BAR_PARTIAL = '#b9d4ef';

const Tip: React.FC<{ active?: boolean; payload?: { payload: Bucket }[]; grain: Grain }> = ({
  active,
  payload,
  grain,
}) => {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <div className="rounded-[10px] border border-[var(--nr-line)] bg-white px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-bold text-slate-500">
        {grain === 'day' ? b.key : grain === 'week' ? `${b.key} 주 (월~일)` : b.key.slice(0, 7)}
      </div>
      <div className="font-bold tabular-nums text-slate-900">{n(b.value)}회</div>
      {b.partial && <div className="text-xs text-slate-500">기간 일부만 포함되거나 진행 중인 구간</div>}
      {b.missingDays > 0 && <div className="text-xs text-amber-800">수집 누락 {b.missingDays}일 (0으로 계산)</div>}
    </div>
  );
};

const dateInput =
  'rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums text-slate-700 bg-white hover:border-[var(--nr-p3)] focus:border-[var(--nr-p3)]';

/**
 * 조회수 추이 — 막대 하나짜리 계열이라 범례 없이 제목이 이름을 대신함.
 * from: 그릴 수 있는 가장 이른 날 (도구의 첫 수집일 등). 그 앞의 빈 구간은 잘라냄.
 */
export const TrendChart: React.FC<{
  model: Model;
  daily: number[];
  title: string;
  desc?: string;
  from?: string;
  /** 고른 기간을 바깥(첫 화면 카드 등)에 알림 */
  onPeriod?: (p: Period) => void;
  /** 날짜를 나눌 수 없는 수집 전 누적 — 기간이 수집 시작일을 포함할 때 안내 */
  pre?: number;
}> = ({ model, daily, title, desc, from, onPeriod, pre = 0 }) => {
  const [grain, setGrain] = useState<Grain>('day');
  const [picked, setPicked] = useState<Preset | null>(null); // null = 아직 직접 고르지 않음
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [asTable, setAsTable] = useState(false);
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;

  const minDate = from && from > model.start ? from : model.start;
  const maxDate = model.dates[model.dates.length - 1] ?? model.start;
  const preset = picked ?? defaultPreset(grain);

  const range = useMemo(() => {
    if (preset === 'custom' && custom) return custom;
    const start = preset === 'all' ? minDate : addDays(maxDate, -(Number(preset) - 1));
    return { from: start < minDate ? minDate : start, to: maxDate };
  }, [preset, custom, minDate, maxDate]);

  /** 수집 기간에 걸친 달 목록 — 고르면 그 달 1일~말일(수집 범위로 자름) */
  const months = useMemo(() => {
    const out: { key: string; label: string; from: string; to: string }[] = [];
    for (let k = `${minDate.slice(0, 7)}-01`; k <= maxDate; ) {
      const d = new Date(`${k}T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + 1, 0);
      const end = d.toISOString().slice(0, 10);
      const [y, mo] = k.split('-').map(Number);
      out.push({ key: k.slice(0, 7), label: `${y}년 ${mo}월`, from: k < minDate ? minDate : k, to: end > maxDate ? maxDate : end });
      d.setUTCDate(d.getUTCDate() + 1);
      k = d.toISOString().slice(0, 10);
    }
    return out;
  }, [minDate, maxDate]);
  const monthKey = months.find((x) => x.from === range.from && x.to === range.to)?.key ?? '';

  const periodLabel =
    preset === 'all'
      ? '전체 기간'
      : monthKey
        ? months.find((x) => x.key === monthKey)!.label
        : preset === 'custom'
          ? rangeLabel(range.from, range.to)
          : `최근 ${preset}일`;

  useEffect(() => {
    onPeriod?.({
      from: range.from,
      to: range.to,
      label: periodLabel,
      all: range.from <= model.start && range.to >= maxDate,
    });
  }, [onPeriod, range.from, range.to, periodLabel, model.start, maxDate]);

  const data = useMemo(
    () => bucketize(model, daily, grain, range.from, range.to),
    [model, daily, grain, range],
  );
  const total = data.reduce((s, b) => s + b.value, 0);

  const pickPreset = (p: Preset) => {
    setPicked(p);
    setCustom(null);
  };
  const setEdge = (edge: 'from' | 'to', v: string) => {
    if (!v) return;
    const next = { ...range, [edge]: v };
    if (next.from > next.to) {
      if (edge === 'from') next.to = next.from;
      else next.from = next.to;
    }
    setCustom(next);
    setPicked('custom');
  };

  return (
    <div className="bg-white rounded-[10px] border border-[var(--nr-line)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            {desc ?? '조회수 증가량'} · 선택 기간 합계 <b className="tabular-nums text-slate-700">{n(total)}회</b>
            {pre > 0 && range.from <= model.start && (
              <> · 수집 시작 전 누적 {n(pre)}회는 날짜를 나눌 수 없어 그래프에 미포함</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented label="집계 단위" value={grain} options={GRAINS} onChange={setGrain} />
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-bold text-slate-600 hover:border-[var(--nr-p3)] hover:text-[var(--nr-p3)]"
          >
            {asTable ? <BarChart3 className="w-4 h-4" aria-hidden="true" /> : <Table2 className="w-4 h-4" aria-hidden="true" />}
            {asTable ? '그래프' : '표'}
          </button>
        </div>
      </div>

      {/* 기간 — 단추로 빠르게, 날짜 칸으로 직접 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 pt-3">
        <Segmented
          label="기간"
          value={preset === 'custom' ? ('' as Preset) : preset}
          options={PRESETS}
          onChange={pickPreset}
        />
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <label>
            <span className="sr-only">시작일</span>
            <input type="date" className={dateInput} value={range.from} min={minDate} max={maxDate} onChange={(e) => setEdge('from', e.target.value)} />
          </label>
          <span aria-hidden="true">~</span>
          <label>
            <span className="sr-only">종료일</span>
            <input type="date" className={dateInput} value={range.to} min={minDate} max={maxDate} onChange={(e) => setEdge('to', e.target.value)} />
          </label>
        </div>
        <label className="text-sm">
          <span className="sr-only">월 선택</span>
          <select
            value={monthKey}
            onChange={(e) => {
              const mo = months.find((x) => x.key === e.target.value);
              if (!mo) return;
              setCustom({ from: mo.from, to: mo.to });
              setPicked('custom');
            }}
            className={`rounded-lg border px-2.5 py-1 text-sm font-bold bg-white hover:border-[var(--nr-p3)] ${
              monthKey ? 'border-slate-900 text-slate-900' : 'border-slate-300 text-slate-600'
            }`}
          >
            <option value="" disabled>
              월 선택
            </option>
            {months.map((mo) => (
              <option key={mo.key} value={mo.key}>
                {mo.label}
              </option>
            ))}
          </select>
        </label>
        {picked === null && (
          <span className="text-xs text-slate-400">{grain === 'day' ? '일별 기본: 최근 30일' : '주·월별 기본: 전체 기간'}</span>
        )}
      </div>

      {asTable ? (
        <div className="mt-3 max-h-80 overflow-auto rounded border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-bold">구간</th>
                <th className="px-3 py-2 text-right font-bold">조회수</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((b) => (
                <tr key={b.key} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 tabular-nums">
                    {grain === 'month' ? b.key.slice(0, 7) : b.key}
                    {grain === 'week' && ' 주'}
                    {b.partial && <span className="ml-1 text-xs text-slate-400">(일부)</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-bold">{n(b.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 h-56" role="img" aria-label={`${title} 막대그래프, 표 단추로 수치 확인`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: narrow ? -2 : -12 }} barCategoryGap={data.length > 40 ? 1 : '20%'}>
              <CartesianGrid vertical={false} stroke="var(--color-slate-200)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: 'var(--color-slate-300)' }}
                tick={{ fontSize: 12, fill: 'var(--color-slate-500)' }}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={narrow ? 44 : 48}
                tick={{ fontSize: 12, fill: 'var(--color-slate-500)' }}
                tickFormatter={(v: number) => n(v)}
              />
              <Tooltip cursor={{ fill: 'var(--color-slate-100)' }} content={<Tip grain={grain} />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                {data.map((b) => (
                  <Cell key={b.key} fill={b.partial ? BAR_PARTIAL : BAR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
        <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: BAR_PARTIAL }} aria-hidden="true" />
        옅은 막대: 선택 기간에 일부만 들어가거나 아직 끝나지 않은 구간
      </p>
    </div>
  );
};
