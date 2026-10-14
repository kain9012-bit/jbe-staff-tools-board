import { useCallback, useEffect, useState } from 'react';
import type { Payload } from '../types';
import { buildModel, type Model } from './stats';
import { SERVER } from './edition';
import { RELOAD_EV, setExtra, type ToolExtra } from './server';
import { setServerSummaries, setSheetInfo, type SheetInfo, type ToolSummary } from './summaries';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; model: Model };

type SrvPayload = Payload & { summaries?: Record<string, ToolSummary>; extra?: Record<string, ToolExtra> };

/** 자료가 오기 전에는 빈 껍데기, 못 받으면 알리고 다시 시도 단추 */
export function useData() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const load = useCallback(async (silent = false) => {
    if (!silent) setState({ status: 'loading' });
    try {
      const res = await fetch('/api/data', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      const body = (await res.json().catch(() => null)) as SrvPayload | null;
      if (!res.ok || !body || (body as { error?: string }).error) throw new Error((body as { error?: string } | null)?.error || `HTTP ${res.status}`);
      if (SERVER) {
        setServerSummaries(body.summaries);
        setExtra(body.extra);
      } else {
        // 웹판 — 시트 「도구정보」 탭의 분류·한 줄 소개·실행 방식을 반영
        setSheetInfo((body as { info?: Record<string, SheetInfo> }).info);
      }
      setState({ status: 'ready', model: buildModel(body) });
    } catch (e) {
      if (!silent) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);
  useEffect(() => {
    void load();
    if (!SERVER) return;
    // 서버판 — 글을 쓰거나 고친 뒤 화면을 비우지 않고 새 자료로 바꿈
    const on = () => void load(true);
    window.addEventListener(RELOAD_EV, on);
    return () => window.removeEventListener(RELOAD_EV, on);
  }, [load]);
  return { state, reload: () => load() };
}
