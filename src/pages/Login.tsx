import React, { useState } from 'react';
import { KeyRound, LogIn } from 'lucide-react';
import { PageTitle } from '../components/Shell';
import { api, errMsg, refreshState, reloadData, useSrv } from '../lib/server';
import { navigate } from '../lib/route';

/**
 * 로그인(서버판) — 소속·이름 입력.
 * 통합인증을 붙이면(AUTH_MODE=header|custom) 이 화면 대신 통합인증 화면으로 감.
 */
export const Login: React.FC<{ next?: string }> = ({ next }) => {
  const S = useSrv();
  const [org, setOrg] = useState('');
  const [name, setName] = useState('');
  const [opsOpen, setOpsOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const back = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (S.ready && S.login.mode !== 'dev') {
    return (
      <>
        <PageTitle>로그인</PageTitle>
        <p className="mt-6 text-[15px] text-slate-700">
          {S.login.loginUrl ? (
            <a href={`${S.login.loginUrl}${S.login.loginUrl.includes('?') ? '&' : '?'}next=${encodeURIComponent(back)}`} className="font-bold text-[var(--nr-p3)] underline">
              통합인증으로 로그인
            </a>
          ) : (
            '통합인증으로 로그인한 상태에서 이용해 주세요.'
          )}
        </p>
      </>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await api('POST', '/api/login', { org: org.trim(), name: name.trim(), opsPassword: opsOpen ? pw : undefined });
      await refreshState();
      reloadData();
      navigate(back, true);
    } catch (e2) {
      setErr(errMsg(e2));
    } finally {
      setBusy(false);
    }
  };
  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] focus:border-[var(--nr-p3)] focus:outline-none';

  return (
    <>
      <PageTitle desc="보기·내려받기는 로그인 없이 됩니다. 도구 등록·댓글·후기·요청처럼 글을 남길 때만 로그인합니다.">로그인</PageTitle>
      {S.me && (
        <p className="mt-6 rounded-[10px] bg-[var(--nr-bg)] px-4 py-3 text-[15px] text-slate-700">
          지금 <b>{S.me.display}</b>(으)로 로그인되어 있습니다.
        </p>
      )}
      <form onSubmit={submit} className="mx-auto mt-8 max-w-md space-y-4 rounded-[14px] border border-[var(--nr-line)] bg-white p-6">
        <div>
          <label htmlFor="lg-org" className="text-[14px] font-bold text-slate-800">
            소속
          </label>
          <input id="lg-org" value={org} onChange={(e) => setOrg(e.target.value)} maxLength={40} required autoComplete="organization" placeholder="예: ○○초등학교" className={input} />
        </div>
        <div>
          <label htmlFor="lg-name" className="text-[14px] font-bold text-slate-800">
            이름
          </label>
          <input id="lg-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required autoComplete="name" className={input} />
        </div>
        <label className="flex items-center gap-1.5 text-[13px] text-slate-600">
          <input type="checkbox" checked={opsOpen} onChange={(e) => setOpsOpen(e.target.checked)} className="accent-[var(--nr-p3)]" />
          운영 부서(정책기획과 빅데이터담당)로 로그인
        </label>
        {opsOpen && (
          <div>
            <label htmlFor="lg-pw" className="flex items-center gap-1 text-[14px] font-bold text-slate-800">
              <KeyRound className="w-4 h-4" aria-hidden="true" /> 운영자 암호
            </label>
            <input id="lg-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" className={input} />
          </div>
        )}
        {err && <p className="text-[14px] font-bold text-[#b0123a]">{err}</p>}
        <button type="submit" disabled={busy || !org.trim() || !name.trim()} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--nr-p1)] px-5 py-3 text-[15px] font-bold text-white disabled:opacity-40">
          <LogIn className="w-4 h-4" aria-hidden="true" /> 로그인
        </button>
      </form>
    </>
  );
};
