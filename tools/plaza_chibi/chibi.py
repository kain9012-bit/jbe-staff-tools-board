# 2.5등신 교직원 캐릭터 — 블렌더(bpy) 스크립트. 결과: out/chibi.glb
# 좌표: Z 위, 캐릭터 앞이 -Y (glTF로 내보내면 +Z 앞)
import bpy, bmesh, math
from mathutils import Vector, Matrix, Quaternion

import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'src', 'plaza', 'chibi.glb')
FACE = os.path.join(HERE, 'face.png')
HC = Vector((0, 0, 1.14))   # 머리 중심
HR = 0.36                   # 머리 반지름

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
scn.render.fps = 24

def mat(name, rgb, rough=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    return m
def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

M = {k: mat(k, srgb(v)) for k, v in dict(Skin='#ffdcc4', Top='#3a457f', Inner='#ffffff', Pants='#3b4256', Shoes='#3b3f4a',
                                         Hair='#2b2320', Tie='#2f6fb3', Strap='#2f6fb3', Card='#ffffff', CardBand='#3480cc',
                                         Glasses='#2b2f3a', HatChef='#ffffff', Cap='#1c64ac', HairTie='#e8554e').items()}

def link(ob):
    bpy.context.collection.objects.link(ob)
    return ob
def mesh_from_bm(name, bm):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return link(bpy.data.objects.new(name, me))
def smooth(ob):
    for p in ob.data.polygons: p.use_smooth = True
def add_mod(ob, kind, **kw):
    m = ob.modifiers.new(kind.lower(), kind)
    for k, v in kw.items(): setattr(m, k, v)
    return m
def apply_all(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
def sphere(name, r, loc, scale=(1, 1, 1), seg=24, ring=14, material=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=r)
    ob = mesh_from_bm(name, bm)
    ob.location = loc; ob.scale = scale
    smooth(ob)
    if material: ob.data.materials.append(material)
    return ob

# ── 몸: 스킨 모디파이어로 한 덩어리(몸통·팔·다리) ──
pts = {
    'pelvis': ((0, 0, 0.33), (0.19, 0.155)), 'waist': ((0, 0, 0.46), (0.175, 0.145)), 'chest': ((0, 0, 0.62), (0.2, 0.16)),
    'neck': ((0, 0, 0.84), (0.075, 0.075)),
}
for s, n in ((1, 'L'), (-1, 'R')):
    pts.update({
        f'sh{n}': ((s * 0.19, 0, 0.71), (0.072, 0.072)), f'el{n}': ((s * 0.255, 0, 0.53), (0.062, 0.062)),
        f'wr{n}': ((s * 0.285, -0.005, 0.385), (0.056, 0.056)), f'hd{n}': ((s * 0.29, -0.01, 0.32), (0.07, 0.066)),
        f'hp{n}': ((s * 0.095, 0, 0.3), (0.088, 0.088)), f'kn{n}': ((s * 0.095, 0, 0.17), (0.076, 0.076)),
        f'an{n}': ((s * 0.095, 0, 0.065), (0.07, 0.07)),
    })
names = list(pts)
edges = [('pelvis', 'waist'), ('waist', 'chest'), ('chest', 'neck')]
for n in 'LR':
    edges += [('chest', f'sh{n}'), (f'sh{n}', f'el{n}'), (f'el{n}', f'wr{n}'), (f'wr{n}', f'hd{n}'),
              ('pelvis', f'hp{n}'), (f'hp{n}', f'kn{n}'), (f'kn{n}', f'an{n}')]
me = bpy.data.meshes.new('Body')
me.from_pydata([pts[k][0] for k in names], [(names.index(a), names.index(b)) for a, b in edges], [])
body = link(bpy.data.objects.new('Body', me))
sk = add_mod(body, 'SKIN', branch_smoothing=0.6, use_smooth_shade=True)
for i, k in enumerate(names):
    body.data.skin_vertices[0].data[i].radius = pts[k][1]
    if k == 'pelvis': body.data.skin_vertices[0].data[i].use_root = True
add_mod(body, 'SUBSURF', levels=2, render_levels=2)
apply_all(body)
smooth(body)
for k in ('Skin', 'Top', 'Pants', 'Inner'): body.data.materials.append(M[k])
# 부위별 재질: 손·목 = 피부, 허리 아래 = 바지, 나머지 = 윗옷
for p in body.data.polygons:
    c = p.center
    if c.z > 0.79 or (abs(c.x) > 0.21 and c.z < 0.37):
        p.material_index = 0
    elif c.y < -0.04 and 0.5 < c.z < 0.79 and abs(c.x) < (c.z - 0.5) * 0.42:
        p.material_index = 3
    elif c.z < 0.405 and abs(c.x) < 0.2:
        p.material_index = 2
    else:
        p.material_index = 1

# ── 신발 ──
shoes = []
for s, n in ((1, 'L'), (-1, 'R')):
    o = sphere(f'Shoe{n}', 1, (s * 0.095, -0.03, 0.045), (0.085, 0.125, 0.055), material=M['Shoes'])
    shoes.append((o, f'shin.{n}'))

# ── 앞섶(흰 셔츠 V)·넥타이·공무원증 ──
chest_parts = []
bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=0.034, radius2=0.016, depth=0.21)
tie = mesh_from_bm('Tie', bm); tie.location = (0, -0.172, 0.63); tie.rotation_euler = (0.1, 0, math.pi / 4); tie.scale = (1, 0.35, 1)
tie.data.materials.append(M['Tie']); chest_parts.append(tie)
o = sphere('TieKnot', 0.024, (0, -0.158, 0.745), (1, 0.7, 0.9), material=M['Tie']); chest_parts.append(o)
CARD = Vector((0.0, -0.19, 0.49))
for s_ in (-1, 1):
    a = Vector((s_ * 0.075, -0.13, 0.79)); b = CARD + Vector((s_ * 0.03, 0, 0.06))
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0065, depth=d.length, location=(a + b) / 2, vertices=6)
    st = bpy.context.active_object; st.name = 'Strap'
    st.rotation_mode = 'QUATERNION'; st.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    st.data.materials.append(M['Strap']); chest_parts.append(st)
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
card = mesh_from_bm('Card', bm); card.scale = (0.085, 0.012, 0.11); card.location = CARD; card.data.materials.append(M['Card']); chest_parts.append(card)
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
cb = mesh_from_bm('CardBand', bm); cb.scale = (0.085, 0.014, 0.028); cb.location = CARD + Vector((0, 0, 0.041)); cb.data.materials.append(M['CardBand']); chest_parts.append(cb)
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
ph = mesh_from_bm('CardPhoto', bm); ph.scale = (0.028, 0.014, 0.034); ph.location = CARD + Vector((-0.018, 0, -0.012)); ph.data.materials.append(M['Skin']); chest_parts.append(ph)

