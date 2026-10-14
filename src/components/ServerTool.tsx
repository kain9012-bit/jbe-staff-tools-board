import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  BellRing,
  CheckCircle2,
  CircleDashed,
  Download,
  FileUp,
  GitCommitVertical,
  Pencil,
  ShieldCheck,
  Star,
  ThumbsUp,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { ToolStat } from '../lib/stats';
import { dayLabel, n, shortDay } from '../lib/stats';
import type { ToolSummary } from '../lib/summaries';
import type { Comment } from '../types';
import { sourceOf } from '../lib/sources';
import { useManage } from '../lib/manage';
import { act, api, errMsg, extraOf, needLogin, notice, refreshState, reloadData, sizeLabel, uploadFile, useSrv, type ToolExtra } from '../lib/server';
import { Badge, Card } from './Ui';
import { CornerDownRight } from 'lucide-react';

/**
 * 서버판 도구 상세 구역 — 내려받기·주소, 검수 정보, 버전·새 버전 올리기, 써봤어요·후기, 질문과 답변.
 * 화면 모양은 PoC(ToolPoc.tsx)와 같고, 기록은 서버에 저장됨
 */

/** 화면을 열면 조회수 +1 (같은 사람·같은 날은 한 번) */
export function useCountView(sid: string) {
  const done = useRef('');
  useEffect(() => {
    if (done.current === sid) return;
    done.current = sid;
    fetch(`/api/tools/${encodeURIComponent(sid)}/view`, { method: 'POST', credentials: 'same-origin' })
      .then((r) => r.json())
      .then((r: { counted?: boolean }) => r.counted && reloadData())
      .catch(() => null);
  }, [sid]);
}

/** 도구 머리의 주 단추 — 파일 내려받기 / 주소로 가기 / 이관 글은 원 게시글 */
export const ToolActions: React.FC<{ t: ToolStat }> = ({ t }) => {
  const x = extraOf(t.sid);
  const S = useSrv();
  const canEdit = S.editable.includes(t.sid);
  const big =
    'group inline-flex w-full sm:w-auto items-center justify-between gap-4 rounded-xl bg-[var(--nr-p1)] px-6 py-3.5 text-white shadow-md shadow-[rgba(28,100,172,0.2)] transition hover:bg-[var(--nr-p3)] hover:shadow-lg';
  const link = x?.link || (t.board === 'external' ? t.site : '');
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      {x?.files.length ? (
        x.files.map((f, i) =>
          i === 0 ? (
            <a key={f.id} href={f.url} download className={big}>
              <span className="text-left">
                <span className="block text-lg font-extrabold leading-tight">내려받기</span>
                <span className="block max-w-[18rem] truncate text-xs text-white/80">
                  {f.name} · {sizeLabel(f.size)}
                  {x.version && ` · v${x.version}`}
                </span>
              </span>
              <Download className="w-6 h-6 shrink-0" aria-hidden="true" />
            </a>
          ) : (
            <a key={f.id} href={f.url} download className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--nr-p3)] hover:underline">
              <Download className="w-4 h-4" aria-hidden="true" /> {f.name} <span className="font-normal text-slate-500">{sizeLabel(f.size)}</span>
            </a>
          ),
        )
      ) : link ? (
        <a href={link} target="_blank" rel="noreferrer" className={big}>
          <span className="text-left">
            <span className="block text-lg font-extrabold leading-tight">이 도구 사용하러 가기</span>
            <span className="block max-w-[18rem] truncate text-xs text-white/80">{link.replace(/^https?:\/\//, '')}</span>
          </span>
          <ArrowUpRight className="w-6 h-6 shrink-0" aria-hidden="true" />
          <span className="sr-only">(새 창)</span>
        </a>
      ) : x?.legacyUrl ? (
        <a href={x.legacyUrl} target="_blank" rel="noreferrer" className={big}>
          <span className="text-left">
            <span className="block text-lg font-extrabold leading-tight">원 게시글에서 받기</span>
            <span className="block text-xs text-white/80">이관 전 교육청 누리집 게시판 글</span>
          </span>
          <ArrowUpRight className="w-6 h-6 shrink-0" aria-hidden="true" />
          <span className="sr-only">(새 창)</span>
        </a>
      ) : (
        <p className="rounded-xl bg-[#f5f6f8] px-5 py-3 text-[14px] text-slate-500">올라온 파일 없음</p>
      )}
      {canEdit && (
        <a href={`/register?edit=${encodeURIComponent(t.sid)}`} className="inline-flex items-center gap-1 text-[14px] font-bold text-slate-600 hover:text-[var(--nr-p3)]">
          <Pencil className="w-4 h-4" aria-hidden="true" /> 글 수정
        </a>
      )}
    </div>
  );
};

