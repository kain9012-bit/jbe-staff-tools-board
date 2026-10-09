import React, { useCallback, useMemo, useState } from 'react';
import { CalendarDays, Eye, History, TrendingUp, Wrench } from 'lucide-react';
import { ToolTable } from '../components/Lists';
import { PageTitle } from '../components/Shell';
import { TrendChart } from '../components/TrendChart';
import { EmptyState, Stat } from '../components/Ui';
import { dayLabel, n, periodStats, rangeLabel, shortDay, sum, type Model } from '../lib/stats';
import type { Period } from '../types';

/**
 * 제작자 현황 > 교육청 배포 도구
 * 교직원 제작 도구 화면을 바탕으로 하되, 제작자가 한 명이고 댓글을 모으지 않으므로
 * 제작자 순위·댓글 지표는 빼고 '도구' 기준으로만 봄. 수집 시작일(2026. 9. 1.)이 교직원 제작 도구와 다름
 */
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

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="nr-title text-[22px] text-black">전체 도구 순위</h2>
          <span className="flex items-center gap-1 text-[13px] text-slate-500">
            <History className="w-3.5 h-3.5" aria-hidden="true" />
            선택 기간 조회수 순 · {om.tools.length}개
          </span>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <CalendarDays className="w-4 h-4 text-[var(--nr-p3)]" aria-hidden="true" />
        아래 순위는 그래프에서 고른 기간 기준
        <b className="rounded-md bg-[var(--nr-bg)] px-2 py-0.5 text-[var(--nr-p2)]">{periodText}</b>
        {ps.includesPre && ps.pre > 0 && (
          <span className="text-xs text-slate-500">
            · 수집 시작({shortDay(om.start)}) 전 조회수 {n(ps.pre)}회 포함
          </span>
        )}
      </p>

        <div className="mt-3">
          <ToolTable
            rows={ranked}
            today={last}
            startNo={1}
            noComments
            extra={(t) => ({ label: '기간', value: `+${n(pv(t.sid))}` })}
          />
        </div>
      </section>
    </>
  );
};
