import React from 'react';
import { ArrowRight, Boxes, ClipboardCheck, GitCommitVertical, MessagesSquare } from 'lucide-react';
import { PocTag, versionOf } from '../components/Poc';
import { PageTitle } from '../components/Shell';
import { allTools, n, sum, type Model } from '../lib/stats';
import { summaryOf } from '../lib/summaries';

/**
 * 개편 안내 — 데이터 도구실을 게시판 3개에서 하나의 플랫폼으로 바꾸는 PoC의 취지와 화면 안내.
 * 숫자는 모두 실제 수집 자료에서 계산
 */

const PILLARS = [
  {
    icon: Boxes,
    title: '게시판 3개를 하나로',
    now: ['교육청 배포·교직원 제작·외부 공공업무 도구가 게시판 3개에 따로 있음', '검색도 게시판마다 따로, 제목으로만 찾음'],
    next: ['한 번 검색으로 세 곳의 도구를 모두 찾음', '출처 표시로 누가 만든 도구인지 구분', '도구마다 같은 형식의 요약(한눈에 보기)'],
    links: [['도구 찾기', '/']],
  },
  {
    icon: ClipboardCheck,
    title: '등록·검수 절차',
    now: ['자유 글쓰기라 설명 형식이 제각각', '등록 전 보안 확인 절차 없음'],
    next: ['정해진 양식으로 등록하면 그대로 소개 화면이 됨', '보안 자가점검 6문항 → 담당자 검토 → 게시', '진행 단계를 신청자가 직접 확인'],
    links: [
      ['도구 등록', '/register'],
      ['검수 현황', '/review'],
    ],
  },
  {
    icon: MessagesSquare,
    title: '사용자 참여',
    now: ['소통 수단은 게시글 댓글뿐', '찾는 도구가 없을 때 말할 곳이 없음'],
    next: ["'이런 도구가 필요해요' 요청과 공감", '공감이 많은 요청부터 검토·제작, 해결 시 도구 연결', "'써봤어요'·별점 후기로 도구 고르기"],
    links: [['도구 요청', '/requests']],
  },
  {
    icon: GitCommitVertical,
    title: '버전·업데이트 관리',
    now: ['버전이 제목에만 적혀 있고 표기도 제각각', '업데이트돼도 받아 간 사람이 알 길이 없음'],
    next: ['도구마다 버전 이력과 바뀐 내용', '업데이트 알림 받기', '검수 정보에 현재 버전 표시'],
    links: [] as string[][],
  },
];

const FLOW = ['요청', '제작', '등록', '검수', '게시', '사용·후기', '업데이트'];

