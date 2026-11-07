# 여러 방향 굽기: 정면(사진 결 그림) + 옆·뒤·사선(다시 그린 모습) → 한 장의 텍스처
import numpy as np, cv2, json, sys, trimesh
obj, front_img, out, TEX = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
P = json.load(open('fig_align.json'))['p']; META = json.load(open('vw_meta.json'))
V, VT, F = [], [], []
for ln in open(obj):
    p = ln.split()
    if not p: continue
    if p[0] == 'v': V.append([float(x) for x in p[1:4]])
    elif p[0] == 'vt': VT.append([float(x) for x in p[1:3]])
    elif p[0] == 'f': F.append([[int(i) - 1 if i else 0 for i in (q.split('/') + ['', ''])[:2]] for q in p[1:4]])
V, VT, F = np.array(V), np.array(VT), np.array(F)
VN = trimesh.Trimesh(V, F[:, :, 0], process=False).vertex_normals
def zbuf(pu, pv, depth, W, H):
    Z = np.full((H, W), 1e9, np.float32)
    for tri in F[:, :, 0]:
        xs, ys, zz = pu[tri], pv[tri], depth[tri]
        x0, x1 = int(max(0, xs.min())), int(min(W - 1, xs.max() + 1)); y0, y1 = int(max(0, ys.min())), int(min(H - 1, ys.max() + 1))
        if x1 < x0 or y1 < y0: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-9: continue
        l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        l2 = 1 - l0 - l1; ins = (l0 >= -0.01) & (l1 >= -0.01) & (l2 >= -0.01)
        z = l0 * zz[0] + l1 * zz[1] + l2 * zz[2]
        sub = Z[y0:y1 + 1, x0:x1 + 1]; np.minimum(sub, np.where(ins, z, 1e9), out=sub)
    return Z
