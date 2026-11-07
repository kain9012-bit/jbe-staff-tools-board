# ① 그림 후보: sd-turbo img2img(CPU) — 밑그림을 3D 캐릭터 그림체로, 후보 여러 장 + 닮음 점수
import torch, sys, os, json, time, numpy as np, cv2
from PIL import Image
from diffusers import AutoPipelineForImage2Image
sys.path.insert(0, '/tmp/claude-0/ch2'); import arc
torch.set_num_threads(os.cpu_count())
pipe = AutoPipelineForImage2Image.from_pretrained('/tmp/claude-0/sdt', variant='fp16', torch_dtype=torch.bfloat16)
pipe.enable_attention_slicing(); pipe.vae.enable_slicing()
pipe.set_progress_bar_config(disable=True)
P = ("3d cartoon caricature figurine of a smiling korean man in his sixties, oversized head, silver gray wavy hair, "
     "thin rimless glasses, navy blue suit, white shirt, navy necktie, standing straight, arms at sides, full body, front view, "
     "soft studio lighting, smooth clay render, light gray background, high quality 3d character")
base = Image.open(sys.argv[1]).convert('RGB')
strengths = [float(x) for x in sys.argv[2].split(',')]; seeds = [int(x) for x in sys.argv[3].split(',')]
os.makedirs('cand', exist_ok=True); res = []
for st in strengths:
    for sd in seeds:
        t = time.time()
        im = pipe(P, image=base, strength=st, num_inference_steps=max(2, round(2 / st)), guidance_scale=0.0, generator=torch.Generator().manual_seed(sd)).images[0]
        fn = f'cand/s{int(st*100)}_{sd}.png'; im.save(fn)
        sc = arc.score(np.array(im)); res.append({'f': fn, 'strength': st, 'seed': sd, 'score': sc})
        print(fn, round(time.time() - t, 1), sc, flush=True)
json.dump(res, open('cand/scores.json', 'w'), indent=1)