# ── 머리·귀 ──
head = sphere('Head', HR, HC, (1.0, 0.96, 0.97), seg=40, ring=24, material=M['Skin'])
ears = [sphere(f'Ear{n}', 0.055, (s * 0.348, 0, HC.z - 0.03), (0.7, 1, 1), material=M['Skin']) for s, n in ((1, 'L'), (-1, 'R'))]

# ── 얼굴 그림(머리 앞면에 붙인 얇은 판) ──
img = bpy.data.images.load(FACE)
fm = bpy.data.materials.new('Face'); fm.use_nodes = True
nt = fm.node_tree; bsdf = nt.nodes['Principled BSDF']
tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img
nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color']); nt.links.new(tx.outputs['Alpha'], bsdf.inputs['Alpha'])
try:
    fm.surface_render_method = 'BLENDED'
except Exception:
    pass
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=HR * 1.004)
uv = bm.loops.layers.uv.new('UVMap')
kill = [v for v in bm.verts if v.co.y > -0.09 or abs(v.co.x) > 0.31 or abs(v.co.z) > 0.3]
bmesh.ops.delete(bm, geom=kill, context='VERTS')
for f_ in bm.faces:
    for l in f_.loops:
        x, z = l.vert.co.x, l.vert.co.z
        # 앞에서 본 평면 투영 → 아틀라스 첫 칸(가로 1/3)
        l[uv].uv = (((x / HR + 1) / 2) / 3, (z / HR + 1) / 2)
