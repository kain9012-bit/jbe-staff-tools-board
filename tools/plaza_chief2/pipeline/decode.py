# 잠재값 → 메시 (VAE만 올려 메모리 아끼기)
import sys, os, time, torch, numpy as np, trimesh
sys.path.insert(0, '/tmp/claude-0/tsg/code')
import triposg.models.autoencoders.autoencoder_kl_triposg as A
from triposg.inference_utils import hierarchical_extract_geometry
torch.set_num_threads(os.cpu_count())
lat, out = sys.argv[1], sys.argv[2]; d = int(os.environ.get('DEPTH', '8'))
vae = A.TripoSGVAEModel.from_pretrained('/tmp/claude-0/tsg/w', subfolder='vae', torch_dtype=torch.float32).eval()
z = torch.load(lat).float()
t = time.time()
with torch.no_grad():
    f = lambda x: vae.decode(z, sampled_points=x.float(), num_chunks=int(os.environ.get('CHUNK', '20000'))).sample.float()
    print('start', flush=True)
    o = hierarchical_extract_geometry(f, 'cpu', bounds=(-1.005, -1.005, -1.005, 1.005, 1.005, 1.005), dense_octree_depth=d, hierarchical_octree_depth=d + 1)
v, fc = o[0]
print('decode', round(time.time() - t), v.shape, flush=True)
trimesh.Trimesh(v, fc).export(out)
