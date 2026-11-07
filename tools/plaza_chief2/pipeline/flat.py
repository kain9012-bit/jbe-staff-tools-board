# 진단용: 조명 없이(텍스처 그대로) 얼굴 정면 렌더
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=a[0], forward_axis='Y', up_axis='Z')
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
m = bpy.data.materials.new('f'); m.use_nodes = True; nt = m.node_tree
for n in list(nt.nodes):
    if n.type == 'BSDF_PRINCIPLED': nt.nodes.remove(n)
em = nt.nodes.new('ShaderNodeEmission'); t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(a[2])
nt.links.new(t.outputs['Color'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
ob.data.materials.clear(); ob.data.materials.append(m)
for p in ob.data.polygons: p.use_smooth = True
bb = [ob.matrix_world @ Vector(c) for c in ob.bound_box]; ctr = sum(bb, Vector()) / 8; hgt = max(v.z for v in bb) - min(v.z for v in bb)
scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = 16; scn.view_settings.view_transform = 'Standard'
scn.render.resolution_x = scn.render.resolution_y = 512
w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.92, 0.95, 1)
cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); scn.collection.objects.link(cam); scn.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = hgt * 0.42; ctr = Vector((ctr.x, ctr.y, max(v.z for v in bb) - hgt * 0.24))
for ang in [int(x) for x in a[3].split(',')]:
    r = math.radians(ang); d = Vector((math.sin(r), -math.cos(r), 0)); cam.location = ctr + d * 6; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    scn.render.filepath = f'{a[1]}_{ang}.png'; bpy.ops.render.render(write_still=True)