face = mesh_from_bm('Face', bm); face.location = HC; face.scale = (1.0, 0.96, 0.97); smooth(face)
face.data.materials.append(fm)

# ── 머리카락 ──
def hair_shell(name, front, side, back, zig=0.0, sweep=0.0, puff=0.0):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=30, radius=HR * 1.07)
    kill = []
    for v in bm.verts:
        n = v.co.normalized()
        f, b, sd = max(0, -n.y) ** 2, max(0, n.y) ** 2, n.x ** 2
        tot = f + b + sd + 1e-6
        thr = (front * f + side * sd + back * b) / tot
        if f > 0.05:
            a = math.atan2(n.x, -n.y)
            thr += zig * math.sin(a * 11) * f + sweep * n.x * f
        if n.z < thr: kill.append(v)
        elif puff and abs(n.x) > 0.5 and n.z < 0.2: v.co.x *= 1 + puff
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    o = mesh_from_bm(name, bm); o.location = HC; o.scale = (1.0, 0.96, 0.97)
    add_mod(o, 'SOLIDIFY', thickness=0.035, offset=-1)
    add_mod(o, 'SUBSURF', levels=1)
    apply_all(o); smooth(o); o.data.materials.append(M['Hair'])
    return o
hairs = {}
hairs['short'] = [hair_shell('Hair_short', 0.24, -0.22, -0.55, zig=0.05)]
hairs['bob'] = [hair_shell('Hair_bob', 0.22, -0.95, -0.9, zig=0.04, puff=0.14)]
hairs['side'] = [hair_shell('Hair_side', 0.2, -0.25, -0.55, sweep=0.18)]
base_p = hair_shell('Hair_pony', 0.24, -0.25, -0.5, zig=0.05)
me = bpy.data.meshes.new('Tail'); vs = [(0, 0.33, 1.2), (0, 0.42, 1.05), (0, 0.42, 0.9), (0, 0.38, 0.79)]
me.from_pydata(vs, [(0, 1), (1, 2), (2, 3)], []); tail = link(bpy.data.objects.new('Hair_pony_tail', me))
add_mod(tail, 'SKIN', use_smooth_shade=True)
for i, r in enumerate((0.08, 0.1, 0.085, 0.04)): tail.data.skin_vertices[0].data[i].radius = (r, r)
add_mod(tail, 'SUBSURF', levels=2); apply_all(tail); smooth(tail); tail.data.materials.append(M['Hair'])
tieo = sphere('Hair_pony_tie', 0.06, (0, 0.33, 1.19), (1, 1, 0.7), material=M['HairTie'])
hairs['pony'] = [base_p, tail, tieo]
base_b = hair_shell('Hair_bun', 0.24, -0.25, -0.55, zig=0.05)
bun = sphere('Hair_bun_ball', 0.15, (0, 0.13, 1.5), material=M['Hair'])
hairs['bun'] = [base_b, bun]
base_c = hair_shell('Hair_curly', 0.26, -0.25, -0.55, zig=0.07)
curls = []
for i in range(14):
    a = i / 14 * math.tau
    curls.append(sphere(f'Hair_curly_{i}', 0.1, (math.cos(a) * 0.28, math.sin(a) * 0.24 + 0.03, HC.z + 0.25 + 0.03 * math.sin(i * 1.7)), material=M['Hair']))
curls.append(sphere('Hair_curly_top', 0.15, (0, 0, HC.z + 0.37), (1, 1, 0.7), material=M['Hair']))
bpy.ops.object.select_all(action='DESELECT')
for o in [base_c] + curls: o.select_set(True)
bpy.context.view_layer.objects.active = base_c; bpy.ops.object.join(); base_c.name = 'Hair_curly'
hairs['curly'] = [base_c]

# ── 안경·모자 ──
gl = []
for s in (-1, 1):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.068, minor_radius=0.009, major_segments=24, minor_segments=6,
                                     location=(s * 0.122, -HR * 0.99, HC.z - 0.015), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.active_object; o.name = 'Glasses_ring'; o.data.materials.append(M['Glasses']); smooth(o); gl.append(o)
