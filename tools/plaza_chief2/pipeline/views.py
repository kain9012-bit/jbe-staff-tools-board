# 옆·뒤 모습 렌더(조명 없이 텍스처 그대로, 투명 배경) — 정사영 카메라 값도 함께 저장
import bpy, sys, math, json
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
obj, tex, out = a[0], a[1], a[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=obj, forward_axis='Y', up_axis='Z')
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
m = bpy.data.materials.new('f'); m.use_nodes = True; nt = m.node_tree
for n in list(nt.nodes):
    if n.type == 'BSDF_PRINCIPLED': nt.nodes.remove(n)
em = nt.nodes.new('ShaderNodeEmission'); t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(tex)
nt.links.new(t.outputs['Color'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
ob.data.materials.clear(); ob.data.materials.append(m)
for p in ob.data.polygons: p.use_smooth = True
bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]; ctr = sum(bb, Vector()) / 8; hgt = max(v.z for v in bb) - min(v.z for v in bb)
scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = 8; scn.view_settings.view_transform = 'Standard'
scn.render.resolution_x, scn.render.resolution_y = 512, 768; scn.render.film_transparent = True
cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); scn.collection.objects.link(cam); scn.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = hgt * 1.08
meta = {}
for ang in (90, 180, 270, 45, 315, 135, 225):
    r = math.radians(ang); d = Vector((math.sin(r), -math.cos(r), 0))
    cam.location = ctr + d * 6; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    scn.render.filepath = f'{out}_{ang}.png'; bpy.ops.render.render(write_still=True)
    meta[ang] = {'d': list(d), 'ctr': list(ctr), 'scale': hgt * 1.08, 'W': 512, 'H': 768}
json.dump(meta, open(out + '_meta.json', 'w'))
