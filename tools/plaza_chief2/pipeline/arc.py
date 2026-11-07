# 닮음 점수: ArcFace(w600k_r50) 코사인 유사도 — 실제 사진 9장 평균
import numpy as np, cv2, json, sys, os
import face_recognition as fr, onnxruntime as ort
SESS = None
REF = np.array([[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]], np.float32)
def five(img_rgb):
    locs = fr.face_locations(img_rgb, number_of_times_to_upsample=1)
    if not locs:
        big = cv2.resize(img_rgb, None, fx=2, fy=2); locs = [tuple(v // 2 for v in l) for l in fr.face_locations(big, number_of_times_to_upsample=1)]
    if not locs: return None
    loc = max(locs, key=lambda l: (l[1] - l[3]) * (l[2] - l[0]))
    lm = fr.face_landmarks(img_rgb, [loc])[0]
    le = np.mean(lm['left_eye'], 0); re = np.mean(lm['right_eye'], 0); nose = np.array(lm['nose_tip'][2])
    ml = np.array(lm['top_lip'][0]); mr = np.array(lm['top_lip'][6])
    return np.array([le, re, nose, ml, mr], np.float32)
def emb(img_rgb):
    global SESS
    if SESS is None: SESS = ort.InferenceSession('/tmp/claude-0/insf/models/buffalo_l/w600k_r50.onnx', providers=['CPUExecutionProvider'])
    p = five(img_rgb)
    if p is None: return None
    M, _ = cv2.estimateAffinePartial2D(p, REF, method=cv2.LMEDS)
    crop = cv2.warpAffine(img_rgb, M, (112, 112), borderValue=0)
    x = ((crop.astype(np.float32) - 127.5) / 127.5).transpose(2, 0, 1)[None]
    e = SESS.run(None, {SESS.get_inputs()[0].name: x})[0][0]
    return e / np.linalg.norm(e)
def load(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im.shape[2] == 4:
        a = im[..., 3:4] / 255.0; im = (im[..., :3] * a + 255 * (1 - a)).astype(np.uint8)
    return cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
def real_set():
    if os.path.exists('real9.npy'): return np.load('real9.npy')
    sel = json.load(open('/tmp/claude-0/ch/work/sel.json'))
    E = []
    for o in sel:
        im = load(os.path.join('/tmp/claude-0/ch/work', o['f'])); t, r, b, l = o['loc']; w = r - l
        crop = im[max(0, t - w): b + w, max(0, l - w): r + w]
        e = emb(crop)
        if e is not None: E.append(e)
        if len(E) == 9: break
    E = np.array(E); np.save('real9.npy', E); return E
def score(img_rgb):
    e = emb(img_rgb)
    if e is None: return None
    return float((real_set() @ e).mean())
if __name__ == '__main__':
    R = real_set(); print('real self-sim mean', round(float((R @ R.T)[np.triu_indices(len(R), 1)].mean()), 3))
    for f in sys.argv[1:]: print(f, score(load(f)))