export const PocGuide: React.FC<{ m: Model }> = ({ m }) => {
  const all = allTools(m);
  const off = m.official?.tools ?? [];
  const ext = m.external?.tools ?? [];
  const versioned = all.filter((t) => versionOf(t.title)).length;
  const summarized = all.filter((t) => summaryOf(t.sid)).length;
  const sample = [...all].filter((t) => summaryOf(t.sid) && versionOf(t.title)).sort((a, b) => b.recent30 - a.recent30)[0];
  const links = PILLARS.map((p) => (p.title === '버전·업데이트 관리' && sample ? { ...p, links: [['도구 상세 예시', `/tool/${sample.sid}`]] } : p));

  return (
    <>
      <PageTitle desc="게시판 3개로 나뉜 데이터 도구실을, 찾고·등록하고·요청하고·업데이트를 받는 하나의 플랫폼으로 바꾸면 어떻게 되는지 보여 주는 시범(PoC) 화면입니다.">
        데이터 도구실 개편 안내
      </PageTitle>

      {/* 지금 숫자 */}
      <section aria-label="현재 데이터 도구실" className="mt-8 rounded-[16px] bg-[var(--nr-p2)] px-5 py-6 text-white sm:px-8">
        <p className="text-[14px] text-white/75">지금 데이터 도구실 (실제 수집 자료)</p>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['등록 도구', `${n(all.length)}개`, `교육청 ${off.length} · 교직원 ${m.tools.length} · 외부 ${ext.length}`],
            ['교직원 제작자', `${n(m.makers.length)}명`, '교직원 제작 도구 게시판 기준'],
            ['누적 조회수', n(sum(all.map((t) => t.views))), '세 게시판 합계'],
            ['최근 30일 조회', `+${n(sum(all.map((t) => t.recent30)))}`, '교육청 배포·교직원 제작'],
          ].map(([k, v, d]) => (
            <div key={k}>
              <dt className="text-[13px] text-white/75">{k}</dt>
              <dd className="nr-title text-[26px] tabular-nums sm:text-[30px]">{v}</dd>
              <dd className="text-[12px] text-white/65">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 네 가지 개편 방향 */}
      <section className="mt-12">
        <h2 className="nr-title text-[24px] text-black">네 가지 개편 방향</h2>
        <div className="mt-4 space-y-4">
          {links.map((p, i) => {
            const Icon = p.icon;
            return (
              <article key={p.title} className="overflow-hidden rounded-[14px] border border-[var(--nr-line)] bg-white">
                <h3 className="flex items-center gap-2 border-b border-[var(--nr-line)] bg-[var(--nr-bg)] px-5 py-3.5 text-[18px] font-bold text-[var(--nr-p2)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--nr-p2)] text-[14px] text-white">{i + 1}</span>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {p.title}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="px-5 py-4 md:border-r md:border-[var(--nr-line)]">
                    <p className="text-[13px] font-bold text-slate-500">지금</p>
                    <ul className="mt-1.5 space-y-1 text-[15px] text-slate-700">
                      {p.now.map((x) => (
                        <li key={x} className="flex gap-2">
                          <span aria-hidden="true" className="text-slate-400">–</span>
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-t border-[var(--nr-line)] px-5 py-4 md:border-t-0">
                    <p className="text-[13px] font-bold text-[var(--nr-p3)]">개편 후</p>
                    <ul className="mt-1.5 space-y-1 text-[15px] font-medium text-slate-900">
                      {p.next.map((x) => (
                        <li key={x} className="flex gap-2">
                          <span aria-hidden="true" className="text-[var(--nr-p1)]">✓</span>
                          {x}
                        </li>
                      ))}
                    </ul>
                    {p.links.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.links.map(([l, h]) => (
                          <a key={h} href={h} className="inline-flex items-center gap-1 rounded-full bg-[var(--nr-p1)] px-3.5 py-1.5 text-[13px] font-bold text-white hover:bg-[var(--nr-p3)]">
                            {l} 화면 보기 <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 도구 한 개의 일생 */}
      <section className="mt-12">
        <h2 className="nr-title text-[24px] text-black">도구 한 개가 순환하는 흐름</h2>
        <ol className="mt-4 flex flex-wrap items-center gap-2">
          {FLOW.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`rounded-full px-4 py-2 text-[15px] font-bold ${i === 4 ? 'bg-[var(--nr-p1)] text-white' : 'bg-[var(--nr-bg)] text-[var(--nr-p2)]'}`}>{s}</span>
              {i < FLOW.length - 1 && <ArrowRight className="w-4 h-4 text-slate-400" aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[15px] text-slate-600">
          사용자의 요청이 제작으로 이어지고, 검수를 거쳐 게시된 도구가 후기와 업데이트로 다시 좋아지는 구조. 지금 게시판은 '게시'만 있음
        </p>
      </section>

      {/* 실제와 예시 */}
      <section className="mt-12">
        <h2 className="nr-title text-[24px] text-black">이 PoC에서 실제인 것과 예시인 것</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-[12px] border border-[#9fd5b0] bg-[#f3faf5] p-5">
            <p className="text-[16px] font-bold text-[#1f7a3a]">실제 자료</p>
            <ul className="mt-2 space-y-1 text-[15px] text-slate-800">
              <li>세 게시판의 도구 목록 {n(all.length)}개</li>
              <li>도구별 요약(한눈에 보기) {n(summarized)}개</li>
              <li>조회수 추이 — 교육청 배포·교직원 제작, 매시간 수집</li>
              <li>교직원 제작 도구 댓글</li>
              <li>제목에 적힌 버전 {n(versioned)}개, 요약의 실행 방식·유의사항</li>
            </ul>
          </div>
          <div className="rounded-[12px] border border-[#f0d9a6] bg-[#fffaf0] p-5">
            <p className="flex items-center gap-2 text-[16px] font-bold text-[#8a5300]">
              PoC 예시 <PocTag />
            </p>
            <ul className="mt-2 space-y-1 text-[15px] text-slate-800">
              <li>도구 요청 목록과 공감 수</li>
              <li>등록 양식·자가점검·검수 단계</li>
              <li>써봤어요·후기·업데이트 알림</li>
              <li>검수 정보의 '미확인' 항목</li>
              <li>누른 기록은 이 브라우저에만 저장, 서버에 남지 않음</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 다음 단계 */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="nr-title text-[24px] text-black">다음 단계</h2>
          <PocTag label="제안" />
        </div>
        <ol className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            ['PoC 의견 수렴', '부서·교직원이 화면을 써 보고 필요한 기능과 빼도 될 기능을 가림'],
            ['운영 방식 결정', '누리집 게시판 개편으로 할지 별도 플랫폼으로 할지, 검수 담당과 기준 확정'],
            ['시범 운영', '등록·검수·요청을 실제로 받아 일정 기간 운영 후 전면 전환'],
          ].map(([h, d], i) => (
            <li key={h} className="rounded-[12px] border border-[var(--nr-line)] bg-white p-5">
              <p className="nr-title text-[28px] text-[var(--nr-p1)]">{i + 1}</p>
              <p className="mt-1 text-[17px] font-bold text-black">{h}</p>
              <p className="mt-1 text-[14px] text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
};
