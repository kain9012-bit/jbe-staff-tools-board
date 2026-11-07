# ④ 깎기: 앞모습 윤곽을 그림 윤곽에 맞추고(정렬), 윤곽선 따라 깎기(RBF 변형) + 코끝 자리 맞추기
import numpy as np, cv2, trimesh, json
from scipy.optimize import minimize
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree
m = trimesh.load('fig.glb', force='mesh')
V = m.vertices.copy(); V = np.stack([V[:, 0], -V[:, 2], V[:, 1]], 1)  # glTF(y위,z앞) → 블렌더(z위, -y앞)
m = trimesh.Trimesh(V, m.faces, process=True)
parts = m.split(only_watertight=False); m = max(parts, key=lambda p: len(p.faces))
trimesh.repair.fix_normals(m)
V = m.vertices; F = m.faces
dr = cv2.imread('drawing_rgba.png', cv2.IMREAD_UNCHANGED); A = (dr[..., 3] > 127).astype(np.uint8); H, W = A.shape
def sil(p, VV=None):
    VV = V if VV is None else VV
    u = p[0] * VV[:, 0] + p[1]; v = -p[2] * VV[:, 2] + p[3]
    img = np.zeros((H, W), np.uint8); cv2.fillPoly(img, list(np.stack([u, v], 1).astype(np.int32)[F]), 1); return img
ys, xs = np.where(A); a0 = (xs.max() - xs.min()) / np.ptp(V[:, 0]); c0 = (ys.max() - ys.min()) / np.ptp(V[:, 2])
p0 = [a0, xs.min() - V[:, 0].min() * a0, c0, ys.min() + V[:, 2].max() * c0]
iou = lambda s: (s & A).sum() / (s | A).sum()
r = minimize(lambda p: 1 - iou(sil(p)), p0, method='Nelder-Mead', options={'maxiter': 400, 'xatol': 0.05})
P = r.x; print('정렬 IoU', round(iou(sil(P)), 4))
# 윤곽선 대응점
def contour(mask):
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); c = max(cs, key=len)[:, 0, :].astype(np.float32); return c
cm = contour(sil(P)); cd = contour(A)
tree = cKDTree(cd); idx = np.linspace(0, len(cm) - 1, 500).astype(int); src = cm[idx]; d, j = tree.query(src); dst = cd[j]
# 너무 먼 대응(팔 사이 등)은 버림
ok = d < 12; src, dst = src[ok], dst[ok]
# 코끝: 얼굴 높이에서 가장 앞으로 나온 점 ↔ 그림의 코끝
info = json.load(open('draw_info.json')); L = info['L']
nt = np.mean(L['nose_tip'], 0)
u = P[0] * V[:, 0] + P[1]; v = -P[2] * V[:, 2] + P[3]
face = (np.abs(v - nt[1]) < 40) & (np.abs(u - nt[0]) < 40)
k = np.where(face)[0][np.argmin(V[face, 1])]
import os
if os.environ.get('NOSE','0')=='1': src = np.vstack([src, [[u[k], v[k]]]]); dst = np.vstack([dst, [nt]])
# 고정점(몸 안쪽 격자) — 변형이 안쪽까지 번지지 않게
gy, gx = np.mgrid[0:H:24, 0:W:24]; inner = cv2.erode(A, np.ones((25, 25), np.uint8))
gp = np.stack([gx[inner[gy, gx] > 0], gy[inner[gy, gx] > 0]], 1).astype(np.float32)
S = np.vstack([src, gp]); D = np.vstack([dst - src, np.zeros_like(gp)])
rbf = RBFInterpolator(S, D, kernel='thin_plate_spline', smoothing=3.0)
disp = rbf(np.stack([u, v], 1))
V2 = V.copy(); V2[:, 0] += disp[:, 0] / P[0]; V2[:, 2] -= disp[:, 1] / P[2]
print('깎은 뒤 IoU', round(iou(sil(P, V2)), 4), '코끝 이동(px)', np.round(nt - [u[k], v[k]], 1))
m2 = trimesh.Trimesh(V2, F); trimesh.smoothing.filter_taubin(m2, iterations=4)
m.export('fig_raw.ply'); m2.export('fig_sculpt.ply')
json.dump({'p': list(P)}, open('fig_align.json', 'w'))
cv2.imwrite('sculpt_vis.png', np.dstack([A * 255, sil(P, V2) * 255, sil(P) * 255]))
