"""3D 광장 교육감 캐릭터(chief.glb) — 참고영상 ⑥ 안경 ⑧ 뼈 19개 ⑨ 몸짓 7가지를 붙여 내보냄.
입력(같은 폴더): body.obj(⑤ 깎기·UV 끝난 몸), body.jpg(⑤ 색 + ⑦ 사진 결), rig_points.json(관절·눈 자리)
실행: python chief2.py  (Blender 5.x 파이썬 모듈 bpy)"""
import bpy, os, json, math
from mathutils import Vector, Quaternion, Matrix
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('CHIEF_OUT') or os.path.join(HERE, '..', '..', 'src', 'plaza', 'chief.glb')
RP = json.load(open(os.path.join(HERE, 'rig_points.json')))
HEIGHT = 1.55  # 광장 캐릭터 키(정수리까지, m)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=os.path.join(HERE, 'body.obj'), forward_axis='Y', up_axis='Z')
body = bpy.context.selected_objects[0]; body.name = 'ChiefBody'
zmin = min(v.co.z for v in body.data.vertices); zmax = max(v.co.z for v in body.data.vertices)
S = HEIGHT / (zmax - zmin)
def T(p):  # 원래 좌표 → 광장 좌표(발바닥 z=0)
    return Vector((p[0] * S, p[1] * S, (p[2] - zmin) * S))
for v in body.data.vertices: v.co = T(v.co)
for p in body.data.polygons: p.use_smooth = True
bpy.context.view_layer.objects.active = body
try: bpy.ops.mesh.customdata_custom_splitnormals_clear()
except Exception: pass
mat = bpy.data.materials.new('ChiefBody'); mat.use_nodes = True
bs = mat.node_tree.nodes['Principled BSDF']; bs.inputs['Roughness'].default_value = 0.7
tx = mat.node_tree.nodes.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(os.path.join(HERE, 'body.jpg'))
mat.node_tree.links.new(tx.outputs['Color'], bs.inputs['Base Color'])
body.data.materials.clear(); body.data.materials.append(mat)

# ── 손: 3D 형상 빚기에서 주먹(뭉친 덩어리)으로 나온 손을 지우고, 손바닥·손가락 4개·엄지를 편 손으로 새로 붙임 ──
import bmesh, numpy as np
HAND_SCALE = float(os.environ.get('CHIEF_HAND', '1.55'))
img = tx.image; IW, IH = img.size; PX = np.array(img.pixels[:], dtype=np.float32).reshape(IH, IW, 4)
def tex_at(u, v):
    x = min(IW - 1, max(0, int(u * IW))); y = min(IH - 1, max(0, int(v * IH))); return PX[y, x, :3]
uvl = body.data.uv_layers.active.data
vuv = {}
for lp in body.data.loops: vuv.setdefault(lp.vertex_index, uvl[lp.index].uv.copy())
HANDS_NEW = {}
def skin_info(side):
    jf, jh = T(RP['joints']['forearm.' + side]), T(RP['joints']['hand.' + side])
    a = (jh - jf).normalized(); skin = []
    for v in body.data.vertices:
        d = v.co - jh; p = d.dot(a); r = (d - a * p).length
        if p > -0.06 and r < 0.075 and d.length < 0.11:
            c = tex_at(*vuv[v.index])
            if c[0] > 0.33 and c[0] - c[2] > 0.08 and c[1] > 0.2: skin.append((v.index, p, c))
    cols = np.array([c[2] for c in skin]); med = np.median(cols, 0)
    best = min(skin, key=lambda c: float(np.sum((c[2] - med) ** 2)))
    return jh, a, min(c[1] for c in skin) + 0.004, vuv[best[0]]
INFO = {s: skin_info(s) for s in 'LR'}
# 1) 옛 주먹을 소매 끝에서 평면으로 잘라냄(위치 기준) → 잘린 테두리를 한 평면으로 고르고 막음
bm = bmesh.new(); bm.from_mesh(body.data); bm.verts.ensure_lookup_table()
cut = set()
for jh, a, pcut, _ in INFO.values():
    for v in bm.verts:
        d = v.co - jh; p = d.dot(a)
        if d.length < 0.14 and p > pcut and (d - a * p).length < 0.085: cut.add(v.index)
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in cut], context='VERTS')
bm.verts.ensure_lookup_table()
# 잘리고 남은 주먹 조각(떠 있는 작은 덩어리) 지움
seen = set(); junk = []
for v0 in bm.verts:
    if v0 in seen: continue
    comp = []; stack = [v0]; seen.add(v0)
    while stack:
        v = stack.pop(); comp.append(v)
        for e in v.link_edges:
            o = e.other_vert(v)
            if o not in seen: seen.add(o); stack.append(o)
    if len(comp) < 300 and any((comp[0].co - jh).length < 0.25 for jh, _, _, _ in INFO.values()): junk += comp
