# TripoSG(CPU, bfloat16): RGBA 그림 한 장 → 3D 형상
import sys, time, os, numpy as np, torch, cv2, trimesh
sys.path.insert(0, '/tmp/claude-0/tsg/code')
from PIL import Image
from triposg.pipelines.pipeline_triposg import TripoSGPipeline
import triposg.schedulers.scheduling_rectified_flow, triposg.models.transformers.triposg_transformer, triposg.models.autoencoders.autoencoder_kl_triposg
torch.set_num_threads(os.cpu_count())
src, out = sys.argv[1], sys.argv[2]
steps = int(sys.argv[3]) if len(sys.argv) > 3 else 50
seed = int(sys.argv[4]) if len(sys.argv) > 4 else 42
depth = int(os.environ.get('DEPTH', '8'))
im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
a = im[..., 3:4].astype(np.float32) / 255; rgb = im[..., :3][..., ::-1].astype(np.float32) / 255
ys, xs = np.where(a[..., 0] > 0.5); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
c = rgb[y0:y1, x0:x1] * a[y0:y1, x0:x1] + (1 - a[y0:y1, x0:x1]); h, w = c.shape[:2]
pr = 0.1
if w > h: px = int(w * pr); py = int(px + (w - h) / 2)
else: py = int(h * pr); px = int(py + (h - w) / 2)
c = np.pad(c, ((py, py), (px, px), (0, 0)), constant_values=1.0)
img = Image.fromarray((c * 255).astype(np.uint8)); img.save(out + '_in.png')
t = time.time()
pipe = TripoSGPipeline.from_pretrained('/tmp/claude-0/tsg/w', torch_dtype=torch.bfloat16)
print('load', round(time.time() - t), flush=True)
def cb(p, i, ts, kw):
    print('step', i, round(time.time() - t), flush=True); return kw
with torch.no_grad():
    o = pipe(image=img, generator=torch.Generator().manual_seed(seed), num_inference_steps=steps, guidance_scale=7.0,
             use_flash_decoder=False, dense_octree_depth=depth, hierarchical_octree_depth=depth + 1, callback_on_step_end=cb)
v, f = o.samples[0]
print('mesh', round(time.time() - t), v.shape, flush=True)
trimesh.Trimesh(v.astype(np.float32), np.ascontiguousarray(f)).export(out + '.glb')
