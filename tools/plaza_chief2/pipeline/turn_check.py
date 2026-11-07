# 360° 1°씩 자동 점검: 구멍(속이 비쳐 보임), 이웃 각도와 갑자기 달라지는 곳(깜빡임), 하얗게 뜬 곳
import numpy as np, cv2, glob, os, json
rep = {}
for pose in sorted(os.listdir('turn')):
    fs = sorted(glob.glob(f'turn/{pose}/*.png')); prev = None; holes, jumps, white = [], [], []
    for i, f in enumerate(fs):
        im = cv2.imread(f, cv2.IMREAD_UNCHANGED); a = (im[..., 3] > 128).astype(np.uint8)
        ff = a.copy(); mask = np.zeros((a.shape[0] + 2, a.shape[1] + 2), np.uint8); cv2.floodFill(ff, mask, (0, 0), 1)
        hole = int(((1 - ff) > 0).sum()); holes.append(hole)
        rgb = im[..., :3].astype(np.float32); hsv = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2HSV)
        wh = int(((hsv[..., 2] > 245) & (hsv[..., 1] < 20) & (a > 0)).sum()); white.append(wh)
        if prev is not None: jumps.append(float(np.abs(rgb - prev).mean()))
        prev = rgb
    j = np.array(jumps); med = np.median(j)
    rep[pose] = {'hole_max': max(holes), 'hole_angles': [i for i, h in enumerate(holes) if h > 30][:20],
                 'jump_med': round(float(med), 2), 'jump_spikes': [int(i + 1) for i in np.where(j > med * 2.5 + 1)[0]][:20],
                 'white_max': max(white), 'white_angles': [i for i, w in enumerate(white) if w > 60][:20]}
    print(pose, rep[pose])
json.dump(rep, open('turn_report.json', 'w'), indent=1)