/* ───────── 검수 정보 ───────── */

type Level = 'ok' | 'warn' | 'unknown';
const LEVEL_STYLE: Record<Level, string> = { ok: 'text-[#1f7a3a]', warn: 'text-[#8a5300]', unknown: 'text-slate-400' };
const Row: React.FC<{ label: string; level: Level; value: string }> = ({ label, level, value }) => (
  <li className="flex items-center justify-between gap-3 py-2">
    <span className="text-[14px] text-slate-600">{label}</span>
    <span className={`flex items-center gap-1 text-right text-[14px] font-bold ${LEVEL_STYLE[level]}`}>
      {level === 'unknown' ? <CircleDashed className="w-4 h-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />}
      {value}
    </span>
  </li>
);

/** 자가점검 답 → 표시. 0 개인정보 저장, 1 외부 전송, 2 무료 클라우드, 3 계정 요구 */
const ans = (x: ToolExtra | undefined, i: number, yes: string, no: string): [Level, string] => {
  const a = x?.answers?.[i];
  if (a === undefined || a === null) return ['unknown', '미확인(이관 글)'];
  return a ? ['warn', yes] : ['ok', no];
};

export const SrvTrustPanel: React.FC<{ t: ToolStat; s?: ToolSummary }> = ({ t, s }) => {
  const M = useManage();
  const x = extraOf(t.sid);
  const board = t.board ?? 'staff';
  const reviewed = !!x?.answers;
  const head =
    board === 'official'
      ? { tone: 'bg-[#e8f3ec] text-[#1f7a3a]', text: '교육청 배포 · 배포 전 검토', desc: t.origin ? `교직원 제작 도구(원작 ${t.origin})를 고도화해 배포` : '정책기획과가 만들어 배포한 도구' }
      : board === 'external'
        ? { tone: 'bg-[#eef6f3] text-[#0b6b52]', text: '외부 기관 도구 · 선정 안내', desc: '교육청 밖 공공기관 도구. 정책기획과가 선정해 안내' }
        : reviewed
          ? { tone: 'bg-[#e8f3ec] text-[#1f7a3a]', text: '보안 검토 후 게시', desc: `자가점검 ${x?.checks ?? 0}/6 통과 · 담당자 보안 검토 완료` }
          : { tone: 'bg-[#f1f3f6] text-slate-700', text: '이관 글 · 검수 기록 없음', desc: '예전 게시판에서 옮겨 온 글. 새 버전을 올리면 검토를 거침' };
  const install = s?.run ? (['설치 프로그램', '브라우저 확장'].includes(s.run) ? '필요' : '필요 없음') : '';
  const [pl, pv] = ans(x, 0, '저장함 (제작자 응답)', '저장 안 함 (제작자 응답)');
  const [tl, tv] = ans(x, 1, '있음 (제작자 응답)', '없음 (제작자 응답)');
  const ver = x?.version;
  return (
    <section className="rounded-[10px] border border-[var(--nr-line)] bg-white p-5">
      <h2 className="flex items-center gap-2 text-[18px] font-bold text-black">
        <ShieldCheck className="w-5 h-5 text-[var(--nr-p1)]" aria-hidden="true" /> 검수 정보
      </h2>
      <p className={`mt-3 rounded-lg px-3 py-2 text-[14px] font-bold ${head.tone}`}>
        {head.text}
        <span className="block text-[13px] font-normal opacity-90">{head.desc}</span>
      </p>
      <ul className="mt-2 divide-y divide-slate-100">
        <Row label="실행 방식" level={s?.run ? 'ok' : 'unknown'} value={s?.run ?? '미확인'} />
        <Row label="설치" level={install ? (install === '필요' ? 'warn' : 'ok') : 'unknown'} value={install || '미확인'} />
        <Row label="외부 전송" level={tl} value={tv} />
        <Row label="개인정보 저장" level={pl} value={pv} />
        <Row label="현재 버전" level={ver ? 'ok' : 'unknown'} value={ver ? `v${ver}` : '미표기'} />
        <Row label="문의 창구" level="ok" value={sourceOf(board).ask} />
        <Row label="글 수정 권한" level="ok" value={M.editors(t).join(', ')} />
      </ul>
    </section>
  );
};

/* ───────── 버전·업데이트 ───────── */

export const SrvVersionPanel: React.FC<{ t: ToolStat }> = ({ t }) => {
  const S = useSrv();
  const x = extraOf(t.sid);
  const on = S.mySubs.includes(t.sid);
  const canEdit = S.editable.includes(t.sid);
  const pending = S.updates.find((u) => u.sid === t.sid);
  const [open, setOpen] = useState(false);
  const versions = x?.versions ?? [];
  return (
    <section className="rounded-[10px] border border-[var(--nr-line)] bg-white p-5">
      <h2 className="flex items-center gap-2 text-[18px] font-bold text-black">
        <GitCommitVertical className="w-5 h-5 text-[var(--nr-p1)]" aria-hidden="true" /> 버전·업데이트
      </h2>
      <ol className="mt-4 border-l-2 border-[var(--nr-line)] pl-4 space-y-4">
        {pending && (
          <li className="relative">
            <span aria-hidden="true" className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-[#e0a800] bg-white ring-4 ring-white" />
            <p className="text-[15px] font-bold text-black">
              v{pending.version} <span className="ml-1 rounded bg-[#fff1d6] px-1.5 py-0.5 text-[11px] text-[#8a5300]">보안 검토 중</span>
            </p>
            <p className="text-[13px] text-slate-500">{pending.note}</p>
          </li>
        )}
        {versions.map((v, i) => (
          <li key={v.id} className="relative">
            <span aria-hidden="true" className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${v.kind === 'convert' ? 'bg-[#2f3a73]' : i === 0 ? 'bg-[var(--nr-p1)]' : 'bg-slate-300'}`} />
            <p className="text-[15px] font-bold text-black">
              {v.version ? `v${v.version}` : '처음 게시'}{' '}
              {v.kind === 'convert' ? (
                <span className="ml-1 rounded bg-[#2f3a73] px-1.5 py-0.5 text-[11px] text-white">교육청 배포 전환</span>
              ) : (
                i === 0 && <span className="ml-1 rounded bg-[var(--nr-bg)] px-1.5 py-0.5 text-[11px] text-[var(--nr-p3)]">현재</span>
              )}
            </p>
            <p className="text-[13px] text-slate-500">
              {dayLabel(v.at.slice(0, 10))} · {v.note}
            </p>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          aria-pressed={on}
          onClick={() => needLogin() && act('POST', `/api/tools/${encodeURIComponent(t.sid)}/subs`).catch((e) => notice(errMsg(e), 'err'))}
          className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[14px] font-bold ${
            on ? 'bg-[var(--nr-p2)] text-white' : 'border border-[var(--nr-line)] bg-white text-slate-800 hover:border-[var(--nr-p3)]'
          }`}
        >
          {on ? <BellRing className="w-4 h-4" aria-hidden="true" /> : <Bell className="w-4 h-4" aria-hidden="true" />}
          {on ? '업데이트 알림 받는 중' : '업데이트 알림 받기'}
        </button>
        {canEdit && !pending && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--nr-p1)] px-4 py-2.5 text-[14px] font-bold text-white hover:bg-[var(--nr-p3)]">
            <Upload className="w-4 h-4" aria-hidden="true" /> 새 버전 올리기
          </button>
        )}
        {canEdit && pending && (
          <button
            type="button"
            onClick={() => act('DELETE', `/api/versions/${pending.id}`).catch((e) => notice(errMsg(e), 'err'))}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2.5 text-[14px] font-bold text-slate-600"
          >
            <X className="w-4 h-4" aria-hidden="true" /> 검토 중인 새 버전 취소
          </button>
        )}
      </div>
      {open && <NewVersionForm t={t} onDone={() => setOpen(false)} />}
      {x && x.downloads > 0 && <p className="mt-2 text-[12px] text-slate-500">내려받기 {n(x.downloads)}회</p>}
    </section>
  );
};

/** 새 버전 — 버전·바뀐 내용·파일. 운영자는 바로 게시, 그 밖은 보안 검토 뒤 게시 */
const NewVersionForm: React.FC<{ t: ToolStat; onDone: () => void }> = ({ t, onDone }) => {
  const S = useSrv();
  const x = extraOf(t.sid);
  const [ver, setVer] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const needFile = x?.deliver !== 'url';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await api<{ versionId: number }>('POST', `/api/tools/${encodeURIComponent(t.sid)}/versions`, { version: ver.trim(), note: note.trim() });
      for (const f of files) await uploadFile(t.sid, r.versionId, f);
      const s = await api<{ live: boolean }>('POST', `/api/versions/${r.versionId}/submit`);
      await refreshState();
      reloadData();
      notice(s.live ? `v${ver} 게시됨` : `v${ver} 보안 검토 요청됨. 검토가 끝나면 게시됨`);
      onDone();
    } catch (err) {
      notice(errMsg(err), 'err');
      await refreshState();
    } finally {
      setBusy(false);
    }
  };
  const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px] focus:border-[var(--nr-p3)] focus:outline-none';
  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-[10px] bg-[var(--nr-bg)] p-4">
      <div className="flex items-center gap-2">
        <label htmlFor="nv-ver" className="shrink-0 text-[14px] font-bold text-slate-800">
          새 버전 v
        </label>
        <input id="nv-ver" value={ver} onChange={(e) => setVer(e.target.value)} maxLength={10} placeholder={x?.version ? `${x.version} 다음` : '1.1'} className={`${input} max-w-[8rem]`} />
      </div>
      <label htmlFor="nv-note" className="block text-[14px] font-bold text-slate-800">
        바뀐 내용
      </label>
      <input id="nv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="예: 학급 수 50개 이상도 처리, 인쇄 여백 수정" className={input} />
      {needFile && <FilePicker files={files} onChange={setFiles} />}
      <button type="submit" disabled={busy || !ver.trim() || !note.trim() || (needFile && !files.length)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--nr-p1)] px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-40">
        <Upload className="w-4 h-4" aria-hidden="true" /> {busy ? '올리는 중…' : S.me?.ops ? '바로 게시' : '보안 검토 요청'}
      </button>
      {!S.me?.ops && <p className="text-[12px] text-slate-500">보안 검토가 끝나기 전까지는 지금 버전이 계속 보임</p>}
    </form>
  );
};

