/**
 * 3D 광장 — 길찾기(클릭한 곳까지 장애물을 돌아서)
 * 바닥을 CELL m 칸으로 보고 A*로 찾은 뒤, 곧게 갈 수 있는 구간은 펴서 모퉁이만 남김.
 * 막혔는지는 엔진의 부딪힘 검사(blocked)를 그대로 씀 — 자료를 따로 만들지 않음.
 * 클릭한 사람 브라우저에서 클릭 때 한 번만 계산(접속 인원과 무관).
 */
export type Blocked = (x: number, z: number) => boolean;
export interface PathResult {
  /** 지나갈 점들(마지막 = 실제 도착점) */
  pts: [number, number][];
  /** 클릭한 곳까지 못 가고 가장 가까운 곳에서 멈추는가 */
  partial: boolean;
}


const MAX_NODES = 40000; // 찾는 칸 수 상한
const MAX_MS = 90; // 계산 시간 상한 — 넘으면 그때까지 찾은 가장 가까운 곳으로
const W = 1.35; // 목표 쪽으로 서두르는 정도(1보다 크면 덜 살피고 빨리 찾음 — 길은 펴기로 다듬음)
const D1 = 1, D2 = Math.SQRT2;
const DIRS: [number, number, number][] = [
  [1, 0, D1], [-1, 0, D1], [0, 1, D1], [0, -1, D1],
  [1, 1, D2], [1, -1, D2], [-1, 1, D2], [-1, -1, D2],
];

/** 작은 우선순위 큐(이진 힙) */
class Heap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop()!, lv = v.pop()!;
    const n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i, mk = lk;
        if (l < n && k[l] < mk) (m = l), (mk = k[l]);
        if (r < n && k[r] < mk) m = r;
        if (m === i) break;
        k[i] = k[m];
        v[i] = v[m];
        i = m;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
}

/** 두 점 사이를 곧게 걸을 수 있나(0.4m 간격으로 확인) */
export function clearLine(blocked: Blocked, ax: number, az: number, bx: number, bz: number) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / 0.4));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (blocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

export function findPath(blocked: Blocked, sx: number, sz: number, gx: number, gz: number): PathResult | null {
  // 곧게 갈 수 있으면 그대로
  if (!blocked(gx, gz) && clearLine(blocked, sx, sz, gx, gz)) return { pts: [[gx, gz]], partial: false };
  // 칸 크기: 가까우면 촘촘히(좁은 틈도 지나감), 멀면 성기게(빨리 찾음)
  const far = Math.hypot(gx - sx, gz - sz);
  const CELL = far < 60 ? 1.2 : far < 160 ? 1.6 : 2.2;
  const ci = (x: number) => Math.round(x / CELL);
  const key = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);
  const memo = new Map<number, boolean>();
  const isBlocked = (i: number, j: number) => {
    const k = key(i, j);
    let b = memo.get(k);
    if (b === undefined) memo.set(k, (b = blocked(i * CELL, j * CELL)));
    return b;
  };
  let si = ci(sx), sj = ci(sz);
  // 출발 칸이 막혀 있으면(벽에 붙어 선 경우) 가장 가까운 빈 칸에서 시작
  if (isBlocked(si, sj)) {
    const near = nearestFree(isBlocked, si, sj, 3);
    if (!near) return null;
    [si, sj] = near;
  }
  // 도착 칸이 막혀 있으면(건물·물 안을 찍음) 그 둘레의 빈 칸으로
  let gi = ci(gx), gj = ci(gz);
  let goalMoved = false;
  if (isBlocked(gi, gj)) {
    const near = nearestFree(isBlocked, gi, gj, 14, si, sj);
    if (!near) return null;
    [gi, gj] = near;
    goalMoved = true;
  }
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - gi), dy = Math.abs(j - gj);
    return (dx + dy) * D1 + (D2 - 2 * D1) * Math.min(dx, dy);
  };
  const g = new Map<number, number>();
  const from = new Map<number, number>();
  const closed = new Set<number>();
  const open = new Heap();
  const sk = key(si, sj), gk = key(gi, gj);
  g.set(sk, 0);
  open.push(h(si, sj), sk);
  let best = sk, bestH = h(si, sj);
  let found = false;
  let n = 0;
  const t0 = performance.now();
  while (open.size && n < MAX_NODES) {
    if ((n & 1023) === 0 && n && performance.now() - t0 > MAX_MS) break;
    const cur = open.pop();
    if (closed.has(cur)) continue;
    closed.add(cur);
    n++;
    if (cur === gk) {
      found = true;
      break;
    }
    const i = Math.floor(cur / 65536) - 32768, j = (cur % 65536) - 32768;
    const hc = h(i, j);
    if (hc < bestH) (bestH = hc), (best = cur);
    const gc = g.get(cur)!;
    for (const [di, dj, cost] of DIRS) {
      const ni = i + di, nj = j + dj;
      if (isBlocked(ni, nj)) continue;
      // 대각선은 양옆 칸이 둘 다 비어야(모서리 긁고 지나가지 않게)
      if (di && dj && (isBlocked(i + di, j) || isBlocked(i, j + dj))) continue;
      const nk = key(ni, nj);
      if (closed.has(nk)) continue;
      const ng = gc + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        from.set(nk, cur);
        open.push(ng + h(ni, nj) * W, nk);
      }
    }
  }
  const end = found ? gk : best;
  if (end === sk && !found) return null;
  // 칸 길 → 점 목록
  const cells: [number, number][] = [];
  for (let c: number | undefined = end; c !== undefined; c = from.get(c)) {
    cells.push([(Math.floor(c / 65536) - 32768) * CELL, ((c % 65536) - 32768) * CELL]);
    if (c === sk) break;
  }
  cells.reverse();
  // 마지막 점: 클릭한 곳(갈 수 있으면 정확히 그 자리)
  const last: [number, number] = found && !goalMoved ? [gx, gz] : cells[cells.length - 1];
  cells[cells.length - 1] = last;
  cells[0] = [sx, sz];
  // 펴기: 지금 점에서 곧게 닿는 가장 먼 점으로
  const out: [number, number][] = [];
  let a = 0;
  while (a < cells.length - 1) {
    let b = cells.length - 1;
    while (b > a + 1 && !clearLine(blocked, cells[a][0], cells[a][1], cells[b][0], cells[b][1])) b--;
    out.push(cells[b]);
    a = b;
  }
  return { pts: out, partial: !found || goalMoved };
}

/** (ci, cj) 둘레에서 가장 가까운 빈 칸 — 기준점(si, sj)이 있으면 그쪽에 가까운 것 우선 */
function nearestFree(isBlocked: (i: number, j: number) => boolean, ci: number, cj: number, R: number, si?: number, sj?: number): [number, number] | null {
  for (let r = 1; r <= R; r++) {
    let best: [number, number] | null = null, bd = Infinity;
    for (let i = ci - r; i <= ci + r; i++)
      for (let j = cj - r; j <= cj + r; j++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r || isBlocked(i, j)) continue;
        const d = si === undefined ? Math.hypot(i - ci, j - cj) : Math.hypot(i - ci, j - cj) * 4 + Math.hypot(i - si, j - sj!);
        if (d < bd) (bd = d), (best = [i, j]);
      }
    if (best) return best;
  }
  return null;
}
