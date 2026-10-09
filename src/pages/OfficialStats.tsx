import React, { useCallback, useMemo, useState } from 'react';
import { CalendarDays, Eye, History, TrendingUp, Wrench } from 'lucide-react';
import { RankRow, ToolTable } from '../components/Lists';
import { PageTitle } from '../components/Shell';
import { TrendChart } from '../components/TrendChart';
import { Card, EmptyState, Stat } from '../components/Ui';
import officialMeta from '../data/official-meta.json';
import { hrefTool } from '../lib/route';
import { dayLabel, n, periodStats, rangeLabel, shortDay, sum, type Model } from '../lib/stats';
import type { Period } from '../types';

/**
 * 제작자 현황 > 교육청 배포 도구
 * 교직원 제작 도구 화면을 바탕으로 하되, 제작자가 한 명이고 댓글을 모으지 않으므로
 * 제작자 순위·댓글 지표는 빼고 '도구' 기준으로만 봄. 수집 시작일(2026. 9. 1.)이 교직원 제작 도구와 다름
 */
const CATEGORY = (officialMeta as { items: Record<string, { category: string }> }).items;

const Panel: React.FC<{ title: string; desc: string; children: React.ReactNode }> = ({ title, desc, children }) => (
  <Card className="flex min-w-0 flex-col">
    <div className="border-b border-slate-200 px-4 py-3">
      <h2 className="nr-title text-[20px] text-black">{title}</h2>
      <p className="text-xs text-slate-500">{desc}</p>
    </div>
    <ol className="flex-1 divide-y divide-slate-100 py-1">{children}</ol>
  </Card>
);

export const OfficialStats: React.FC<{ m: Model }> = ({ m }) => {
  const om = m.official;
  const last = om ? om.dates[om.dates.length - 1] ?? om.start : '';
  const [period, setPeriodState] = useState<Period | null>(null);
  const setPeriod = useCallback((p: Period) => setPeriodState(p), []);
  const allDaily = useMemo(() => (om ? om.dates.map((_, i) => sum(om.tools.map((t) => t.daily[i]))) : []), [om]);

  if (!om) {
    return (
      <>
        <PageTitle>교육청 배포 도구</PageTitle>
        <EmptyState
          icon={<Wrench className="w-5 h-5" aria-hidden="true" />}
          title="교육청 배포 도구 자료를 불러오지 못함"
          desc="수집 시트를 읽지 못했습니다. 잠시 뒤 다시 열어 주세요."
        />
      </>
    );
  }

  const p = period ?? { from: om.start, to: last, label: '전체 기간', all: true };
  const ps = periodStats(om, p.from, p.to);
  const pv = (sid: string) => ps.views.get(sid) ?? 0;
  const periodText = p.all ? '전체 기간' : `${p.label} (${rangeLabel(p.from, p.to)})`;

  const ranked = [...om.tools].sort((a, b) => pv(b.sid) - pv(a.sid) || b.views - a.views);
  const popular = ranked.filter((t) => pv(t.sid) > 0).slice(0, 10);

  /** 게시판의 '도구 구분'별 — 실행 프로그램형·html 파일형·브라우저 확장형 */
  const byCat = new Map<string, { n: number; v: number; total: number }>();
  for (const t of om.tools) {
    const c = CATEGORY[t.sid]?.category ?? '구분 없음';
    const e = byCat.get(c) ?? { n: 0, v: 0, total: 0 };
    e.n++;
    e.v += pv(t.sid);
    e.total += t.views;
    byCat.set(c, e);
  }
  const cats = [...byCat.entries()].sort((a, b) => b[1].v - a[1].v || b[1].total - a[1].total);

  const total = sum(om.tools.map((t) => t.views));

  return (
    <>
      <PageTitle desc="정책기획과가 배포한 업무도구의 조회수 현황. 기간을 골라 보면 아래 순위가 함께 바뀝니다.">교육청 배포 도구</PageTitle>

      <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Wrench className="w-3.5 h-3.5" aria-hidden="true" />} label="등록 도구" value={n(om.tools.length)} desc="게시중 글, 공지 제외" />
        <Stat icon={<Eye className="w-3.5 h-3.5" aria-hidden="true" />} label="누적 조회수" value={n(total)} desc="전체 도구 합계" />
        <Stat
          icon={<TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />}
          label="최근 30일"
          value={`+${n(sum(om.tools.map((t) => t.recent30)))}`}
          desc="오늘 포함 30일"
        />
        <Stat
          icon={<CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />}
          label="이번 주 조회수"
          value={`+${n(sum(om.tools.map((t) => t.thisWeek)))}`}
          desc={`${dayLabel(om.weekStart)}부터`}
        />
      </div>

      <section className="mt-6">
        <TrendChart
          model={om}
          daily={allDaily}
          title="전체 도구 조회수 추이"
          desc="교육청 배포 도구 조회수 증가량 합계"
          onPeriod={setPeriod}
          pre={sum(om.tools.map((t) => t.pre))}
        />
      </section>

      <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <CalendarDays className="w-4 h-4 text-[var(--nr-p3)]" aria-hidden="true" />
        아래 순위는 그래프에서 고른 기간 기준
        <b className="rounded-md bg-[var(--nr-bg)] px-2 py-0.5 text-[var(--nr-p2)]">{periodText}</b>
        {ps.includesPre && ps.pre > 0 && (
          <span className="text-xs text-slate-500">
            · 수집 시작({shortDay(om.start)}) 전 조회수 {n(ps.pre)}회 포함
          </span>
        )}
      </p>

      <section className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="인기 도구" desc="선택 기간 조회수 순 · 상위 10개">
            {popular.length ? (
              popular.map((t, i) => (
                <RankRow
                  key={t.sid}
                  rank={i + 1}
                  href={hrefTool(t.sid)}
                  title={t.title}
                  sub={`${t.purpose} · ${CATEGORY[t.sid]?.category ?? ''}`}
                  value={`+${n(pv(t.sid))}회`}
                  valueSub={`누적 ${n(t.views)}`}
                />
              ))
            ) : (
              <li className="px-4 py-6 text-sm text-slate-500">이 기간에 늘어난 조회수 없음</li>
            )}
          </Panel>
        </div>
        <Panel title="도구 구분별" desc="게시판 도구 구분 기준 · 선택 기간 조회수">
          {cats.map(([c, e], i) => (
            <li key={c} className="flex items-center gap-3 px-4 py-3">
              <span className="nr-title w-5 text-center text-[18px] text-[var(--nr-p1)]">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-slate-900">{c}</span>
                <span className="block text-[13px] text-slate-500">도구 {e.n}개 · 누적 {n(e.total)}</span>
              </span>
              <span className="shrink-0 font-bold tabular-nums text-[var(--nr-p3)]">+{n(e.v)}회</span>
            </li>
          ))}
        </Panel>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="nr-title text-[22px] text-black">전체 도구 순위</h2>
          <span className="flex items-center gap-1 text-[13px] text-slate-500">
            <History className="w-3.5 h-3.5" aria-hidden="true" />
            선택 기간 조회수 순 · {om.tools.length}개
          </span>
        </div>
        <div className="mt-3">
          <ToolTable
            rows={ranked}
            today={last}
            startNo={1}
            extra={(t) => ({ label: '기간', value: `+${n(pv(t.sid))}` })}
          />
        </div>
      </section>
    </>
  );
};