bmesh.ops.delete(bm, geom=junk, context='VERTS'); print('junk verts', len(junk))
bm.edges.ensure_lookup_table(); bnd = [e for e in bm.edges if e.is_boundary]
RING = {}
for v in {v for e in bnd for v in e.verts}:
    for s_, (jh, a, pcut, _) in INFO.items():
        d = v.co - jh
        if d.length < 0.15: v.co = v.co - a * (d.dot(a) - pcut); RING.setdefault(s_, []).append(v)
uvL = bm.loops.layers.uv.active
res = bmesh.ops.holes_fill(bm, edges=bnd, sides=0)
dark = None
for s_, vs in RING.items():
    cand = [(float(np.sum(tex_at(*l[uvL].uv))), l[uvL].uv.copy()) for v in vs for l in v.link_loops]
    dark = min(cand, key=lambda c: c[0])[1]
for f in res['faces']:
    for l in f.loops: l[uvL].uv = dark
WR = {s_: (sum((v.co for v in vs), Vector()) / len(vs), sum(((v.co - sum((w.co for w in vs), Vector()) / len(vs)).length for v in vs)) / len(vs)) for s_, vs in RING.items()}
print('cut', len(cut), 'ring', {k: (len(v), round(WR[k][1], 4)) for k, v in RING.items()}, 'caps', len(res['faces']))
bm.to_mesh(body.data); bm.free()
# 2) 편 손: 손바닥·손가락 4개·엄지를 이어 붙여 매끈하게 녹여 만듦, 소매 끝 한가운데에서 나옴
def build_hand(side):
    jh, a, pcut, u = INFO[side]; W, rr = WR[side]
    inward = Vector((-1, 0, 0)) if side == 'L' else Vector((1, 0, 0))
    n = (inward - a * inward.dot(a)).normalized()          # 손바닥이 몸쪽
    f = a.cross(n).normalized()
    if f.y > 0: f = -f                                       # 엄지가 앞쪽(모델은 -Y를 봄)
    M = Matrix((f, n, a)).transposed()
    k = HAND_SCALE; parts = []
    def ell(c, rad):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1, location=(0, 0, 0))
        o = bpy.context.active_object; o.scale = Vector(rad) * k; o.location = Vector(c) * k; parts.append(o)
    def cap(p0, p1, r, rk=None):
        p0, p1 = Vector(p0) * k, Vector(p1) * k; d = p1 - p0; r = r * k if rk is None else rk
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, vertices=16, location=(p0 + p1) / 2)
        o = bpy.context.active_object; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized()); parts.append(o)
        for q in (p0, p1):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=r, location=q); parts.append(bpy.context.active_object)
    cap((0, 0, -0.03), (0, 0.001, 0.012), 0, rk=min(rr * 0.8, 0.0165 * k))   # 손목(소매 구멍 크기에 맞춰 안으로 깊이)
    ell((0, 0.0015, 0.031), (0.0285, 0.0132, 0.029))                         # 손바닥
    for x, L, ang in ((0.0182, 0.029, 3.5), (0.0061, 0.033, 1), (-0.0061, 0.031, -1), (-0.0182, 0.024, -3.5)):
        s0 = Vector((x, 0.002, 0.05)); dvec = Vector((math.sin(math.radians(ang)), math.sin(math.radians(11)), 1)).normalized()
        cap(s0, s0 + dvec * L, 0.0074)                                        # 손가락(가지런히, 손바닥 쪽으로 조금 굽힘)
    t0 = Vector((0.02, 0.007, 0.017)); cap(t0, t0 + Vector((0.6, 0.45, 0.66)).normalized() * 0.028, 0.0088)   # 엄지
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True); bpy.ops.object.join()
    h = parts[0]; h.name = 'Hand' + side
    rm = h.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.0016 * k
    sm = h.modifiers.new('sm', 'SMOOTH'); sm.factor = 0.8; sm.iterations = 6
    dc = h.modifiers.new('dc', 'DECIMATE'); dc.ratio = 0.35
    for m in ('rm', 'sm', 'dc'): bpy.ops.object.modifier_apply(modifier=m)
    for v in h.data.vertices: v.co = W + M @ v.co
    for p in h.data.polygons: p.use_smooth = True
    h.data.uv_layers.new(name=body.data.uv_layers.active.name)
    for l in h.data.uv_layers[0].data: l.uv = u
    h.data.materials.clear(); h.data.materials.append(mat)
    vg = h.vertex_groups.new(name='HANDMARK_' + side); vg.add(list(range(len(h.data.vertices))), 1.0, 'REPLACE')
    print('hand', side, 'wrist', tuple(round(x, 3) for x in W), 'faces', len(h.data.polygons))
    return h
