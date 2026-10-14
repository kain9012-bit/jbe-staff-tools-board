import { useEffect, useState } from 'react';
import { SERVER } from './edition';
import { navigate } from './route';
import type { Submission } from '../components/Poc';
import type { ReqComment, ToolRequest } from '../data/poc-requests';

/**
 * 서버판 — 서버에 저장되는 상태(로그인, 요청, 검수, 후기 등)와 쓰기 요청.
 * PoC(Vercel)에서는 쓰이지 않음.
 */

export interface Me {
  id: string;
  name: string;
  org: string;
  display: string;
  ops: boolean;
}

export interface SrvFile {
  id: number;
  name: string;
  size: number;
  mime: string;
  at: string;
  url: string;
}

export interface SrvVersion {
  id: number;
  version: string;
  note: string;
  at: string;
  kind: 'first' | 'update' | 'convert';
}

/** /api/data 의 도구별 추가 정보 */
export interface ToolExtra {
  version: string;
  deliver: 'file' | 'url' | 'board';
  link: string;
  legacyUrl: string;
  files: SrvFile[];
  versions: SrvVersion[];
  editors: string[];
  checks: number;
  answers: boolean[] | null;
  org: string;
  region: string;
  reqId: string;
  converted: { at: string; version: string } | null;
  downloads: number;
}

export interface SrvRequest extends ToolRequest {
  opsLinks: string[];
  comments: (ReqComment & { id: number; mine?: boolean })[];
}

export interface SrvSubmission extends Submission {
  status: 'pending' | 'published' | 'rejected' | 'hidden';
  author: string;
  mine?: boolean;
  answers?: boolean[] | null;
  summary?: { what?: string; why?: string; features?: string[]; steps?: string[]; run?: string };
  target?: string;
  deliver?: string;
  url?: string;
  files: SrvFile[];
}

export interface SrvUpdate {
  id: number;
  sid: string;
  title: string;
  board: 'staff' | 'official' | 'external';
  version: string;
  note: string;
  at: string;
  files: SrvFile[];
}

export interface SrvReview {
  id: number;
  sid: string;
  writer: string;
  stars: number;
  text: string;
  at: string;
  mine: boolean;
}

export interface SrvUpgrade {
  stage: number;
  notes: string[];
  startedAt: string;
  convertedAt?: string;
  version?: string;
  title?: string;
  maker?: string;
}

export interface SrvState {
  me: Me | null;
  login: { mode: string; loginUrl: string; logoutUrl: string };
  requests: SrvRequest[];
  submissions: SrvSubmission[];
  updates: SrvUpdate[];
  upgrades: Record<string, SrvUpgrade>;
  reviews: SrvReview[];
  usedCount: Record<string, number>;
  myUsed: string[];
  mySubs: string[];
  myLikes: string[];
  myMaking: string[];
  editable: string[];
}

const EMPTY: SrvState = {
  me: null,
  login: { mode: 'dev', loginUrl: '/login', logoutUrl: '' },
  requests: [],
  submissions: [],
  updates: [],
  upgrades: {},
  reviews: [],
  usedCount: {},
  myUsed: [],
  mySubs: [],
  myLikes: [],
  myMaking: [],
  editable: [],
};

let state: SrvState = EMPTY;
let loaded = false;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function refreshState() {
  if (!SERVER) return Promise.resolve();
  loading = fetch('/api/state', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
    .then((r) => r.json())
    .then((s: SrvState) => {
      state = s;
      loaded = true;
      emit();
    })
    .catch(() => {
      loaded = true;
      emit();
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** 서버 상태 — 처음 쓰는 화면에서 불러옴 */
export function useSrv(): SrvState & { ready: boolean } {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    if (SERVER && !loaded && !loading) void refreshState();
    return () => {
      subs.delete(f);
    };
  }, []);
  return { ...state, ready: loaded };
}

export const srvState = () => state;

/* ── /api/data 의 추가 정보 ── */
let extra: Record<string, ToolExtra> = {};
export const setExtra = (e: Record<string, ToolExtra> | undefined) => {
  extra = e ?? {};
};
export const extraOf = (sid: string): ToolExtra | undefined => extra[sid];

/** 도구 자료(/api/data)를 다시 읽게 함 — 화면은 그대로 두고 조용히 바꿈 */
export const RELOAD_EV = 'dt-reload';
export const reloadData = () => window.dispatchEvent(new Event(RELOAD_EV));

/* ── 쓰기 요청 ── */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown, opts: { raw?: Blob | File; type?: string } = {}): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: opts.raw ? { 'Content-Type': opts.type || 'application/octet-stream' } : body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: opts.raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) goLogin();
    throw new ApiError(res.status, (data as { error?: string }).error || `오류 ${res.status}`);
  }
  return data as T;
}

/** 쓰기 뒤 상태·자료 새로 읽기 */
export async function act<T = unknown>(method: string, path: string, body?: unknown, alsoData = false): Promise<T> {
  const r = await api<T>(method, path, body);
  await refreshState();
  if (alsoData) reloadData();
  return r;
}

/** 로그인 화면으로(통합인증이면 그 주소로) */
export function goLogin() {
  const next = window.location.pathname + window.location.search;
  const url = state.login.loginUrl || '/login';
  if (url.startsWith('/login')) navigate(`/login?next=${encodeURIComponent(next)}`);
  else window.location.href = `${url}${url.includes('?') ? '&' : '?'}next=${encodeURIComponent(next)}`;
}

/** 로그인해야 하는 단추에 — 로그인 안 했으면 로그인으로 보내고 false */
export function needLogin(): boolean {
  if (state.me) return true;
  goLogin();
  return false;
}

/** 파일 크기 표기 */
export const sizeLabel = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : n >= 1024 ? `${Math.round(n / 1024)}KB` : `${n}B`);

/** 파일 올리기 — 버전에 붙임 */
export async function uploadFile(sid: string, versionId: number, f: File) {
  return api<{ id: number; name: string; size: number }>('POST', `/api/tools/${encodeURIComponent(sid)}/files?version=${versionId}&name=${encodeURIComponent(f.name)}`, undefined, {
    raw: f,
    type: f.type || 'application/octet-stream',
  });
}

/** 화면 알림(짧은 안내 띠) */
export const NOTICE_EV = 'dt-notice';
export const notice = (msg: string, tone: 'ok' | 'err' = 'ok') => window.dispatchEvent(new CustomEvent(NOTICE_EV, { detail: { msg, tone } }));
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