bpy.ops.mesh.primitive_cylinder_add(radius=0.008, depth=0.07, location=(0, -HR * 1.0, HC.z - 0.005), rotation=(0, math.pi / 2, 0))
o = bpy.context.active_object; o.data.materials.append(M['Glasses']); gl.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in gl: o.select_set(True)
bpy.context.view_layer.objects.active = gl[0]; bpy.ops.object.join(); glasses = gl[0]; glasses.name = 'Glasses'

chef_a = sphere('Hat_chef_puff', 0.27, (0, 0.02, HC.z + 0.5), (1.05, 1.05, 0.72), material=M['HatChef'])
bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.18, location=(0, 0.02, HC.z + 0.36)); chef_b = bpy.context.active_object
chef_b.data.materials.append(M['HatChef']); smooth(chef_b)
bpy.ops.object.select_all(action='DESELECT'); chef_a.select_set(True); chef_b.select_set(True)
bpy.context.view_layer.objects.active = chef_a; bpy.ops.object.join(); chef = chef_a; chef.name = 'Hat_chef'

bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=HR * 1.1)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < HR * 0.18], context='VERTS')
cap = mesh_from_bm('Hat_cap', bm); cap.location = HC; add_mod(cap, 'SOLIDIFY', thickness=0.03); add_mod(cap, 'SUBSURF', levels=1)
apply_all(cap); smooth(cap); cap.data.materials.append(M['Cap'])
brim = sphere('Hat_cap_brim', 1, (0, -0.3, HC.z + 0.1), (0.2, 0.17, 0.02), material=M['Cap'])
bpy.ops.object.select_all(action='DESELECT'); cap.select_set(True); brim.select_set(True)
bpy.context.view_layer.objects.active = cap; bpy.ops.object.join(); cap.name = 'Hat_cap'

# ── 뼈대 ──
bpy.ops.object.armature_add(location=(0, 0, 0)); arm = bpy.context.active_object; arm.name = 'Rig'
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
root = eb[0]; root.name = 'root'; root.head = (0, 0, 0); root.tail = (0, 0, 0.1)
def bone(name, h, t, parent, connect=False):
    b = eb.new(name); b.head = h; b.tail = t; b.parent = eb[parent]; b.use_connect = connect; b.roll = 0
    return b
bone('hips', (0, 0, 0.3), (0, 0, 0.46), 'root')
bone('chest', (0, 0, 0.46), (0, 0, 0.8), 'hips', True)
bone('head', (0, 0, 0.8), (0, 0, 1.5), 'chest')
for s, n in ((1, 'L'), (-1, 'R')):
    bone(f'upper_arm.{n}', (s * 0.19, 0, 0.71), (s * 0.255, 0, 0.53), 'chest')
    bone(f'forearm.{n}', (s * 0.255, 0, 0.53), (s * 0.29, -0.01, 0.31), f'upper_arm.{n}', True)
    bone(f'thigh.{n}', (s * 0.095, 0, 0.31), (s * 0.095, 0, 0.17), 'hips')
    bone(f'shin.{n}', (s * 0.095, 0, 0.17), (s * 0.095, 0, 0.04), f'thigh.{n}', True)
bpy.ops.object.mode_set(mode='OBJECT')

# 몸은 자동 가중치, 나머지는 뼈에 고정
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
def bone_parent(ob, bname):
    mw = ob.matrix_world.copy()
    ob.parent = arm; ob.parent_type = 'BONE'; ob.parent_bone = bname
    bpy.context.view_layer.update()
    ob.matrix_world = mw
rigid = [head, face, glasses, chef, cap] + ears + [o for v in hairs.values() for o in v]
for o in rigid: bone_parent(o, 'head')
for o in chest_parts: bone_parent(o, 'chest')
for o, b in shoes: bone_parent(o, b)

