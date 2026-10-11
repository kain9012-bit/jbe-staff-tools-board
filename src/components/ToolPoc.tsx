import React, { useState } from 'react';
import { Bell, BellRing, CheckCircle2, CircleDashed, GitCommitVertical, ShieldCheck, Star, ThumbsUp } from 'lucide-react';
import type { ToolStat } from '../lib/stats';
import { dayLabel } from '../lib/stats';
import type { ToolSummary } from '../lib/summaries';
import { PocTag, todayKst, usePocState, versionOf } from './Poc';
import { sourceOf } from '../lib/sources';

/**
 * 도구 상세의 개편 PoC 구역 — 검수 정보, 버전·업데이트, 써봤어요·후기.
 * 실제 자료로 알 수 있는 것(실행 방식, 설치 여부, 현재 버전, 제작자 안내 문구)만 채우고,
 * 나머지는 '미확인'으로 두어 개편 후 등록 양식으로 채워질 자리임을 보여 줌.
 */

type Level = 'ok' | 'warn' | 'unknown';
const LEVEL_STYLE: Record<Level, string> = {
  ok: 'text-[#1f7a3a]',
  warn: 'text-[#8a5300]',
  unknown: 'text-slate-400',
};

function transferOf(s?: ToolSummary): [Level, string] {
  const txt = [...(s?.cautions ?? []), ...(s?.needs ?? [])].join(' ');
  if (/외부 전송 없음|서버로 보내지 않음|전송 기능 없음|PC 안에서 처리|브라우저 안에서만/.test(txt)) return ['ok', '없음 (제작자 안내)'];
  if (/전송|API 키|AI 제공자/.test(txt)) return ['warn', '있을 수 있음 (제작자 안내)'];
  return ['unknown', '미확인'];
}

