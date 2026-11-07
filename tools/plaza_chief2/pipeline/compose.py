# 밑그림: 정장 몸(렌더) + 실제 사진 머리(크게) → base.png 512x768
import cv2, numpy as np, json
W, H = 512, 768
body = cv2.imread('body.png', cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
bg = np.ones((H, W, 3), np.float32) * np.array([0.95, 0.93, 0.91])  # BGR 연회색
a = body[..., 3:4]; img = body[..., :3] * a + bg * (1 - a)
# 몸의 목 위치(맨 위 불투명 줄)
ys, xs = np.where(body[..., 3] > 0.5); neck_y = ys.min(); cx = int(xs[ys < neck_y + 20].mean())
crop = cv2.imread('/tmp/claude-0/ch/work/hr/crop.jpg').astype(np.float32) / 255
m = cv2.imread('/tmp/claude-0/ch/work/hr/mask3.png', 0).astype(np.float32) / 255
lm = json.load(open('/tmp/claude-0/ch/work/hr/landmarks.json'))  # can 좌표 — crop 좌표로 다시 구함
import face_recognition as fr
rgb = cv2.cvtColor((crop * 255).astype(np.uint8), cv2.COLOR_BGR2RGB)
L = fr.face_landmarks(rgb)[0]
chin = max(p[1] for p in L['chin']); ys2 = np.where(m.max(1) > 0.5)[0]; top = ys2.min()
cut = int(chin + (chin - top) * 0.10)
# 턱선 아래로는 얼굴 윤곽(턱) 안쪽과 목만 남김 — 어깨·옷깃 제거
jaw = np.array(L['chin'], np.int32)
keep = np.zeros_like(m); keep[:int(min(jaw[5][1], jaw[11][1]))] = 1
cv2.fillPoly(keep, [cv2.convexHull(jaw)], 1)
jw = jaw[:, 0].max() - jaw[:, 0].min(); jc = int(jaw[:, 0].mean())
cv2.rectangle(keep, (int(jc - jw * 0.22), int(jaw[:, 1].min())), (int(jc + jw * 0.22), cut), 1, -1)
m = m * cv2.GaussianBlur(keep, (0, 0), 2)
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((11, 1), np.uint8))
head = crop[top:cut]; hm = m[top:cut]
# 턱 아래는 부드럽게 사라지게
fade = np.clip((cut - np.arange(top, cut)) / ((chin - top) * 0.08), 0, 1)[:, None]
facex = np.mean([p[0] for p in L['nose_bridge']])
hm = hm * fade
HH = int(H * 0.40); s = HH / head.shape[0]
head = cv2.resize(head, None, fx=s, fy=s, interpolation=cv2.INTER_AREA); hm = cv2.resize(hm, None, fx=s, fy=s)
hx = int(cx - facex * s); hy = int(neck_y + 62 - (chin - top) * s)
y0, x0 = max(0, hy), max(0, hx)
hh, ww = head.shape[:2]
sy0, sx0 = y0 - hy, x0 - hx
y1, x1 = min(H, hy + hh), min(W, hx + ww)
reg = img[y0:y1, x0:x1]; hh_ = head[sy0:sy0 + (y1 - y0), sx0:sx0 + (x1 - x0)]; mm = hm[sy0:sy0 + (y1 - y0), sx0:sx0 + (x1 - x0), None]
img[y0:y1, x0:x1] = hh_ * mm + reg * (1 - mm)
cv2.imwrite('base.png', (img * 255).astype(np.uint8)); print('neck', neck_y, 'head', hy, HH)
