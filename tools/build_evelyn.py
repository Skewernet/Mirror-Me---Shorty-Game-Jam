"""Build Evelyn's rigged glTF from CC0 MakeHuman assets, using Blender 4.3 + MPFB.

Run: XDG_CONFIG_HOME=/tmp/evelyn-blender blender -b --python-exit-code 1 \
  --python tools/build_evelyn.py -- --mpfb /path/to/mpfb2/src \
  --assets /path/to/unpacked/mh_system_CC0 --output assets/character/evelyn.glb

The source assets and exact revisions are documented in assets/character/README.md.
No network requests, executable downloads, or proprietary data are used by this build.
"""
import argparse
import hashlib
import json
import math
import os
import shutil
import struct
from pathlib import Path
import sys

import bpy
from mathutils import Vector, Matrix


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mpfb", type=Path, required=True)
    parser.add_argument("--assets", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--preview", type=Path)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:])


args = arguments()
args.output = args.output.resolve()
args.assets = args.assets.resolve()
args.output.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(args.mpfb.resolve() / "mpfb/data/textures/mpfb_inside-mouth.jpg",
                args.output.parent / "inside-mouth-mask.jpg")
sys.path.insert(0, str(args.mpfb.resolve()))
# MPFB is also usable as a legacy addon. In a headless build there is no installed
# extension repository, so provide its user-data location explicitly in our cache.
cache = Path(os.environ.get("XDG_CONFIG_HOME", "/tmp/evelyn-blender")) / "mpfb"
cache.mkdir(parents=True, exist_ok=True)
bpy.utils.extension_path_user = lambda package, **kwargs: str(cache)
import mpfb  # noqa: E402
bpy.ops.preferences.addon_enable(module="mpfb")
from mpfb.services.humanservice import HumanService  # noqa: E402
from mpfb.services.targetservice import TargetService  # noqa: E402
from mpfb.services.exportservice import ExportService  # noqa: E402

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

# 0 is female; .5 is young adult, not a percentage of chronological age.
# Elderly macro morphology and the old-female skin supply age; portrait-led facial targets retain her identity.
macro = TargetService.get_default_macro_info_dict()
macro.update(gender=0.0, age=0.94, weight=0.59, muscle=0.24, height=0.38,
             cupsize=0.35, proportions=0.46, firmness=0.24)
macro["race"] = {"caucasian": 0.94, "asian": 0.04, "african": 0.02}
human = HumanService.create_human(macro_detail_dict=macro)
human.name = "Evelyn_Skin"
HumanService.set_character_skin(str(args.assets / "skins/old_caucasian_female/old_caucasian_female.mhmat"),
                                human, skin_type="GAMEENGINE")
# The portrait supplies a broad oval face, full cheeks and a strong nose.
# These are independently fitted authored choices, not a cloned daughter mesh.
face_targets = {
    "head/head-oval.target.gz": .24,
    "head/head-age-incr.target.gz": .38,
    "head/head-scale-horiz-incr.target.gz": .13,
    "head/head-fat-incr.target.gz": .10,
    "nose/nose-width1-incr.target.gz": .13,
    "nose/nose-hump-incr.target.gz": .10,
    "chin/chin-width-incr.target.gz": .12,
    "cheek/l-cheek-volume-incr.target.gz": .17,
    "cheek/r-cheek-volume-incr.target.gz": .17,
}
for relative, value in face_targets.items():
    TargetService.load_target(human, str(args.mpfb / "mpfb/data/targets" / relative), weight=value)
rig = HumanService.add_builtin_rig(human, "game_engine")
rig.name = "Evelyn_Rig"


def add(relative, kind, name, subdiv=1):
    obj = HumanService.add_mhclo_asset(str(args.assets / relative), human,
                                     asset_type=kind, material_type="GAMEENGINE",
                                     subdiv_levels=subdiv)
    obj.name = name
    return obj


eyes = add("eyes/high-poly/high-poly.mhclo", "Eyes", "Evelyn_Eyes", 1)
brows = add("eyebrows/eyebrow001/eyebrow001.mhclo", "Eyebrows", "Evelyn_Brows", 0)
lashes = add("eyelashes/eyelashes01/eyelashes01.mhclo", "Eyelashes", "Evelyn_Lashes", 0)
hair = add("hair/short02/short02.mhclo", "Hair", "Evelyn_Hair", 1)
# Clothing names describe the template, not the wearer's anatomy. MPFB refits this
# loose, long-sleeved blouse, jeans and lace-ups to Evelyn's actual female mesh.
clothes = add("clothes/female_elegantsuit01/female_elegantsuit01.mhclo", "Clothes", "Evelyn_Clothes", 1)
shoes = add("clothes/shoes04/shoes04.mhclo", "Clothes", "Evelyn_Shoes", 1)


def principled(obj, roughness, name):
    material = obj.data.materials[0]
    material.name = name
    node = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Metallic"].default_value = 0
    node.inputs["Specular IOR Level"].default_value = 0.32
    return material, node


skin_mat, skin_node = principled(human, 0.64, "Evelyn_Skin_Material")
skin_node.inputs["Subsurface Weight"].default_value = 0.045
skin_node.inputs["Subsurface Radius"].default_value = (1.0, 0.43, 0.25)
principled(eyes, 0.18, "Evelyn_Eyes_Material")
hair_mat, hair_node = principled(hair, 0.54, "Evelyn_Hair_Material")
# The distinct short02 wavy hair atlas is ash/chestnut with runtime gray strands.
# The runtime multiplies the same tint after import for consistent WebGL shading.
hair_mat.diffuse_color = (0.52, 0.44, 0.36, 1)
hair_mat.use_backface_culling = False
hair["tint"] = "ash chestnut and gray"
cloth_mat, cloth_node = principled(clothes, 0.86, "Evelyn_Clothes_Material")
cloth_diffuse = next(n for n in cloth_mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.name == "DiffuseTexture")
# Preserve the distinct fitted skirt/blouse mesh. Runtime original floral shader dresses it in the portrait palette.
principled(brows, 0.85, "Evelyn_Brows_Material")
principled(lashes, 0.9, "Evelyn_Lashes_Material")
principled(shoes, 0.72, "Evelyn_Shoes_Material")
for obj in [human, clothes, shoes]:
    material = obj.data.materials[0]
    node = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    for link in list(node.inputs["Alpha"].links):
        material.node_tree.links.remove(link)
    node.inputs["Alpha"].default_value = 1

# Bake the face and fitted clothing; no macro target arrays or helper cubes reach
# the browser. The smooth anatomical surface, UVs and weights remain intact.
if human.data.shape_keys:
    mixed = human.shape_key_add(name="Baked_Evelyn", from_mix=True)
    coords = [point.co.copy() for point in mixed.data]
    human.shape_key_clear()
    for vertex, co in zip(human.data.vertices, coords):
        vertex.co = co
# A real anatomical expression, preserved through helper removal/subdivision.
# This target comes from MPFB's CC0 facial data and opens the existing lips and
# oral topology rather than painting a round black mark over a closed face.
human.shape_key_add(name="Basis", from_mix=False)
jaw_path = args.mpfb.resolve() / "mpfb/data/targets/expression/units/caucasian/mouth-open.target.gz"
jaw = TargetService.load_target(human, str(jaw_path), name="Evelyn_Jaw_Open", weight=0)
basis = human.data.shape_keys.key_blocks["Basis"]
for original, point in zip(basis.data, jaw.data):
    point.co = original.co + (point.co - original.co) * 1.35
jaw.slider_max = 1.0
for side in ("left", "right"):
    TargetService.load_target(human, str(args.mpfb / ("mpfb/data/targets/expression/units/caucasian/eye-" + side + "-closure.target.gz")), name="Evelyn_Eye_" + side + "_Closed", weight=0)

sub = human.modifiers.new("Anatomical_Surface", "SUBSURF")
sub.levels = sub.render_levels = 1
ExportService.bake_modifiers_remove_helpers(human, bake_masks=True, bake_subdiv=True,
                                           remove_helpers=True, also_proxy=True)
for obj in [eyes, brows, lashes, hair, clothes, shoes]:
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        if modifier.type in {"SUBSURF", "MASK"}:
            if modifier.type == "SUBSURF" and modifier.levels == 0:
                obj.modifiers.remove(modifier)
            else:
                bpy.ops.object.modifier_apply(modifier=modifier.name)

# Normalize the actual model to 1.62m, including shoes and hair.
bpy.context.view_layer.update()
objects = [human, eyes, brows, lashes, hair, clothes, shoes]
points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
low, high = min(p.z for p in points), max(p.z for p in points)
factor = 1.62 / (high - low)
rig.scale = (factor,) * 3
rig.location.z = -low * factor
bpy.context.view_layer.update()

# An ordinary, lowered-arm resting pose. Preserve the game rig and its finger,
# neck, ankle and toe bones for runtime animation. Current pose is exported
# as glTF rest, and Three applies small local offsets relative to that pose.
for suffix, sign in [("l", 1), ("r", -1)]:
    upper = rig.pose.bones[f"upperarm_{suffix}"]
    lower = rig.pose.bones[f"lowerarm_{suffix}"]
    for bone, desired in [(upper, Vector((sign * 0.045, 0.009, -0.255))),
                          (lower, Vector((sign * 0.006, -0.025, -0.235)))]:
        bpy.context.view_layer.update()
        delta = (bone.tail - bone.head).rotation_difference(desired)
        origin = bone.head.copy()
        bone.matrix = Matrix.Translation(origin) @ delta.to_matrix().to_4x4() @ Matrix.Translation(-origin) @ bone.matrix
    bpy.context.view_layer.update()

# Enforce alpha cutouts, not sorted transparent shells, for hair and fine lashes.
for obj in [hair, brows, lashes]:
    for material in obj.data.materials:
        material.surface_render_method = "DITHERED"
        material.use_backface_culling = False
for obj in objects:
    for polygon in obj.data.polygons:
        polygon.use_smooth = True

rig["identity"] = "Evelyn Vale"
rig["heightMeters"] = 1.62
rig["source"] = "MakeHuman / MPFB CC0 assets; see assets/character/README.md"
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(args.output), export_format="GLB", use_selection=True,
                          export_animations=False, export_rest_position_armature=False,
                          export_skins=True, export_morph=True, export_extras=True,
                          export_image_format="JPEG", export_image_quality=90,
                          export_jpeg_quality=90, export_yup=True,
                          export_materials="EXPORT", export_cameras=False, export_lights=False)

