import { useMemo } from 'react';
import { usePocState, type Submission } from '../components/Poc';
import { SAMPLE_REQUESTS, type ReqComment, type ReqStatus, type ToolRequest } from '../data/poc-requests';
import { allTools, type Model, type ToolStat } from './stats';
import { SERVER } from './edition';
import { act, errMsg, needLogin, notice, useSrv } from './server';

/**
 * 도구 요청 — 예시 요청 + 이 브라우저에서 남긴 요청·의견·손들기·연결을 합쳐 보여 줌.
 * 요청과 도구는 세 경로로 이어짐
 *  ① 요청 화면 '제가 해결해볼게요' → 등록 양식에 요청이 미리 연결됨
 *  ② 등록 양식에서 직접 요청 고르기
 *  ③ 운영자가 나중에 연결
 */
export interface RequestView extends ToolRequest {
  status: ReqStatus;
  tools: ToolStat[]; // 게시된 연결 도구
  pending: Submission[]; // 연결된 등록 신청(검수 중)
  makers: string[];
  allComments: ReqComment[];
}

export function useRequests(m?: Model) {
  return SERVER ? useRequestsServer(m) : useRequestsPoc(m);
}

/** 서버판 — 요청·공감·손들기·의견·연결을 서버에 저장. 화면은 PoC와 같은 함수를 부름 */
function useRequestsServer(m?: Model) {
  const S = useSrv();
  const byId = useMemo(() => new Map((m ? allTools(m) : []).map((t) => [t.sid, t])), [m]);
  const list: RequestView[] = S.requests.map((r) => {
    const tools = (r.sids ?? []).map((s) => byId.get(s)).filter((t): t is ToolStat => Boolean(t));
    const pending = S.submissions.filter((s) => s.reqId === r.id && s.status === 'pending');
    const makers = r.making ?? [];
    const status: ReqStatus = tools.length ? '해결' : makers.length || pending.length ? '만드는 중' : '의견 모으는 중';
    return { ...r, status, tools, pending, makers, allComments: r.comments ?? [] };
  });
  const run = (method: string, path: string, body?: unknown, data = false) => {
    if (!needLogin()) return;
    void act(method, path, body, data).catch((e) => notice(errMsg(e), 'err'));
  };
  const enc = encodeURIComponent;
  return {
    list,
    get: (id: string) => list.find((r) => r.id === id),
    liked: S.myLikes,
    toggleLike: (id: string) => run('POST', `/api/requests/${enc(id)}/like`),
    addRequest: async (r: ToolRequest): Promise<string | undefined> => {
      if (!needLogin()) return undefined;
      try {
        const x = await act<{ id: string }>('POST', '/api/requests', { title: r.title, detail: r.detail, field: r.field });
        return x.id;
      } catch (e) {
        notice(errMsg(e), 'err');
        return undefined;
      }
    },
    toggleMaking: (id: string) => run('POST', `/api/requests/${enc(id)}/making`),
    isMaking: (id: string) => S.myMaking.includes(id),
    addComment: (id: string, c: ReqComment) => run('POST', `/api/requests/${enc(id)}/comments`, { text: c.text }),
    link: (id: string, sid: string) => run('POST', `/api/requests/${enc(id)}/links`, { sid, on: true }),
    unlink: (id: string, sid: string) => run('POST', `/api/requests/${enc(id)}/links`, { sid, on: false }),
    linkedByOps: (id: string) => S.requests.find((r) => r.id === id)?.opsLinks ?? [],
  };
}

function useRequestsPoc(m?: Model) {
  const [mine, setMine] = usePocState<ToolRequest[]>('requests', []);
  const [liked, setLiked] = usePocState<string[]>('liked', []);
  const [links, setLinks] = usePocState<Record<string, string[]>>('reqLinks', {});
  const [making, setMaking] = usePocState<string[]>('reqMaking', []);
  const [comments, setComments] = usePocState<Record<string, ReqComment[]>>('reqComments', {});
  const [subs] = usePocState<Submission[]>('submissions', []);

  const byId = useMemo(() => new Map((m ? allTools(m) : []).map((t) => [t.sid, t])), [m]);
  const list: RequestView[] = [...mine, ...SAMPLE_REQUESTS].map((r) => {
    const sids = [...new Set([...(r.sids ?? []), ...(links[r.id] ?? [])])];
    const tools = sids.map((s) => byId.get(s)).filter((t): t is ToolStat => Boolean(t));
    const pending = subs.filter((s) => s.reqId === r.id);
    const makers = [...(r.making ?? []), ...(making.includes(r.id) ? ['나'] : [])];
    const status: ReqStatus = tools.length || pending.some((p) => p.stage >= 3) ? '해결' : makers.length || pending.length ? '만드는 중' : '의견 모으는 중';
    return {
      ...r,
      likes: r.likes + (liked.includes(r.id) ? 1 : 0),
      status,
      tools,
      pending,
      makers,
      allComments: [...(r.comments ?? []), ...(comments[r.id] ?? [])],
    };
  });

  return {
    list,
    get: (id: string) => list.find((r) => r.id === id),
    liked,
    toggleLike: (id: string) => setLiked((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id])),
    addRequest: (r: ToolRequest) => setMine((v) => [r, ...v]),
    toggleMaking: (id: string) => setMaking((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id])),
    isMaking: (id: string) => making.includes(id),
    addComment: (id: string, c: ReqComment) => setComments((v) => ({ ...v, [id]: [...(v[id] ?? []), c] })),
    link: (id: string, sid: string) => setLinks((v) => ({ ...v, [id]: [...new Set([...(v[id] ?? []), sid])] })),
    unlink: (id: string, sid: string) => setLinks((v) => ({ ...v, [id]: (v[id] ?? []).filter((x) => x !== sid) })),
    linkedByOps: (id: string) => links[id] ?? [],
  };
}
