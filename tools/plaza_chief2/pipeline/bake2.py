# ⑤ 색 입히기: 정면 그림을 몸 전체에 — 보이는 면은 그림 색, 안 보이는 면(뒤·옆)은 가장 가까운 보이는 면의 색
import numpy as np, cv2, json, sys
from scipy.spatial import cKDTree
obj, img_path, out, TEX = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 2048
P = json.load(open('fig_align.json'))['p']
V, VT, VN, F = [], [], [], []
for ln in open(obj):
    p = ln.split()
    if not p: continue
    if p[0] == 'v': V.append([float(x) for x in p[1:4]])
    elif p[0] == 'vt': VT.append([float(x) for x in p[1:3]])
    elif p[0] == 'vn': VN.append([float(x) for x in p[1:4]])
    elif p[0] == 'f': F.append([[int(i) - 1 if i else 0 for i in (q.split('/') + ['', ''])[:3]] for q in p[1:4]])
V, VT, VN, F = map(np.array, (V, VT, VN, F))
if len(VN) == 0:
    import trimesh
    VN = trimesh.Trimesh(V, F[:, :, 0], process=False).vertex_normals.copy(); F[:, :, 2] = F[:, :, 0]
dr = cv2.imread(img_path, cv2.IMREAD_UNCHANGED).astype(np.float32) / 255; H, W = dr.shape[:2]
col = dr[..., :3]; alpha = dr[..., 3] if dr.shape[2] == 4 else np.ones((H, W), np.float32)
alpha = cv2.erode((alpha > 0.5).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
UP = 2; colB = cv2.resize(col, (W * UP, H * UP), interpolation=cv2.INTER_CUBIC); alB = cv2.resize(alpha, (W * UP, H * UP))
SCL = W / 512.0
proj = lambda Q: ((P[0] * Q[:, 0] + P[1]) * SCL, (-P[2] * Q[:, 2] + P[3]) * SCL)
# 앞에서 본 깊이
ZB = np.full((H, W), 1e9, np.float32)  # 그림 해상도 기준
pu, pv = proj(V)
for tri in F[:, :, 0]:
    xs_, ys_ = pu[tri], pv[tri]; zz = V[tri, 1]
    x0, x1 = int(max(0, xs_.min())), int(min(W - 1, xs_.max() + 1)); y0, y1 = int(max(0, ys_.min())), int(min(H - 1, ys_.max() + 1))
    if x1 < x0 or y1 < y0: continue
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    d = (ys_[1] - ys_[2]) * (xs_[0] - xs_[2]) + (xs_[2] - xs_[1]) * (ys_[0] - ys_[2])
    if abs(d) < 1e-9: continue
    l0 = ((ys_[1] - ys_[2]) * (gx - xs_[2]) + (xs_[2] - xs_[1]) * (gy - ys_[2])) / d
    l1 = ((ys_[2] - ys_[0]) * (gx - xs_[2]) + (xs_[0] - xs_[2]) * (gy - ys_[2])) / d
    l2 = 1 - l0 - l1; ins = (l0 >= -0.01) & (l1 >= -0.01) & (l2 >= -0.01)
    z = l0 * zz[0] + l1 * zz[1] + l2 * zz[2]
    sub = ZB[y0:y1 + 1, x0:x1 + 1]; np.minimum(sub, np.where(ins, z, 1e9), out=sub)
tol = 0.012 * np.ptp(V[:, 2])
out_c = np.zeros((TEX, TEX, 3), np.float32); have = np.zeros((TEX, TEX), bool); wgt = np.zeros((TEX, TEX), np.float32)
pos = np.zeros((TEX, TEX, 3), np.float32); VI = np.zeros((TEX, TEX, 3), np.int32); LB = np.zeros((TEX, TEX, 3), np.float32)
for f in F:
    vi, ti, ni = f[:, 0], f[:, 1], f[:, 2]
    tu = VT[ti, 0] * TEX; tv = (1 - VT[ti, 1]) * TEX
    x0, x1 = int(max(0, tu.min() - 1)), int(min(TEX - 1, tu.max() + 1)); y0, y1 = int(max(0, tv.min() - 1)), int(min(TEX - 1, tv.max() + 1))
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    d = (tv[1] - tv[2]) * (tu[0] - tu[2]) + (tu[2] - tu[1]) * (tv[0] - tv[2])
    if abs(d) < 1e-12: continue
    l0 = ((tv[1] - tv[2]) * (gx - tu[2]) + (tu[2] - tu[1]) * (gy - tv[2])) / d
    l1 = ((tv[2] - tv[0]) * (gx - tu[2]) + (tu[0] - tu[2]) * (gy - tv[2])) / d
    l2 = 1 - l0 - l1; ins = (l0 >= -0.03) & (l1 >= -0.03) & (l2 >= -0.03)
    if not ins.any(): continue
    Lb = np.stack([l0[ins], l1[ins], l2[ins]], 1)
    Q = Lb @ V[vi]; N = Lb @ VN[ni]; N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    u, v = proj(Q)
    ui = np.clip((u * UP).astype(int), 0, W * UP - 1); vv = np.clip((v * UP).astype(int), 0, H * UP - 1)
    zi = ZB[np.clip(v.astype(int), 0, H - 1), np.clip(u.astype(int), 0, W - 1)]
    vis = (Q[:, 1] <= zi + tol) & (alB[vv, ui] > 0.5)
    w = np.clip((-N[:, 1] - 0.2) / 0.35, 0, 1) * vis
    yy, xx = gy[ins].astype(int), gx[ins].astype(int)
    out_c[yy, xx] = colB[vv, ui]; wgt[yy, xx] = w; have[yy, xx] = True; pos[yy, xx] = Q; VI[yy, xx] = vi; LB[yy, xx] = Lb
# 안 보이는 칸(뒤·옆): 머리는 그림 위쪽 머리카락 결을, 몸은 같은 높이 윤곽 안쪽(옷 가장자리) 색을
info = json.load(open('draw_info.json')); R = {int(k): v for k, v in info['rows'].items()}; top, chin = info['top'], info['chin']
col512 = cv2.resize(col, (512, 768), interpolation=cv2.INTER_AREA); proj512 = lambda Q: (P[0] * Q[:, 0] + P[1], -P[2] * Q[:, 2] + P[3])
def back_color(Q):
    u, v = proj512(Q); u = np.clip(u, 0, 511); v = np.clip(v, 0, 767); outc = np.zeros((len(Q), 3), np.float32)
    head = v < chin - 5
    vh = (top + 6 + (v[head] - top) * 0.28).astype(int)
    hc = col512[np.clip(vh, 0, 767), u[head].astype(int)]
    hair_med = np.median(col512[top + 8:top + 40, 204:308].reshape(-1, 3), 0)
    skin = (hc[:, 2] > hc[:, 0] + 0.06)  # BGR: 빨강 > 파랑이면 피부
    hc[skin] = hair_med
    # 귀 아래 옆얼굴(앞쪽 절반)은 피부색
    eye_v = np.mean([p[1] for p in info['L']['left_eye'] + info['L']['right_eye']])
    hv = V[(proj512(V)[1] < chin) & (proj512(V)[1] > top)]; yc = np.median(hv[:, 1])
    sk = np.median(col512[int(eye_v) + 30:int(eye_v) + 50, 215:297].reshape(-1, 3), 0)
    side = (v[head] > eye_v + 25) & (Q[head][:, 1] < yc)
    hc[side] = sk
    outc[head] = hc
    bi = np.where(~head)[0]
    for i in bi:
        y = int(v[i]); runs = R.get(y) or R.get(y - 1) or R.get(y + 1)
        if not runs: outc[i] = col512[y, int(u[i])]; continue
        a_, b_ = min(runs, key=lambda r: 0 if r[0] <= u[i] <= r[1] else min(abs(u[i] - r[0]), abs(u[i] - r[1])))
        k = max(1, min(5, (b_ - a_) // 4))
        outc[i] = (col512[y, a_ + k:a_ + 2 * k + 1].mean(0) + col512[y, max(a_, b_ - 2 * k):b_ - k + 1].mean(0)) / 2
    return outc
src = have & (wgt > 0.5); dst = have & ~src
blend = out_c.copy()
# 정점마다 뒤쪽 색을 정하고 이웃끼리 부드럽게 → 칸마다 보간(줄무늬 없앰)
Cv = back_color(V)
from collections import defaultdict
nb = defaultdict(set)
for t3 in F[:, :, 0]:
    for i in range(3): nb[t3[i]].update(t3)
nbl = [np.array(sorted(nb[i])) for i in range(len(V))]
for _ in range(8): Cv = np.array([Cv[n].mean(0) for n in nbl])
w_ = wgt[have]; bc = (LB[have][..., None] * Cv[VI[have]]).sum(1)
ww = np.clip(w_ / 0.5, 0, 1)[:, None]
blend[have] = out_c[have] * ww + bc * (1 - ww)
img = (np.clip(blend, 0, 1) * 255).astype(np.uint8)
img = cv2.inpaint(img, (~have).astype(np.uint8), 3, cv2.INPAINT_TELEA)
cv2.imwrite(out, img); cv2.imwrite(out.replace('.png', '_w.png'), (wgt * 255).astype(np.uint8))
print('done', V.shape, F.shape)