# glTF has an explicit mask mode. Blender 4.3's DITHERED material maps to BLEND;
# make the portable PBR intent explicit without touching any image pixels.
data = args.output.read_bytes()
json_length, _ = struct.unpack_from("<II", data, 12)
gltf = json.loads(data[20:20 + json_length])
for material in gltf["materials"]:
    cutout = any(name in material["name"] for name in ["Hair", "Brows", "Lashes", "Eyes"])
    material["alphaMode"] = "MASK" if cutout else "OPAQUE"
    if cutout:
        material["alphaCutoff"] = 0.1 if "Eyes" in material["name"] else 0.35
        material["doubleSided"] = True
    if "Hair" in material["name"]:
        material["pbrMetallicRoughness"]["baseColorFactor"] = [0.52, 0.44, 0.36, 1]
json_bytes = json.dumps(gltf, separators=(",", ":")).encode()
json_bytes += b" " * (-len(json_bytes) % 4)
binary_tail = data[20 + json_length:]
length = 12 + 8 + len(json_bytes) + len(binary_tail)
args.output.write_bytes(struct.pack("<III", 0x46546C67, 2, length)
                        + struct.pack("<II", len(json_bytes), 0x4E4F534A)
                        + json_bytes + binary_tail)

evaluated_eyes = eyes.evaluated_get(bpy.context.evaluated_depsgraph_get())
eye_mesh = evaluated_eyes.to_mesh()
eye_points = [evaluated_eyes.matrix_world @ v.co for v in eye_mesh.vertices]
eye_height = (min(p.z for p in eye_points) + max(p.z for p in eye_points)) / 2
evaluated_eyes.to_mesh_clear()
metadata = {"identity": "Evelyn Vale", "heightMeters": 1.62,
            "eyeHeightMeters": eye_height,
            "triangles": sum(len(p.vertices) - 2 for o in objects for p in o.data.polygons),
            "meshVertices": sum(len(o.data.vertices) for o in objects),
            "bones": len(rig.data.bones), "macro": macro, "faceTargets": face_targets, "ageYears":68, "portraitReference":"assets/art/family-photographs.png (mother at left)", "independentBuild":True,
            "morphTargets": ["Evelyn_Jaw_Open", "Evelyn_Eye_left_Closed", "Evelyn_Eye_right_Closed"],
            "sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
            "rigBones": [b.name for b in rig.data.bones]}