for s in 'LR': HANDS_NEW[s] = build_hand(s)
bpy.ops.object.select_all(action='DESELECT')
for h in HANDS_NEW.values(): h.select_set(True)
body.select_set(True); bpy.context.view_layer.objects.active = body; bpy.ops.object.join()

# ── ⑥ 안경: 그림 속 테 모양대로 얇은 금속 테(무테 + 다리) ──
gm = bpy.data.materials.new('Glasses'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.5, 0.38, 0.18, 1)
le, re = Vector(RP['left_eye']), Vector(RP['right_eye'])
io = (re - le).length
gy = min(le.y, re.y) - 0.035
parts = []
for e in (le, re):
    c = T((e.x, gy, e.z - 0.012))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.5, minor_radius=0.016, major_segments=32, minor_segments=5, location=c, rotation=(math.pi / 2, 0, 0))
    o = bpy.context.active_object; o.scale = (io * 0.9 * S, io * 0.48 * S, io * 0.9 * S); parts.append(o)
def rod(a, b, r=0.0035):
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, location=(a + b) / 2, vertices=6)
    o = bpy.context.active_object; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized()); parts.append(o)
L, R = T((le.x, gy, le.z - 0.012)), T((re.x, gy, re.z - 0.012)); hw = io * 0.43 * S
rod(L + Vector((hw, 0, 0.006)), R - Vector((hw, 0, -0.006)))
for e, ear in ((R, 'earL'), (L, 'earR')):
    sx = 1 if ear == 'earL' else -1
    rod(e + Vector((sx * hw, 0, 0.004)), T(RP[ear]) - Vector((sx * 0.01, 0, 0)))
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.transform_apply(scale=True, rotation=True, location=False); bpy.ops.object.join()
glasses = parts[0]; glasses.name = 'Glasses'; glasses.data.materials.clear(); glasses.data.materials.append(gm)
for p in glasses.data.polygons: p.use_smooth = True

# ── ⑧ 뼈 19개 ──
J = {k: T(v) for k, v in RP['joints'].items()}
for s in 'LR': J['toe.' + s] = J['foot.' + s] + Vector((0, -0.07, -0.02))
arm = bpy.data.armatures.new('Rig'); rig = bpy.data.objects.new('Rig', arm); bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
B = {}
def bone(n, h, t, parent=None, conn=False):
    b = arm.edit_bones.new(n); b.head = J[h] if isinstance(h, str) else h; b.tail = J[t] if isinstance(t, str) else t
    if parent: b.parent = B[parent]; b.use_connect = conn
    B[n] = b; return b
bone('hips', 'hips', 'spine'); bone('spine', 'spine', 'chest', 'hips', True); bone('chest', 'chest', 'neck', 'spine', True)
bone('neck', 'neck', 'head', 'chest', True); bone('head', 'head', 'head_top', 'neck', True)
for s in 'LR':
    bone('shoulder.' + s, 'shoulder.' + s, 'upper_arm.' + s, 'chest')
    bone('upper_arm.' + s, 'upper_arm.' + s, 'forearm.' + s, 'shoulder.' + s, True)
    bone('forearm.' + s, 'forearm.' + s, 'hand.' + s, 'upper_arm.' + s, True)
    bone('hand.' + s, 'hand.' + s, 'hand_end.' + s, 'forearm.' + s, True)
    bone('thigh.' + s, 'thigh.' + s, 'shin.' + s, 'hips')
    bone('shin.' + s, 'shin.' + s, 'foot.' + s, 'thigh.' + s, True)
    bone('foot.' + s, 'foot.' + s, 'toe.' + s, 'shin.' + s, True)
