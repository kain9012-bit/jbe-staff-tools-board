import React from 'react';
import { ArrowRight, Boxes, ClipboardCheck, GitCommitVertical, MessagesSquare, Sparkles } from 'lucide-react';
import { PocTag, versionOf } from '../components/Poc';
import { PageTitle } from '../components/Shell';
import { useHashScroll } from '../lib/route';
import { allTools, n, sum, type Model } from '../lib/stats';
import { summaryOf } from '../lib/summaries';
import { SOURCES } from '../lib/sources';
import { UPGRADE_RULE, upgradeCandidates } from '../lib/upgrade';

/**
 * 개편 안내 — 데이터 도구실을 게시판 3개에서 하나의 플랫폼으로 바꾸는 PoC의 취지와 화면 안내.
 * 숫자는 모두 실제 수집 자료에서 계산
 */

const PILLARS = [
  {
    icon: Boxes,
    title: '게시판 3개 → 도구 목록 1개 + 구분 3개',
    now: ['교육청 배포·교직원 제작·외부 공공업무 도구가 게시판 3개에 따로 있음', '검색도 게시판마다 따로, 제목으로만 찾음'],
    next: ['게시판은 없애고 구분을 도구의 속성으로 남김', '구분별 입구는 옛 게시판 이름 그대로 유지', '한 번 검색으로 세 구분을 모두 찾음', '구분마다 등록·검수·책임·문의 창구가 다름'],
    links: [
      ['도구 찾기', '/'],
      ['교육청 배포 도구', '/?src=official'],
    ],
  },
  {
    icon: ClipboardCheck,
    title: '같은 양식·같은 절차로 등록',
    now: ['올리는 사람마다 글 형식이 달라 사용자가 비교하기 어려움', '게시판마다 올리는 방식이 다르고, 등록 전 보안 확인 절차 없음'],
    next: ['세 구분 모두 같은 등록 양식 → 소개 화면이 같은 모양', '세 구분 모두 같은 절차: 자가점검 → 보안 검토 → 게시', '구분은 등록할 수 있는 사람만 다름(교육청 배포는 정책기획과 전용)', '진행 단계를 신청자가 직접 확인'],
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
  {
    icon: Sparkles,
    title: '고도화 → 교육청 배포 전환',
    now: ['많이 쓰이는 교직원 제작 도구를 키울 근거·절차가 없음', '제작자가 전보·휴직하면 도구 관리가 멈춤'],
    next: ['조회수·써봤어요·후기·요청 공감으로 고도화 후보 선정', '제작자 동의 → 정책기획과 고도화 → 교육청 배포로 전환', "전환해도 같은 도구 화면 유지, '원작' 표시", '유지보수·문의는 교육청이 이어받음'],
    links: [['고도화 진행', '/review#up-h']],
  },
];

const FLOW = ['요청', '제작', '등록', '검수', '게시', '사용·후기', '업데이트', '고도화', '교육청 배포 전환'];

export const PocGuide: React.FC<{ m: Model }> = ({ m }) => {
  useHashScroll();
  const all = allTools(m);
  const off = m.official?.tools ?? [];
  const ext = m.external?.tools ?? [];
  const versioned = all.filter((t) => versionOf(t.title)).length;
  const cands = upgradeCandidates(m);
  const summarized = all.filter((t) => summaryOf(t.sid)).length;
  const sample = [...all].filter((t) => summaryOf(t.sid) && versionOf(t.title)).sort((a, b) => b.recent30 - a.recent30)[0];
  const links = PILLARS.map((p) => (p.title === '버전·업데이트 관리' && sample ? { ...p, links: [['도구 상세 예시', `/tool/${sample.sid}`]] } : p));

  return (
    <>
      <PageTitle desc="게시판 3개로 나뉜 데이터 도구실을, 찾고·등록하고·요청하고·업데이트를 받고, 많이 쓰이는 도구는 교육청이 키우는 하나의 플랫폼으로 바꾸면 어떻게 되는지 보여 주는 시범(PoC) 화면입니다.">
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

      {/* 다섯 가지 개편 방향 */}
      <section className="mt-12">
        <h2 className="nr-title text-[24px] text-black">다섯 가지 개편 방향</h2>
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

      {/* 구분별 운영 방식 */}
      <section className="mt-12">
        <h2 className="nr-title text-[24px] text-black">구분별 운영 방식</h2>
        <p className="mt-1 text-[15px] text-slate-600">게시판 대신 구분이 누가 올리고 누가 책임지는지를 정함</p>
        <div className="mt-4 overflow-x-auto rounded-[12px] border border-[var(--nr-line)]">
          <table className="w-full min-w-[720px] text-[14px]">
            <thead className="bg-[var(--nr-bg)] text-left text-[13px] text-slate-600">
              <tr>
                {['구분', '등록하는 사람', '등록 방식', '검수', '책임·지원', '문의'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((x) => (
                <tr key={x.key} className="border-t border-[var(--nr-line)] align-top">
                  <th scope="row" className="px-4 py-3 text-left">
                    <a href={`/?src=${x.key}`} className="font-bold text-black hover:text-[var(--nr-p3)] hover:underline">
                      {x.name}
                    </a>
                    <span className="block text-[12px] font-normal text-slate-500">{all.filter((t) => (t.board ?? 'staff') === x.key).length}개</span>
                  </th>
                  <td className="px-4 py-3 font-bold text-slate-800">{x.who}</td>
                  <td className="px-4 py-3 text-slate-700">{x.how}</td>
                  <td className="px-4 py-3 text-slate-700">{x.review}</td>
                  <td className="px-4 py-3 text-slate-700">{x.resp}</td>
                  <td className="px-4 py-3 text-slate-700">{x.ask}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 게시판 이관 */}
      <section className="mt-12">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="nr-title text-[24px] text-black">게시판 이관 계획</h2>
          <PocTag label="제안" />
        </div>
        <p className="mt-1 text-[15px] text-slate-600">지금 게시글은 버리지 않고 구분을 붙여 그대로 옮김</p>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-[12px] border border-[var(--nr-line)] bg-white p-5">
            <p className="text-[16px] font-bold text-black">옮기는 글</p>
            <ul className="mt-2 space-y-1.5 text-[15px] text-slate-700">
              {SOURCES.map((x) => (
                <li key={x.key} className="flex justify-between gap-2">
                  <span>{x.name} 게시판</span>
                  <b className="tabular-nums text-slate-900">{all.filter((t) => (t.board ?? 'staff') === x.key).length}개</b>
                </li>
              ))}
              <li className="flex justify-between gap-2 border-t border-slate-100 pt-1.5">
                <span>교직원 제작 도구 댓글</span>
                <b className="tabular-nums text-slate-900">{n(sum(m.tools.map((t) => t.comments)))}개</b>
              </li>
            </ul>
          </div>
          <div className="rounded-[12px] border border-[var(--nr-line)] bg-white p-5">
            <p className="text-[16px] font-bold text-black">옮기는 항목</p>
            <ul className="mt-2 space-y-1.5 text-[15px] text-slate-700">
              <li>제목·작성자·게시일·조회수 → 도구 정보 (구분은 원래 게시판 기준)</li>
              <li>본문 → 등록 양식 항목(한눈에 보기)으로 정리, 원문은 보관</li>
              <li>첨부파일 → 도구 파일, 현재 버전으로 등록</li>
              <li>댓글 → 질문과 답변</li>
            </ul>
          </div>
          <div className="rounded-[12px] border border-[var(--nr-line)] bg-white p-5">
            <p className="text-[16px] font-bold text-black">기존 게시판 처리</p>
            <ol className="mt-2 space-y-2 text-[15px] text-slate-700">
              {[
                ['글쓰기 중지', '새 등록은 새 화면으로 안내'],
                ['읽기 전용', '일정 기간 원글 열람만 허용'],
                ['폐쇄', '원글 주소로 들어오면 새 도구 화면으로 연결'],
              ].map(([h, d], i) => (
                <li key={h} className="flex gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--nr-p2)] text-[12px] font-bold text-white">{i + 1}</span>
                  <span>
                    <b className="text-slate-900">{h}</b> · {d}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 도구 한 개의 일생 */}
      <section className="mt-12">
        <h2 className="nr-title text-[24px] text-black">도구 한 개가 순환하는 흐름</h2>
        <ol className="mt-4 flex flex-wrap items-center gap-2">
          {FLOW.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`rounded-full px-4 py-2 text-[15px] font-bold ${i === 4 ? 'bg-[var(--nr-p1)] text-white' : i >= 7 ? 'bg-[#fff1d6] text-[#8a5300]' : 'bg-[var(--nr-bg)] text-[var(--nr-p2)]'}`}>{s}</span>
              {i < FLOW.length - 1 && <ArrowRight className="w-4 h-4 text-slate-400" aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[15px] text-slate-600">
          사용자의 요청이 제작으로 이어지고, 검수를 거쳐 게시된 도구가 후기와 업데이트로 좋아지며, 많이 쓰이면 교육청이 고도화해 배포 도구로 키우는 구조. 지금 게시판은 '게시'만 있음
        </p>
      </section>

      {/* 고도화 후보 — 실제 조회수로 계산 */}
      <section id="upgrade" className="mt-12 scroll-mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="nr-title text-[24px] text-black">지금 고도화 후보</h2>
          <PocTag label="실제 조회수 기준" />
        </div>
        <p className="mt-1 text-[15px] text-slate-600">
          PoC 기준: {UPGRADE_RULE}. 개편 후에는 써봤어요·후기 평점·관련 요청 공감을 함께 봄. 후보가 곧 전환 대상은 아니며 제작자 동의가 먼저임
        </p>
        <ol className="mt-4 divide-y divide-[var(--nr-line)] rounded-[12px] border border-[var(--nr-line)] bg-white">
          {cands.map((t, i) => (
            <li key={t.sid}>
              <a href={`/tool/${t.sid}`} className="group flex items-center gap-3 px-4 py-3 hover:bg-[#fffaf0]">
                <span className="nr-title w-6 shrink-0 text-center text-[20px] text-[#e0a800]">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-black group-hover:text-[var(--nr-p3)]">{t.title}</span>
                  <span className="block truncate text-[13px] text-slate-500">원작 {t.author}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-bold tabular-nums text-[var(--nr-p3)]">+{n(t.recent30)}</span>
                  <span className="block text-[12px] text-slate-500">최근 30일</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
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
              <li>고도화 진행 단계(후보 선정만 실제 조회수 기준)</li>
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
