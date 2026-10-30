import numpy as np, math, json, sys
from PIL import Image, ImageDraw, ImageFilter
Image.MAX_IMAGE_PIXELS=None
px0,py0,mpp=4404.686,4362.599,0.4843115
HALF=720
im=Image.open('../../../jbe-hq-3d-map/data/aerial_z18.jpg').convert('RGB')
X0=px0-HALF/mpp; Y0=py0-HALF/mpp; S=2*HALF/mpp
crop=im.crop((int(X0),int(Y0),int(X0+S),int(Y0+S)))
N=int(2*HALF)  # 1m/px
a=np.asarray(crop.resize((N,N),Image.BOX)).astype(np.float32)
R,G,B=a[...,0],a[...,1],a[...,2]
L=0.3*R+0.59*G+0.11*B
# 거칠기(나뭇잎): 1m 밝기의 3x3 표준편차
def boxmean(x,k):
    p=np.pad(x,k,mode='edge'); c=np.cumsum(np.cumsum(p,0),1); c=np.pad(c,((1,0),(1,0)))
    n=2*k+1
    return (c[n:,n:]-c[:-n,n:]-c[n:,:-n]+c[:-n,:-n])/(n*n)
m=boxmean(L,1); v=boxmean(L*L,1)-m*m; sd=np.sqrt(np.maximum(v,0))
exg=2*G-R-B
leaf=(G-R>9)&(G-B>-6)&(L<122)&(sd>6)
# 6m 칸 다수결
T=6; M=N//T
f=leaf[:M*T,:M*T].reshape(M,T,M,T).mean((1,3))
rng=np.random.default_rng(7)
trees=[]
for j in range(M):
    for i in range(M):
        if f[j,i]<float(sys.argv[1] if len(sys.argv)>1 else 0.5): continue
        x=-HALF+(i+.5)*T+rng.uniform(-1.5,1.5); y=HALF-(j+.5)*T+rng.uniform(-1.5,1.5)
        if math.hypot(x,y)>700: continue
        trees.append((x,y))
# 빼는 곳: 건물·길·운동장·주차장·광장 부지
import json as _j
SUR=_j.load(open('surround.json',encoding='utf-8'))
def pts(f): return [(f[i],f[i+1]) for i in range(0,len(f),2)]
def inpoly(x,y,P):
    c=False
    for i in range(len(P)):
        a=P[i]; b=P[i-1]
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]: c=not c
    return c
def segd(x,y,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]; l=dx*dx+dy*dy or 1e-9
    t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/l)); return math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)
W={'secondary':20,'secondary_link':9,'tertiary':15,'tertiary_link':8,'unclassified':9,'residential':7,'living_street':6,'service':5,'pedestrian':4,'footway':2.4,'cycleway':2.4,'path':2}
polys=[pts(b[5]) for b in SUR['b']]+[pts(a[1]) for a in SUR['a'] if a[0].startswith('f_') or a[0] in ('pitch','water')]
d2=_j.load(open('osm2.json'))
LAT,LNG=35.804403,127.102486; ML=111320; MG=111320*math.cos(LAT*math.pi/180)
for e in d2['elements']:
    if e.get('tags',{}).get('amenity')=='parking' and e.get('geometry'):
        polys.append([((q['lon']-LNG)*MG,(q['lat']-LAT)*ML) for q in e['geometry']])
roads=[(W.get(r[0],3),pts(r[1])) for r in SUR['r'] if r[0] not in ('footway','cycleway','path')]
G={}
def put(i,x0,y0,x1,y1):
    for a in range(int(x0//20),int(x1//20)+1):
        for b in range(int(y0//20),int(y1//20)+1): G.setdefault((a,b),[]).append(i)
items=[('p',P) for P in polys]+[('r',r) for r in roads]
for i,(k,v) in enumerate(items):
    P=v if k=='p' else v[1]; xs=[p[0] for p in P]; ys=[p[1] for p in P]; put(i,min(xs)-6,min(ys)-6,max(xs)+6,max(ys)+6)
def bad(x,y):
    for i in G.get((int(x//20),int(y//20)),[]):
        k,v=items[i]
        if k=='p':
            if inpoly(x,y,v): return True
        else:
            w,L=v
            for j in range(len(L)-1):
                if segd(x,y,L[j],L[j+1])<w/2+0.5: return True
    return False
MASKS=1
trees=[t for t in trees if not bad(*t)]
print('trees',len(trees))
json.dump({'t':[round(v,1) for p in trees for v in p]},open('trees.json','w'),separators=(',',':'))
# 미리보기: 동암고·용호공원 둘레 600m
prev=crop.resize((N,N)).crop((HALF-350,HALF-400,HALF+350,HALF+300))
d=ImageDraw.Draw(prev)
for x,y in trees:
    u=x+350; vv=-y+300
    if 0<=u<700 and 0<=vv<700: d.ellipse((u-2,vv-2,u+2,vv+2),fill=(255,40,40))
prev.resize((1050,1050)).save('canopy_prev.jpg',quality=85)