for b in arm.edit_bones: b.roll = 0
bpy.ops.object.mode_set(mode='OBJECT')
print('bones', len(arm.bones))
# 자동 무게(열 확산) — 안 되면 봉투 방식
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
try:
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
except Exception as e:
    print('auto weights failed', e); bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')
# 새 손은 손뼈에 통째로(손가락이 팔 따라 휘지 않게)
for s in 'LR':
    gi = {body.vertex_groups['HANDMARK_' + s].index}; ids = [v.index for v in body.data.vertices if any(g.group in gi for g in v.groups)]
    for g in list(body.vertex_groups):
        if g.name != 'hand.' + s: g.remove(ids)
    body.vertex_groups['hand.' + s].add(ids, 1.0, 'REPLACE')
    print('hand verts pinned', s, len(ids))
for s in 'LR':
    body.vertex_groups.remove(body.vertex_groups['HANDMARK_' + s])
# 안경은 머리뼈에(자리 유지)
bpy.ops.object.select_all(action='DESELECT'); glasses.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE'); arm.bones.active = arm.bones['head']
bpy.ops.object.parent_set(type='BONE', keep_transform=True); bpy.ops.object.mode_set(mode='OBJECT')

# ── ⑨ 몸짓: idle·walk·wave·talk·bow(손 모아 꾸벅)·point(가리키며 안내)·clap·cheer(V자 만세) ──
rig.animation_data_create()
REST = {b.name: b.matrix_local.to_quaternion() for b in arm.bones}
def q_world(name, axis, deg):
    """뼈의 쉬는 자세 기준, 세계 축 axis 둘레로 deg 만큼 돌리는 로컬 회전"""
    r = REST[name]; return r.inverted() @ Quaternion(Vector(axis), math.radians(deg)) @ r
def action(name, keys, loop=True):
    act = bpy.data.actions.new(name); rig.animation_data.action = act
    for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
    for f, pose in keys:
        for pb in rig.pose.bones:
            q = Quaternion()
            for axis, deg in pose.get(pb.name, []): q = q_world(pb.name, axis, deg) @ q
            pb.rotation_quaternion = q; pb.keyframe_insert('rotation_quaternion', frame=f)
            if pb.name == 'hips':
                pb.location = pose.get('_lift', (0, 0, 0)); pb.keyframe_insert('location', frame=f)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, int(keys[0][0]), act); st.name = name
    rig.animation_data.action = None
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
# 축 약속(모델은 -Y를 봄): 팔 Y+ = 오른팔 바깥으로 들기(왼팔은 Y-), 팔 X- = 앞으로 들기, 몸·고개 X+ = 앞으로 숙이기, 고개 Z- = 오른쪽 보기
DOWN = {'upper_arm.L': [(Y, -6)], 'upper_arm.R': [(Y, 6)], 'forearm.L': [(X, -8)], 'forearm.R': [(X, -8)]}
def mix(*ds):
    o = {}
    for d in ds:
        for k, v in d.items(): o[k] = (o.get(k, []) + list(v)) if k != '_lift' else v
    return o
# 1 서기: 숨쉬기 + 살짝 흔들림 + 고개 둘러보기
action('idle', [(0, mix(DOWN, {'chest': [(X, 0)], 'head': [(Z, 0)]})), (40, mix(DOWN, {'chest': [(X, 2.5)], 'spine': [(Z, 1.5)], 'head': [(X, -2), (Z, 6)]})),
                (80, mix(DOWN, {'chest': [(X, 0)], 'head': [(Z, 0)]})), (120, mix(DOWN, {'chest': [(X, 2.5)], 'spine': [(Z, -1.5)], 'head': [(X, -2), (Z, -6)]})), (160, mix(DOWN, {'chest': [(X, 0)], 'head': [(Z, 0)]}))])
# 2 걷기
wk = []
for f, s_ in ((0, 1), (8, 0), (16, -1), (24, 0), (32, 1)):
    wk.append((f, {'thigh.L': [(X, -30 * s_)], 'thigh.R': [(X, 30 * s_)], 'shin.L': [(X, 25 * max(0, s_))], 'shin.R': [(X, 25 * max(0, -s_))],
                   'upper_arm.L': [(Y, -6), (X, 24 * s_)], 'upper_arm.R': [(Y, 6), (X, -24 * s_)], 'forearm.L': [(X, -15)], 'forearm.R': [(X, -15)],
                   'spine': [(Z, -3 * s_)], 'chest': [(X, 4)], 'head': [(Z, 2 * s_)], '_lift': (0, 0.015 if s_ == 0 else 0, 0)}))
