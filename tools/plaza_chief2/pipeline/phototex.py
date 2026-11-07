# ⑦ 사진 결: 실제 사진(안경 지움)을 얼굴 특징점에 맞춰 그림 얼굴에 덧입힘 → drawing_photo.png
import cv2, numpy as np, json, sys
import face_recognition as fr
from scipy.interpolate import RBFInterpolator
alpha_mix = float(sys.argv[1]) if len(sys.argv) > 1 else 0.85
CM = float(sys.argv[2]) if len(sys.argv) > 2 else 0.7
SC = 2
dr = cv2.imread('ng_pre.png'); dr = cv2.resize(dr, None, fx=SC, fy=SC, interpolation=cv2.INTER_CUBIC); H, W = dr.shape[:2]
import os
ph = cv2.imread(os.environ.get('PHOTO', '/tmp/claude-0/ch/work/hr/crop.jpg')); OUTN = os.environ.get('OUTN', 'drawing_photo')
def lms(img):
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB); L = fr.face_landmarks(rgb, fr.face_locations(rgb, number_of_times_to_upsample=1))[0]
    return L, np.array([p for k in ('chin', 'left_eyebrow', 'right_eyebrow', 'nose_bridge', 'nose_tip', 'left_eye', 'right_eye', 'top_lip', 'bottom_lip') for p in L[k]], np.float32)
Ld, pd = lms(dr); Lp, pp = lms(ph)
# 사진 안경 지우기(테 자국 인페인트)
g = cv2.cvtColor(ph, cv2.COLOR_BGR2GRAY); Hp, Wp = g.shape
band = np.zeros((Hp, Wp), np.uint8)
br = np.array(Lp['left_eyebrow'] + Lp['right_eyebrow']); jaw = np.array(Lp['chin']); nt = np.array(Lp['nose_tip'])
cv2.rectangle(band, (int(jaw[:, 0].min() - 10), int(br[:, 1].min() + 4)), (int(jaw[:, 0].max() + 10), int(nt[:, 1].mean())), 255, -1)
eyem = np.zeros_like(band)
for k in ('left_eye', 'right_eye'): cv2.fillPoly(eyem, [cv2.convexHull(np.array(Lp[k], np.int32))], 255)
eyem = cv2.dilate(eyem, np.ones((7, 7), np.uint8))
bm = np.zeros_like(band)
for k in ('left_eyebrow', 'right_eyebrow'): cv2.polylines(bm, [np.array(Lp[k], np.int32)], False, 255, 9)
ed = cv2.dilate(cv2.Canny(g, 25, 70), np.ones((3, 3), np.uint8))
rim = ((ed > 0) & (band > 0) & (eyem == 0) & (bm == 0)).astype(np.uint8) * 255
ph2 = cv2.inpaint(ph, rim, 6, cv2.INPAINT_TELEA); cv2.imwrite(OUTN + '_noglass.jpg', ph2)
# 그림 좌표로 사진을 휨(특징점 TPS: 그림→사진 역방향 사상)
gy, gx = np.mgrid[0:H, 0:W].astype(np.float32)
x0, x1 = int(pd[:, 0].min() - 80), int(pd[:, 0].max() + 80); y0, y1 = int(pd[:, 1].min() - 120), int(pd[:, 1].max() + 40)
rbf = RBFInterpolator(pd, pp, kernel='thin_plate_spline', smoothing=1.0)
q = np.stack([gx[y0:y1, x0:x1].ravel(), gy[y0:y1, x0:x1].ravel()], 1)
mp = rbf(q).astype(np.float32).reshape(y1 - y0, x1 - x0, 2)
warp = cv2.remap(ph2, mp[..., 0], mp[..., 1], cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
# 얼굴 안쪽 가림막(턱선 + 눈썹 위 이마 조금)
chin = np.array(Ld['chin']); browd = np.array(Ld['left_eyebrow'] + Ld['right_eyebrow']).astype(np.float32)
top_ = browd.copy(); top_[:, 1] -= (chin[:, 1].max() - browd[:, 1].mean()) * 0.15
ctr = np.array(Ld['nose_tip']).mean(0); chin2 = ctr + (chin - ctr) * 0.92
mask = np.zeros((H, W), np.float32); cv2.fillPoly(mask, [cv2.convexHull(np.vstack([chin2, top_]).astype(np.int32))], 1.0)
mask = cv2.GaussianBlur(cv2.erode(mask, np.ones((9, 9), np.uint8)), (0, 0), 12)[y0:y1, x0:x1] * alpha_mix
# 색 맞추기(LAB) — 그림 피부 톤에 70% 맞춤
reg = dr[y0:y1, x0:x1].astype(np.float32) / 255; wf = warp.astype(np.float32) / 255
La, Lb_ = cv2.cvtColor(reg, cv2.COLOR_BGR2LAB), cv2.cvtColor(wf, cv2.COLOR_BGR2LAB); mm = mask > 0.4
for c in range(3):
    mu_a, sd_a = La[..., c][mm].mean(), La[..., c][mm].std(); mu_b, sd_b = Lb_[..., c][mm].mean(), Lb_[..., c][mm].std()
    t = (Lb_[..., c] - mu_b) * (sd_a / (sd_b + 1e-6)) + mu_a; Lb_[..., c] = CM * t + (1 - CM) * Lb_[..., c]
wf = cv2.cvtColor(Lb_, cv2.COLOR_LAB2BGR)
outr = wf * mask[..., None] + reg * (1 - mask[..., None])
out = dr.copy(); out[y0:y1, x0:x1] = np.clip(outr * 255, 0, 255).astype(np.uint8)
cv2.imwrite(OUTN + '.png', out)
rgba = cv2.imread('drawing_rgba.png', cv2.IMREAD_UNCHANGED); rgba = cv2.resize(rgba, None, fx=SC, fy=SC, interpolation=cv2.INTER_CUBIC); rgba[..., :3] = out; cv2.imwrite(OUTN + '_rgba.png', rgba)
import sys as _s; _s.path.insert(0, '.'); import arc
print('그림(안경X)', round(arc.score(cv2.cvtColor(dr, cv2.COLOR_BGR2RGB)), 3), '사진 결', round(arc.score(cv2.cvtColor(out, cv2.COLOR_BGR2RGB)), 3))