const Row: React.FC<{ label: string; level: Level; value: string }> = ({ label, level, value }) => (
  <li className="flex items-center justify-between gap-3 py-2">
    <span className="text-[14px] text-slate-600">{label}</span>
    <span className={`flex items-center gap-1 text-[14px] font-bold ${LEVEL_STYLE[level]}`}>
      {level === 'unknown' ? <CircleDashed className="w-4 h-4" aria-hidden="true" /> : <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
      {value}
    </span>
  </li>
);

/** 검수 정보 — 게시판별로 지금 상태가 다름을 그대로 보여 줌 */
export const TrustPanel: React.FC<{ t: ToolStat; s?: ToolSummary }> = ({ t, s }) => {
  const board = t.board ?? 'staff';
  const head =
    board === 'official'
      ? { tone: 'bg-[#e8f3ec] text-[#1f7a3a]', text: '교육청 배포 · 배포 전 검토', desc: '정책기획과가 만들어 배포한 도구' }
      : board === 'external'
        ? { tone: 'bg-[#eef6f3] text-[#0b6b52]', text: '외부 기관 도구 · 선정 안내', desc: '교육청 밖 공공기관 도구. 교육청 검수 대상 아님' }
        : { tone: 'bg-[#f1f3f6] text-slate-700', text: '검수 전', desc: '지금 게시판은 등록 전 검수 절차가 없음' };
  const install = s?.run ? (['설치 프로그램', '브라우저 확장'].includes(s.run) ? '필요' : '필요 없음') : '';
  const [tl, tv] = transferOf(s);
  const ver = versionOf(t.title);
  return (
    <section className="rounded-[10px] border border-[var(--nr-line)] bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-black">
          <ShieldCheck className="w-5 h-5 text-[var(--nr-p1)]" aria-hidden="true" /> 검수 정보
        </h2>
        <PocTag />
      </div>
      <p className={`mt-3 rounded-lg px-3 py-2 text-[14px] font-bold ${head.tone}`}>
        {head.text}
        <span className="block text-[13px] font-normal opacity-90">{head.desc}</span>
      </p>
      <ul className="mt-2 divide-y divide-slate-100">
        <Row label="실행 방식" level={s?.run ? 'ok' : 'unknown'} value={s?.run ?? '미확인'} />
        <Row label="설치" level={install ? (install === '필요' ? 'warn' : 'ok') : 'unknown'} value={install || '미확인'} />
        <Row label="외부 전송" level={tl} value={tv} />
        <Row label="개인정보 처리" level="unknown" value="미확인" />
        <Row label="현재 버전 표기" level={ver ? 'ok' : 'unknown'} value={ver ? `v${ver}` : '미표기'} />
        <Row label="문의 창구" level="ok" value={sourceOf(board).ask} />
      </ul>
      <p className="mt-2 text-[12px] text-slate-500">
        '미확인' 항목은 개편 후 등록 양식의 보안 자가점검과 검수 결과로 채워짐
      </p>
    </section>
  );
};

/** 버전·업데이트 — 지금은 제목의 버전과 게시일만 알 수 있음 */
export const VersionPanel: React.FC<{ t: ToolStat }> = ({ t }) => {
  const ver = versionOf(t.title);
  const [subs, setSubs] = usePocState<string[]>('subs', []);
  const on = subs.includes(t.sid);
  return (
    <section className="rounded-[10px] border border-[var(--nr-line)] bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-black">
          <GitCommitVertical className="w-5 h-5 text-[var(--nr-p1)]" aria-hidden="true" /> 버전·업데이트
        </h2>
        <PocTag />
      </div>
      <ol className="mt-4 border-l-2 border-[var(--nr-line)] pl-4 space-y-4">
        <li className="relative">
          <span aria-hidden="true" className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-[var(--nr-p1)] ring-4 ring-white" />
          <p className="text-[15px] font-bold text-black">
            {ver ? `v${ver}` : '현재 버전'} <span className="ml-1 rounded bg-[var(--nr-bg)] px-1.5 py-0.5 text-[11px] text-[var(--nr-p3)]">현재</span>
          </p>
          <p className="text-[13px] text-slate-500">{dayLabel(t.created)} 게시</p>
        </li>
        <li className="relative">
          <span aria-hidden="true" className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-dashed border-slate-300 bg-white ring-4 ring-white" />
          <p className="text-[14px] text-slate-500">다음 업데이트부터 버전·바뀐 내용이 여기에 쌓임</p>
        </li>
      </ol>
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setSubs((v) => (on ? v.filter((x) => x !== t.sid) : [...v, t.sid]))}
        className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[14px] font-bold ${
          on ? 'bg-[var(--nr-p2)] text-white' : 'border border-[var(--nr-line)] bg-white text-slate-800 hover:border-[var(--nr-p3)]'
        }`}
      >
        {on ? <BellRing className="w-4 h-4" aria-hidden="true" /> : <Bell className="w-4 h-4" aria-hidden="true" />}
        {on ? '업데이트 알림 받는 중' : '업데이트 알림 받기'}
      </button>
      <p className="mt-2 text-[12px] text-slate-500">개편 후에는 새 버전이 등록되면 메신저로 알림. 지금은 이 브라우저에만 기록</p>
    </section>
  );
};

interface Review {
  sid: string;
  stars: number;
  text: string;
  at: string;
}

/** 써봤어요·후기 — 실제 후기는 없으므로 0에서 시작. 누른 기록은 이 브라우저에만 남음 */
export const ReactionPanel: React.FC<{ t: ToolStat }> = ({ t }) => {
  const [used, setUsed] = usePocState<string[]>('used', []);
  const [reviews, setReviews] = usePocState<Review[]>('reviews', []);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const mine = reviews.filter((r) => r.sid === t.sid);
  const didUse = used.includes(t.sid);
  const avg = mine.length ? mine.reduce((a, r) => a + r.stars, 0) / mine.length : 0;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="nr-title text-[22px] text-black">써 본 사람들</h2>
        <PocTag />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <div className="rounded-[10px] bg-[var(--nr-bg)] p-5 text-center">
          <p className="text-[13px] font-bold text-slate-600">써봤어요</p>
          <p className="nr-title mt-1 text-[34px] tabular-nums text-[var(--nr-p2)]">{didUse ? 1 : 0}</p>
          <p className="text-[13px] text-slate-500">
            평점 {mine.length ? `${avg.toFixed(1)} / 5 · 후기 ${mine.length}개` : '없음'}
          </p>
          <button
            type="button"
            aria-pressed={didUse}
            onClick={() => setUsed((v) => (didUse ? v.filter((x) => x !== t.sid) : [...v, t.sid]))}
            className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[14px] font-bold ${
              didUse ? 'bg-[var(--nr-p2)] text-white' : 'bg-white text-slate-800 ring-1 ring-[var(--nr-line)] hover:ring-[var(--nr-p3)]'
            }`}
          >
            <ThumbsUp className="w-4 h-4" aria-hidden="true" />
            {didUse ? '써봤어요 취소' : '저도 써봤어요'}
          </button>
        </div>
        <div className="rounded-[10px] border border-[var(--nr-line)] bg-white p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!stars || !text.trim()) return;
              setReviews((v) => [{ sid: t.sid, stars, text: text.trim().slice(0, 200), at: todayKst() }, ...v]);
              setStars(0);
              setText('');
            }}
          >
            <fieldset>
              <legend className="text-[14px] font-bold text-slate-800">짧은 후기 남기기</legend>
              <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="평점">
                {[1, 2, 3, 4, 5].map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={stars === k}
                    aria-label={`${k}점`}
                    onClick={() => setStars(k)}
                    className="p-0.5"
                  >
                    <Star className={`w-6 h-6 ${k <= stars ? 'fill-[#ffc531] text-[#ffc531]' : 'text-slate-300'}`} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="rv-text" className="sr-only">
                  후기
                </label>
                <input
                  id="rv-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={200}
                  placeholder="예: 매달 하던 집계가 10분으로 줄었어요"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] focus:border-[var(--nr-p3)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!stars || !text.trim()}
                  className="shrink-0 rounded-lg bg-[var(--nr-p1)] px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-40"
                >
                  남기기
                </button>
              </div>
            </fieldset>
          </form>
          {mine.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              {mine.map((r, i) => (
                <li key={i} className="py-2.5 text-[14px]">
                  <span className="mr-2 text-[#e0a800]" aria-label={`${r.stars}점`}>
                    {'★'.repeat(r.stars)}
                    <span className="text-slate-300">{'★'.repeat(5 - r.stars)}</span>
                  </span>
                  <span className="text-slate-800">{r.text}</span>
                  <span className="ml-2 text-[12px] text-slate-400">{r.at} · 나</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-slate-500">아직 후기가 없습니다. 개편 후에는 교직원 후기가 모여 도구를 고를 때 참고가 됨</p>
          )}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-slate-500">PoC에서는 누른 기록과 후기가 이 브라우저에만 저장됨</p>
    </section>
  );
};

