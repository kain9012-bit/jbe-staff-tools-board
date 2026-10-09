import { useCallback, useEffect, useState } from 'react';
import type { Payload } from '../types';
import { buildModel, type Model } from './stats';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; model: Model };

/** 자료가 오기 전에는 빈 껍데기, 못 받으면 알리고 다시 시도 단추 */
export function useData() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/data', { headers: { Accept: 'application/json' } });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || body.error) throw new Error(body?.error || `HTTP ${res.status}`);
      setState({ status: 'ready', model: buildModel(body as Payload) });
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load };
}
