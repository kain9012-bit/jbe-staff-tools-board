# ② 안경 벗기기: 테 자국을 지우고(인페인트) → sd-turbo로 눈가만 다시 그려 합성
import cv2, numpy as np, torch, sys, os
import face_recognition as fr
from PIL import Image
from diffusers import AutoPipelineForImage2Image
src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src); rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB); H, W = im.shape[:2]
L = fr.face_landmarks(rgb, fr.face_locations(rgb, number_of_times_to_upsample=1))[0]
eyes = np.array(L['left_eye'] + L['right_eye'], np.int32); brows = np.array(L['left_eyebrow'] + L['right_eyebrow'])
jaw = np.array(L['chin']); nose = np.array(L['nose_bridge'] + L['nose_tip'])
eh = brows[:, 1].mean()
y0 = int(brows[:, 1].min() + 2); y1 = int(np.array(L['nose_tip'])[:, 1].mean() - 2)
x0, x1 = int(jaw[:, 0].min() - 4), int(jaw[:, 0].max() + 4)
band = np.zeros((H, W), np.uint8); cv2.rectangle(band, (x0, y0), (x1, y1), 255, -1)
eyem = np.zeros((H, W), np.uint8)
for k in ('left_eye', 'right_eye'):
    cv2.fillPoly(eyem, [cv2.convexHull(np.array(L[k], np.int32))], 255)
eyem = cv2.dilate(eyem, np.ones((5, 5), np.uint8))
g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
ed = cv2.Canny(g, 30, 90); ed = cv2.dilate(ed, np.ones((3, 3), np.uint8))
rim = (ed > 0) & (band > 0) & (eyem == 0)
# 눈썹·코 윤곽은 남김
bm = np.zeros((H, W), np.uint8)
for k in ('left_eyebrow', 'right_eyebrow'):
    cv2.polylines(bm, [np.array(L[k], np.int32)], False, 255, 6)
rim &= (bm == 0)
rim = rim.astype(np.uint8) * 255
pre = cv2.inpaint(im, rim, 5, cv2.INPAINT_TELEA)
cv2.imwrite(out.replace('.png', '_pre.png'), pre)
torch.set_num_threads(os.cpu_count())
pipe = AutoPipelineForImage2Image.from_pretrained('/tmp/claude-0/sdt', variant='fp16', torch_dtype=torch.bfloat16)
pipe.enable_attention_slicing(); pipe.set_progress_bar_config(disable=True)
P = ("3d cartoon caricature figurine of a smiling korean man without glasses, bare eyes, silver gray wavy hair, navy blue suit, "
     "smooth clay render, soft studio lighting, light gray background")
outs = []
for sd in (1, 2, 3):
    r = pipe(P, image=Image.fromarray(cv2.cvtColor(pre, cv2.COLOR_BGR2RGB)), strength=0.4, num_inference_steps=5, guidance_scale=0.0, generator=torch.Generator().manual_seed(sd)).images[0]
    r = cv2.cvtColor(np.array(r), cv2.COLOR_RGB2BGR)
    m = cv2.GaussianBlur(band.astype(np.float32) / 255, (0, 0), 6)[..., None]
    c = (r * m + pre * (1 - m)).astype(np.uint8)
    fn = out.replace('.png', f'_{sd}.png'); cv2.imwrite(fn, c); outs.append(fn)
print(outs)
