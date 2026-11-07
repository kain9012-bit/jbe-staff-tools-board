# 머리 없는 정장 몸(정면) 렌더 — 그림 후보의 밑그림용
import bpy, sys, math
from mathutils import Vector
out = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/tmp/claude-0/viewer/chief.glb')
for o in list(bpy.data.objects):
    if o.type == 'MESH' and (o.name.startswith('ChiefHead') or o.name.startswith('Glasses')):
        bpy.data.objects.remove(o)
scn = bpy.context.scene; scn.render.engine = 'CYCLES'; scn.cycles.samples = 32
scn.render.resolution_x, scn.render.resolution_y = 512, 768
scn.render.film_transparent = True
w = bpy.data.worlds.new('w'); scn.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 1.2
cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); scn.collection.objects.link(cam); scn.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.05
cam.location = (0, -6, 0.95); cam.rotation_euler = (math.pi / 2, 0, 0)
for rot, e in (((0.9, 0, -0.5), 2.5), ((1.2, 0, 0.8), 1.0)):
    lt = bpy.data.objects.new('l', bpy.data.lights.new('l', 'SUN')); scn.collection.objects.link(lt); lt.data.energy = e; lt.rotation_euler = rot
scn.render.filepath = out; bpy.ops.render.render(write_still=True)