args.output.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n")
print("EVELYN_BUILD", json.dumps(metadata))

if args.preview:
    # Diagnostic studio render, kept outside the production checkout.
    diffuse_link = hair_node.inputs["Base Color"].links[0]
    diffuse = diffuse_link.from_socket
    hair_mat.node_tree.links.remove(diffuse_link)
    multiply = hair_mat.node_tree.nodes.new("ShaderNodeMixRGB")
    multiply.blend_type = "MULTIPLY"
    multiply.inputs[0].default_value = 1
    multiply.inputs[2].default_value = (0.30, 0.25, 0.20, 1)
    hair_mat.node_tree.links.new(diffuse, multiply.inputs[1])
    hair_mat.node_tree.links.new(multiply.outputs[0], hair_node.inputs["Base Color"])
    bpy.ops.object.camera_add(location=(1.8, -3.3, 1.45))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, 1.15)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera
    camera.data.lens = 52
    for location, energy, size in [((1, -2, 3), 220, 3), ((-2, -1, 2), 100, 2), ((1, 2, 2), 160, 2)]:
        bpy.ops.object.light_add(type="AREA", location=location)
        lamp = bpy.context.object
        lamp.data.energy, lamp.data.shape, lamp.data.size = energy, "DISK", size
        lamp.rotation_euler = (Vector((0, 0, 1.1)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.render.resolution_x, scene.render.resolution_y = 600, 800
    scene.render.resolution_percentage = 100
    scene.world.color = (0.12, 0.12, 0.12)
    scene.render.filepath = str(args.preview)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.preview.with_suffix(".blend")))
    bpy.ops.render.render(write_still=True)
