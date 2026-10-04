import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import { bucketize, mondayOf, n, type Bucket, type Model } from '../lib/stats';
import type { Grain } from '../types';
import { Segmented } from './Ui';

const GRAINS: { value: Grain; label: string }[] = [
  { value: 'day', label: '일별' },
  { value: 'week', label: '주별' },
  { value: 'month', label: '월별' },
];

const MAX_DAYS = 60; // 일별은 최근 60일만

const BAR = 'var(--color-blue-600)';
const BAR_PARTIAL = 'var(--color-blue-200)';

const Tip: React.FC<{ active?: boolean; payload?: { payload: Bucket }[]; grain: Grain }> = ({
  active,
  payload,
  grain,
}) => {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <div className="text-xs font-bold text-slate-500">
        {grain === 'day' ? b.key : grain === 'week' ? `${b.key} 주 (월~일)` : b.key.slice(0, 7)}
      </div>
      <div className="font-bold tabular-nums text-slate-900">{n(b.value)}회</div>
      {b.partial && <div className="text-xs text-slate-500">수집 기간이 덜 찬 구간</div>}
      {b.missingDays > 0 && <div className="text-xs text-amber-800">수집 누락 {b.missingDays}일 (0으로 계산)</div>}
    </div>
  );
};

/** 조회수 추이 — 막대 하나짜리 계열이라 범례 없이 제목이 이름을 대신함 */
/** from: 이 날짜가 든 구간부터 그림 (최근 게시 도구의 앞쪽 빈 구간을 잘라냄) */
export const TrendChart: React.FC<{ model: Model; daily: number[]; title: string; desc?: string; from?: string }> = ({
  model,
  daily,
  title,
  desc,
  from,
}) => {
  const [grain, setGrain] = useState<Grain>('day');
  const [asTable, setAsTable] = useState(false);
  const data = useMemo(() => {
    let b = bucketize(model, daily, grain);
    if (from) {
      const k = grain === 'day' ? from : grain === 'week' ? mondayOf(from) : `${from.slice(0, 7)}-01`;
      b = b.filter((x) => x.key >= k);
    }
    return grain === 'day' ? b.slice(-MAX_DAYS) : b;
  }, [model, daily, grain, from]);
  const total = data.reduce((s, b) => s + b.value, 0);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            {desc ?? '조회수 증가량'} · 표시 구간 합계 <b className="tabular-nums text-slate-700">{n(total)}회</b>
            {grain === 'day' && model.dates.length > MAX_DAYS && ` · 최근 ${MAX_DAYS}일`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented label="집계 단위" value={grain} options={GRAINS} onChange={setGrain} />
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-bold text-slate-600 hover:border-blue-600 hover:text-blue-700"
          >
            {asTable ? <BarChart3 className="w-4 h-4" aria-hidden="true" /> : <Table2 className="w-4 h-4" aria-hidden="true" />}
            {asTable ? '그래프' : '표'}
          </button>
        </div>
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
        <div className="mt-3 h-56" role="img" aria-label={`${title} 막대그래프, 표로 보기 단추로 수치 확인`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap={grain === 'day' ? 2 : '25%'}>
              <CartesianGrid vertical={false} stroke="var(--color-slate-200)" strokeDasharray="0" />
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
                width={48}
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
        <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: BAR_PARTIAL }} aria-hidden="true" />
        옅은 막대: 아직 끝나지 않았거나 수집 시작 전이 섞인 구간
      </p>
    </div>
  );
};
