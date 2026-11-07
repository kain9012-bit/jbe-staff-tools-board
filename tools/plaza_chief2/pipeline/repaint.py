# 옆·뒤 모습을 같은 그림체로 다시 그림(sd-turbo img2img) — 실루엣 밖은 버림
import torch, os, sys, numpy as np, cv2
from PIL import Image
from diffusers import AutoPipelineForImage2Image
torch.set_num_threads(os.cpu_count())
pipe = AutoPipelineForImage2Image.from_pretrained('/tmp/claude-0/sdt', variant='fp16', torch_dtype=torch.bfloat16)
pipe.enable_attention_slicing(); pipe.set_progress_bar_config(disable=True)
BASE = ("3d cartoon caricature figurine of an older korean man, oversized head, short wavy silver gray hair with natural strands and darker gray shadows, "
        "navy blue suit jacket, navy trousers, black shoes, smooth clay render, soft studio lighting, light gray background, high quality 3d character")
VIEW = {90: 'left side profile view, ear visible', 270: 'right side profile view, ear visible', 180: 'back view, back of head hair, back of suit jacket',
        45: 'three quarter view', 315: 'three quarter view', 135: 'three quarter back view', 225: 'three quarter back view'}
st = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
for ang, txt in VIEW.items():
    im = Image.open(f'vw_{ang}.png').convert('RGBA'); bg = Image.new('RGBA', im.size, (232, 235, 240, 255)); bg.alpha_composite(im)
    r = pipe(BASE + ', ' + txt, image=bg.convert('RGB'), strength=st, num_inference_steps=max(2, round(2 / st)), guidance_scale=0.0, generator=torch.Generator().manual_seed(7)).images[0]
    r.save(f'rp_{ang}.png'); print(ang, flush=True)
