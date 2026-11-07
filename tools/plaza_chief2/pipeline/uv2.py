import bpy, sys
src, dst, nf = sys.argv[sys.argv.index('--') + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.ply_import(filepath=src)
ob = bpy.context.selected_objects[0]; bpy.context.view_layer.objects.active = ob
md = ob.modifiers.new('d', 'DECIMATE'); md.ratio = min(1.0, int(nf) / len(ob.data.polygons)); bpy.ops.object.modifier_apply(modifier='d')
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.4, island_margin=0.003)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.obj_export(filepath=dst, export_selected_objects=True, export_uv=True, export_normals=False, export_colors=False, export_materials=False, forward_axis='Y', up_axis='Z')
print('faces', len(ob.data.polygons))