views = []
# 정면
fi = cv2.imread(front_img, cv2.IMREAD_UNCHANGED).astype(np.float32) / 255; FH, FW = fi.shape[:2]; SCL = FW / 512.0
fa = cv2.erode((fi[..., 3] > 0.5).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(np.float32)
fproj = lambda Q: ((P[0] * Q[:, 0] + P[1]) * SCL, (-P[2] * Q[:, 2] + P[3]) * SCL)
hsvf = cv2.cvtColor(fi[..., :3], cv2.COLOR_BGR2HSV)
hairf = ((hsvf[..., 1] < 0.12) & (hsvf[..., 2] > 0.5)).astype(np.float32)
hairf[int(FH * 0.6):] = 0  # 아래쪽(셔츠 등) 제외
HAIRF = cv2.GaussianBlur(hairf, (0, 0), 2)
# 얼굴 안쪽 가림막(그림 특징점 기준) — 얼굴은 정면 사진 결을 그대로 씀
info = json.load(open('draw_info.json')); Lm = info['L']
chin = np.array(Lm['chin'], np.float32) * SCL; brow = np.array(Lm['left_eyebrow'] + Lm['right_eyebrow'], np.float32) * SCL
topb = brow.copy(); topb[:, 1] -= (chin[:, 1].max() - brow[:, 1].mean()) * 0.35
FACE = np.zeros((FH, FW), np.float32); cv2.fillPoly(FACE, [cv2.convexHull(np.vstack([chin, topb]).astype(np.int32))], 1.0)
FACE = cv2.GaussianBlur(cv2.erode(FACE, np.ones((9, 9), np.uint8)), (0, 0), 6 * SCL)
FW_ = np.zeros((TEX, TEX), np.float32); WFR = np.zeros((TEX, TEX), np.float32); FC = np.zeros((TEX, TEX, 3), np.float32)
pu, pv = fproj(V); views.append(dict(name='front', img=fi[..., :3], alpha=fa, proj=fproj, d=np.array([0, -1.0, 0]), Z=zbuf(pu, pv, V[:, 1], FW, FH), depth=lambda Q: Q[:, 1], boost=6.0, th=0.35))
for ang, m in META.items():
    img = cv2.imread(f'rp_{ang}.png').astype(np.float32) / 255
    al = cv2.imread(f'vw_{ang}.png', cv2.IMREAD_UNCHANGED)[..., 3]
    al = cv2.erode((al > 127).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32)
    d = np.array(m['d']); c = np.array(m['ctr']); W, H, sc = m['W'], m['H'], m['scale']
    right = np.cross(-d, [0, 0, 1.0]); right /= np.linalg.norm(right); ow = sc * W / H
    def proj(Q, d=d, c=c, right=right, ow=ow, sc=sc, W=W, H=H):
        R = Q - c; return ((R @ right) / ow + 0.5) * W, (0.5 - R[:, 2] / sc) * H
    dep = lambda Q, d=d: -(Q @ d)
    pu, pv = proj(V)
    views.append(dict(name=ang, img=img, alpha=al, proj=proj, d=d, Z=zbuf(pu, pv, dep(V), W, H), depth=dep, boost=1.0 if int(ang) in (90, 180, 270) else 0.6, th=0.25))
tol = 0.01 * np.ptp(V[:, 2])
PZ = np.full((TEX, TEX), -9.0, np.float32); acc = np.zeros((TEX, TEX, 3), np.float32); wsum = np.zeros((TEX, TEX), np.float32); have = np.zeros((TEX, TEX), bool)
for f in F:
    vi, ti = f[:, 0], f[:, 1]
    tu = VT[ti, 0] * TEX; tv = (1 - VT[ti, 1]) * TEX
    x0, x1 = int(max(0, tu.min() - 1)), int(min(TEX - 1, tu.max() + 1)); y0, y1 = int(max(0, tv.min() - 1)), int(min(TEX - 1, tv.max() + 1))
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    dd = (tv[1] - tv[2]) * (tu[0] - tu[2]) + (tu[2] - tu[1]) * (tv[0] - tv[2])
    if abs(dd) < 1e-12: continue
    l0 = ((tv[1] - tv[2]) * (gx - tu[2]) + (tu[2] - tu[1]) * (gy - tv[2])) / dd
    l1 = ((tv[2] - tv[0]) * (gx - tu[2]) + (tu[0] - tu[2]) * (gy - tv[2])) / dd
    l2 = 1 - l0 - l1; ins = (l0 >= -0.03) & (l1 >= -0.03) & (l2 >= -0.03)
    if not ins.any(): continue
    Lb = np.stack([l0[ins], l1[ins], l2[ins]], 1)
    Q = Lb @ V[vi]; N = Lb @ VN[vi]; N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    yy, xx = gy[ins].astype(int), gx[ins].astype(int); have[yy, xx] = True; PZ[yy, xx] = Q[:, 2]
    for vw in views:
        u, v = vw['proj'](Q); H_, W_ = vw['Z'].shape
        ui = np.clip(u.astype(int), 0, W_ - 1); vv = np.clip(v.astype(int), 0, H_ - 1)
        vis = (vw['depth'](Q) <= vw['Z'][vv, ui] + tol) * vw['alpha'][vv, ui]
        w = np.clip(((N @ vw['d']) * (-1 if vw['name'] == 'front' else 1) - vw['th']) / 0.35, 0, 1) ** 2 * vis * vw['boost']
        if vw['name'] == 'front':
            hf = HAIRF[vv, ui]; th = vw['th'] * (1 - hf) + 0.42 * hf  # 머리카락은 정면을 많이 볼 때만 그림 색
            w = np.clip(((-N[:, 1]) - th) / 0.3, 0, 1) ** 2 * vis * vw['boost']
        else: w = np.clip(((N @ (-vw['d'] * -1)) - vw['th']) / 0.35, 0, 1) ** 4 * vis * vw['boost']
        if not w.any(): continue
        acc[yy, xx] += vw['img'][vv, ui] * w[:, None]; wsum[yy, xx] += w
        if vw['name'] == 'front':
            fw = FACE[vv, ui] * np.clip((-N[:, 1] - 0.15) / 0.3, 0, 1) * vis
            FW_[yy, xx] = fw; FC[yy, xx] = vw['img'][vv, ui]; WFR[yy, xx] = np.clip(w / vw['boost'], 0, 1)
base = cv2.imread('tex40.png').astype(np.float32) / 255
if base.shape[0] != TEX: base = cv2.resize(base, (TEX, TEX))
res = np.where(wsum[..., None] > 1e-4, acc / np.maximum(wsum, 1e-4)[..., None], base)
k = np.clip(wsum / 0.15, 0, 1)[..., None]; res = res * k + base * (1 - k)
res = res * (1 - FW_[..., None]) + FC * FW_[..., None]
# 머리카락(턱 위, 채도 낮고 밝은 칸)은 조금 어둡게 — 광장 조명에서 하얗게 뜨지 않게
zc = (P[3] - 442) / P[2]
hsv = cv2.cvtColor(res.astype(np.float32), cv2.COLOR_BGR2HSV)
hm = (PZ > zc + 0.03) & (hsv[..., 1] < 0.14) & (hsv[..., 2] > 0.45)
hm = (cv2.GaussianBlur(hm.astype(np.float32), (0, 0), 1.0) * (1 - WFR))[..., None]
res = res * (1 - 0.14 * hm)
img = (np.clip(res, 0, 1) * 255).astype(np.uint8)
img = cv2.inpaint(img, (~have).astype(np.uint8), 3, cv2.INPAINT_TELEA)
cv2.imwrite(out, img); print('done')