action('walk', wk)
# 3 손 흔들기: 오른팔을 머리 옆까지 들고 손을 좌우로
UPR = {'upper_arm.R': [(Y, 128), (X, -12)], 'forearm.R': [(Y, 12)], 'chest': [(Z, -4)], 'head': [(Z, 4), (Y, 4)], 'upper_arm.L': [(Y, -6)]}
wv = [(0, DOWN), (8, mix(UPR, {'hand.R': [(Y, 0)]}))]
for i, f in enumerate(range(14, 51, 6)):
    k = 1 if i % 2 else -1
    wv.append((f, mix(UPR, {'forearm.R': [(Y, 16 * k)], 'hand.R': [(Y, 22 * k)]})))
wv.append((60, DOWN)); action('wave', wv)
# 4 말하기: 고개 끄덕 + 한 손 펴서 설명
action('talk', [(0, DOWN), (8, mix(DOWN, {'head': [(X, 6)], 'upper_arm.R': [(X, -22), (Y, 10)], 'forearm.R': [(X, -45)], 'hand.R': [(Z, 20)]})),
                (16, mix(DOWN, {'head': [(X, -3)], 'upper_arm.R': [(X, -28), (Y, 14)], 'forearm.R': [(X, -50)], 'hand.R': [(Z, 30)]})),
                (24, mix(DOWN, {'head': [(X, 5)], 'upper_arm.R': [(X, -22), (Y, 10)], 'forearm.R': [(X, -45)], 'hand.R': [(Z, 20)]})), (32, DOWN)])
# 5 꾸벅: 두 손을 배 앞에 모으고 허리 숙여 인사
HANDS = {'upper_arm.L': [(X, -16), (Y, 44)], 'upper_arm.R': [(X, -16), (Y, -44)], 'forearm.L': [(X, -66), (Z, -66)], 'forearm.R': [(X, -66), (Z, 66)]}
BOW = mix(HANDS, {'spine': [(X, 12)], 'chest': [(X, 16)], 'head': [(X, 12)]})
action('bow', [(0, DOWN), (8, HANDS), (18, BOW), (32, BOW), (42, HANDS), (50, DOWN)])
# 6 가리키며 안내: 오른팔 쭉 뻗어 앞오른쪽을 가리키고, 고개도 그쪽, 왼손은 펴서 보조
PT = {'upper_arm.R': [(Y, 70), (X, -45)], 'forearm.R': [(X, -8)], 'hand.R': [(X, -10)], 'chest': [(Z, -10)], 'head': [(Z, -16), (X, -3)],
      'upper_arm.L': [(Y, -10), (X, -12)], 'forearm.L': [(X, -35), (Z, -15)]}
action('point', [(0, DOWN), (12, PT), (40, mix(PT, {'hand.R': [(X, 6)]})), (52, DOWN)])
# 7 박수: 가슴 앞에서 손뼉
cl = [(0, DOWN)]
CLAP = {'upper_arm.L': [(X, -40), (Y, 42)], 'upper_arm.R': [(X, -40), (Y, -42)], 'head': [(X, -4)], 'chest': [(X, -3)]}
for i, f in enumerate(range(6, 43, 4)):
    k = i % 2
    cl.append((f, mix(CLAP, {'forearm.L': [(X, -55), (Z, -48 - 22 * k)], 'forearm.R': [(X, -55), (Z, 48 + 22 * k)]})))
cl.append((52, DOWN)); action('clap', cl)
# 8 V자 만세: 두 팔을 크게 벌려 위로, 살짝 뛰며 고개 젖힘
VUP = {'upper_arm.L': [(Y, -122)], 'upper_arm.R': [(Y, 122)], 'forearm.L': [(Y, -14)], 'forearm.R': [(Y, 14)], 'head': [(X, -9)], 'chest': [(X, -6)]}
action('cheer', [(0, DOWN), (8, mix(VUP, {'_lift': (0, 0.05, 0)})), (14, VUP), (22, mix(VUP, {'_lift': (0, 0.05, 0)})), (30, VUP), (42, DOWN)])
bpy.context.scene.render.fps = 30
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS', export_image_format='JPEG', export_jpeg_quality=86, export_apply=False)
print('EXPORTED', OUT)