# ── 동작 ──
pb = arm.pose.bones
for p in pb: p.rotation_mode = 'QUATERNION'
REST = {b.name: b.matrix_local.copy() for b in arm.data.bones}
ORDER = ['root', 'hips', 'chest', 'head', 'upper_arm.L', 'forearm.L', 'upper_arm.R', 'forearm.R', 'thigh.L', 'shin.L', 'thigh.R', 'shin.R']
def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)
def set_pose(spec, loc=None):
    """spec: {bone: (축, 각도)} — 아머처 공간 축으로, 각 뼈의 머리를 중심으로 돌림(부모 움직임 이어받음)"""
    D = {}
    for n in ORDER:
        b = arm.data.bones[n]
        Dp = D[b.parent.name] if b.parent else Matrix.Identity(4)
        h = REST[n].to_translation()
        R = Matrix.Identity(4)
        if n in spec:
            for ax, deg in (spec[n] if isinstance(spec[n], list) else [spec[n]]):
                R = rot(ax, deg) @ R
        Mb = Dp @ Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ REST[n]
        if n == 'hips' and loc is not None: Mb = Matrix.Translation(Vector(loc)) @ Mb
        D[n] = Mb @ REST[n].inverted()
        pb[n].matrix = Mb
        bpy.context.view_layer.update()
def key(frame):
    for n in ORDER:
        pb[n].keyframe_insert('rotation_quaternion', frame=frame)
        pb[n].keyframe_insert('location', frame=frame)
def action(name, frames):
    arm.animation_data_create()
    act = bpy.data.actions.new(name); arm.animation_data.action = act
    for f, spec, loc in frames:
        set_pose(spec, loc); key(f)
    act.use_fake_user = True
    tr = arm.animation_data.nla_tracks.new(); tr.name = name
    tr.strips.new(name, int(frames[0][0]), act)
    arm.animation_data.action = None
    for p in pb: p.matrix_basis = Matrix.Identity(4)
    return act
ARM_DOWN = {'upper_arm.L': ('Y', -6), 'upper_arm.R': ('Y', 6)}
# 서 있기(숨쉬기)
action('idle', [
    (0, {**ARM_DOWN, 'head': ('Y', 2)}, (0, 0, 0)),
    (24, {'upper_arm.L': ('Y', -9), 'upper_arm.R': ('Y', 9), 'head': ('Y', -2), 'chest': ('X', -1.5)}, (0, 0, 0.008)),
    (48, {**ARM_DOWN, 'head': ('Y', 2)}, (0, 0, 0)),
])
# 걷기(20프레임 한 걸음 주기)
def walk(ph):
    a = math.sin(ph); b = math.sin(ph + math.pi)
    return {'thigh.L': ('X', -32 * a), 'thigh.R': ('X', -32 * b), 'shin.L': ('X', 28 * max(0, -math.cos(ph))),
            'shin.R': ('X', 28 * max(0, math.cos(ph))), 'upper_arm.L': [('Y', -8), ('X', 30 * a)], 'upper_arm.R': [('Y', 8), ('X', 30 * b)],
            'forearm.L': ('X', -15), 'forearm.R': ('X', -15), 'chest': ('Z', 4 * a), 'head': ('Z', -3 * a)}
action('walk', [(f, walk(f / 20 * math.tau), (0, 0, 0.025 * abs(math.sin(f / 20 * math.tau)))) for f in range(0, 21, 2)])
# 손 흔들기(왼손)
wv = []
for f in range(0, 31, 3):
    sw = math.sin(f / 30 * math.tau * 2) * 22
    up = min(1, f / 6) * (1 if f < 26 else max(0, (30 - f) / 4))
    wv.append((f, {'upper_arm.L': ('Y', -150 * up - 6 * (1 - up)), 'forearm.L': ('Y', sw * up), 'upper_arm.R': ('Y', 6), 'head': ('Y', -5 * up)}, (0, 0, 0)))
action('wave', wv)
# 말하기(끄덕끄덕)
action('talk', [
    (0, {**ARM_DOWN, 'head': ('X', 0)}, (0, 0, 0)),
    (6, {**ARM_DOWN, 'head': ('X', 6), 'chest': ('X', 2)}, (0, 0, 0.005)),
    (12, {**ARM_DOWN, 'head': ('X', 0)}, (0, 0, 0)),
    (18, {'upper_arm.L': [('Y', -14), ('X', -10)], 'upper_arm.R': ('Y', 6), 'head': ('Y', 4)}, (0, 0, 0.005)),
    (24, {**ARM_DOWN, 'head': ('X', 0)}, (0, 0, 0)),
])

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
                          export_apply=False, export_yup=True, export_skins=True, export_morph=False, export_image_format='WEBP' if False else 'AUTO')
print('EXPORTED', OUT)