/** 파일 고르기 — 끌어 놓기·눌러서 선택 */
export const FilePicker: React.FC<{ files: File[]; onChange: (f: File[]) => void; max?: number }> = ({ files, onChange, max = 5 }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    onChange(next.slice(0, max));
  };
  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={`w-full rounded-lg border-2 border-dashed px-4 py-5 text-center text-[14px] ${over ? 'border-[var(--nr-p1)] bg-[var(--nr-bg)]' : 'border-slate-300 bg-[#fafafa]'} text-slate-600`}
      >
        <FileUp className="mx-auto mb-1 w-6 h-6" aria-hidden="true" />
        파일을 끌어 놓거나 눌러서 선택 (최대 {max}개)
      </button>
      <input ref={ref} type="file" multiple className="sr-only" tabIndex={-1} onChange={(e) => (add(e.target.files), (e.target.value = ''))} aria-label="파일 선택" />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-1.5 text-[14px] ring-1 ring-[var(--nr-line)]">
              <span className="min-w-0 truncate">{f.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-slate-500">
                {sizeLabel(f.size)}
                <button type="button" aria-label={`${f.name} 빼기`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-[#d61e49]">
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ───────── 써봤어요·후기 ───────── */

export const SrvReactionPanel: React.FC<{ t: ToolStat }> = ({ t }) => {
  const S = useSrv();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const list = S.reviews.filter((r) => r.sid === t.sid);
  const didUse = S.myUsed.includes(t.sid);
  const usedN = S.usedCount[t.sid] ?? 0;
  const avg = list.length ? list.reduce((a, r) => a + r.stars, 0) / list.length : 0;
  const fail = (e: unknown) => notice(errMsg(e), 'err');

  return (
    <section className="mt-10">
      <h2 className="nr-title text-[22px] text-black">써 본 사람들</h2>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <div className="rounded-[10px] bg-[var(--nr-bg)] p-5 text-center">
          <p className="text-[13px] font-bold text-slate-600">써봤어요</p>
          <p className="nr-title mt-1 text-[34px] tabular-nums text-[var(--nr-p2)]">{n(usedN)}</p>
          <p className="text-[13px] text-slate-500">평점 {list.length ? `${avg.toFixed(1)} / 5 · 후기 ${list.length}개` : '없음'}</p>
          <button
            type="button"
            aria-pressed={didUse}
            onClick={() => needLogin() && act('POST', `/api/tools/${encodeURIComponent(t.sid)}/used`).catch(fail)}
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
              if (!stars || !text.trim() || !needLogin()) return;
              act('POST', `/api/tools/${encodeURIComponent(t.sid)}/reviews`, { stars, text: text.trim() })
                .then(() => {
                  setStars(0);
                  setText('');
                })
                .catch(fail);
            }}
          >
            <fieldset>
              <legend className="text-[14px] font-bold text-slate-800">짧은 후기 남기기</legend>
              <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="평점">
                {[1, 2, 3, 4, 5].map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={stars === k} aria-label={`${k}점`} onClick={() => setStars(k)} className="p-0.5">
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
                <button type="submit" disabled={!stars || !text.trim()} className="shrink-0 rounded-lg bg-[var(--nr-p1)] px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-40">
                  남기기
                </button>
              </div>
            </fieldset>
          </form>
          {list.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              {list.map((r) => (
                <li key={r.id} className="flex items-start gap-2 py-2.5 text-[14px]">
                  <span className="shrink-0 text-[#e0a800]" aria-label={`${r.stars}점`}>
                    {'★'.repeat(r.stars)}
                    <span className="text-slate-300">{'★'.repeat(5 - r.stars)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-slate-800">{r.text}</span>
                    <span className="ml-2 text-[12px] text-slate-400">
                      {r.at} · {r.writer}
                    </span>
                  </span>
                  {(r.mine || S.me?.ops) && (
                    <button type="button" aria-label="후기 지우기" onClick={() => act('DELETE', `/api/reviews/${r.id}`).catch(fail)} className="shrink-0 text-slate-400 hover:text-[#d61e49]">
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-slate-500">아직 후기가 없습니다. 써 본 경험을 남기면 동료가 도구를 고를 때 참고가 됨</p>
          )}
        </div>
      </div>
    </section>
  );
};

/* ───────── 질문과 답변 ───────── */

type SrvComment = Comment & { id?: number; uid?: string };

export const SrvQnA: React.FC<{ t: ToolStat; comments: Comment[] }> = ({ t, comments }) => {
  const S = useSrv();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const x = extraOf(t.sid);
  const legacyMore = t.comments - comments.length;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy || !needLogin()) return;
    setBusy(true);
    try {
      await act('POST', `/api/tools/${encodeURIComponent(t.sid)}/comments`, { content: text.trim() }, true);
      setText('');
    } catch (err) {
      notice(errMsg(err), 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-10">
      <h2 className="nr-title text-[22px] text-black">
        질문과 답변 <span className="jbe-count text-sm font-bold tabular-nums">댓글 {n(t.comments)}개</span>
      </h2>
      <Card className="mt-3">
        {comments.length ? (
          <ul className="divide-y divide-slate-100">
            {(comments as SrvComment[]).map((c) => (
              <li key={c.cid} className={`px-4 py-3 ${c.maker ? 'bg-slate-50' : ''}`}>
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  {c.maker && <CornerDownRight className="w-4 h-4 text-slate-400" aria-hidden="true" />}
                  <b className="text-slate-900">{c.writer}</b>
                  {c.maker && <Badge tone="green">제작자 답글</Badge>}
                  <span className="text-xs tabular-nums text-slate-500">{shortDay(c.date)}</span>
                  {c.id && ((S.me && c.uid === S.me.id) || S.me?.ops) && (
                    <button
                      type="button"
                      onClick={() => act('DELETE', `/api/comments/${c.id}`, undefined, true).catch((e) => notice(errMsg(e), 'err'))}
                      className="ml-auto inline-flex items-center gap-0.5 text-[12px] text-slate-400 hover:text-[#d61e49]"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> 지우기
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-line text-slate-700">{c.content || '(내용 없는 댓글)'}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-slate-500">아직 댓글이 없음. 사용하다 궁금한 점을 남기면 제작자가 답함</p>
        )}
        {legacyMore > 0 && x?.legacyUrl && (
          <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            이관 전 댓글 {n(legacyMore)}개는{' '}
            <a href={x.legacyUrl} target="_blank" rel="noreferrer" className="font-bold text-[var(--nr-p3)] underline underline-offset-2">
              원 게시글
            </a>
            에 있음
          </p>
        )}
        <form onSubmit={submit} className="flex flex-col gap-2 border-t border-slate-100 p-4 sm:flex-row">
          <label htmlFor="qa-text" className="sr-only">
            질문·댓글
          </label>
          <textarea
            id="qa-text"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder={S.me ? '궁금한 점이나 사용 후기를 남겨 주세요' : '로그인하면 질문을 남길 수 있음'}
            onFocus={() => !S.me && needLogin()}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-[15px] focus:border-[var(--nr-p3)] focus:outline-none"
          />
          <button type="submit" disabled={!text.trim() || busy} className="shrink-0 rounded-lg bg-[var(--nr-p1)] px-4 py-2 text-[14px] font-bold text-white disabled:opacity-40 sm:self-end">
            남기기
          </button>
        </form>
      </Card>
    </section>
  );
};
