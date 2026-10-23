"""Build Mara's rigged glTF from CC0 MakeHuman assets, using Blender 4.3 + MPFB.

Run: XDG_CONFIG_HOME=/tmp/mara-blender blender -b --python-exit-code 1 \
  --python tools/build_character.py -- --mpfb /path/to/mpfb2/src \
  --assets /path/to/unpacked/mh_system_CC0 --output assets/character/mara.glb

The source assets and exact revisions are documented in assets/character/README.md.
No network requests, executable downloads, or proprietary data are used by this build.
"""
import argparse
import hashlib
import json
import math
import os
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
sys.path.insert(0, str(args.mpfb.resolve()))
# MPFB is also usable as a legacy addon. In a headless build there is no installed
# extension repository, so provide its user-data location explicitly in our cache.
cache = Path(os.environ.get("XDG_CONFIG_HOME", "/tmp/mara-blender")) / "mpfb"
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
# A small middle-age blend gives an adult face, and keeps her ordinary and human.
macro = TargetService.get_default_macro_info_dict()
macro.update(gender=0.0, age=0.55, weight=0.48, muscle=0.38, height=0.65,
             cupsize=0.35, proportions=0.5, firmness=0.5)
macro["race"] = {"caucasian": 0.65, "asian": 0.20, "african": 0.15}
human = HumanService.create_human(macro_detail_dict=macro)
human.name = "Mara_Skin"
HumanService.set_character_skin(str(args.assets / "skins/young_caucasian_female/young_caucasian_female.mhmat"),
                                human, skin_type="GAMEENGINE")
rig = HumanService.add_builtin_rig(human, "game_engine")
rig.name = "Mara_Rig"


def add(relative, kind, name, subdiv=1):
    obj = HumanService.add_mhclo_asset(str(args.assets / relative), human,
                                     asset_type=kind, material_type="GAMEENGINE",
                                     subdiv_levels=subdiv)
    obj.name = name
    return obj


eyes = add("eyes/high-poly/high-poly.mhclo", "Eyes", "Mara_Eyes", 1)
brows = add("eyebrows/eyebrow001/eyebrow001.mhclo", "Eyebrows", "Mara_Brows", 0)
lashes = add("eyelashes/eyelashes01/eyelashes01.mhclo", "Eyelashes", "Mara_Lashes", 0)
hair = add("hair/bob02/bob02.mhclo", "Hair", "Mara_Hair", 1)
# Clothing names describe the template, not the wearer's anatomy. MPFB refits this
# loose, long-sleeved blouse, jeans and lace-ups to Mara's actual female mesh.
clothes = add("clothes/male_casualsuit01/male_casualsuit01.mhclo", "Clothes", "Mara_Clothes", 1)
shoes = add("clothes/shoes03/shoes03.mhclo", "Clothes", "Mara_Shoes", 1)


def principled(obj, roughness, name):
    material = obj.data.materials[0]
    material.name = name
    node = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Metallic"].default_value = 0
    node.inputs["Specular IOR Level"].default_value = 0.32
    return material, node


skin_mat, skin_node = principled(human, 0.64, "Mara_Skin_Material")
skin_node.inputs["Subsurface Weight"].default_value = 0.045
skin_node.inputs["Subsurface Radius"].default_value = (1.0, 0.43, 0.25)
principled(eyes, 0.18, "Mara_Eyes_Material")
hair_mat, hair_node = principled(hair, 0.54, "Mara_Hair_Material")
# Blonde hair texture is a strand atlas: tint its luminance to dark chestnut.
# The runtime multiplies the same tint after import for consistent WebGL shading.
hair_mat.diffuse_color = (0.13, 0.064, 0.036, 1)
hair_mat.use_backface_culling = False
hair["tint"] = "chestnut"
cloth_mat, cloth_node = principled(clothes, 0.86, "Mara_Clothes_Material")
cloth_diffuse = next(n for n in cloth_mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.name == "DiffuseTexture")
cloth_diffuse.image = bpy.data.images.load(str(args.assets / "clothes/male_casualsuit01/toigo_male_casual_suit_01_red_shirt_with_black_jeans/male_casualsuit01_RedShirt-BlackJeans.png"), check_existing=True)
principled(brows, 0.85, "Mara_Brows_Material")
principled(lashes, 0.9, "Mara_Lashes_Material")
principled(shoes, 0.72, "Mara_Shoes_Material")
for obj in [human, clothes, shoes]:
    material = obj.data.materials[0]
    node = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    for link in list(node.inputs["Alpha"].links):
        material.node_tree.links.remove(link)
    node.inputs["Alpha"].default_value = 1

# Bake the face and fitted clothing; no macro target arrays or helper cubes reach
# the browser. The smooth anatomical surface, UVs and weights remain intact.
if human.data.shape_keys:
    mixed = human.shape_key_add(name="Baked_Mara", from_mix=True)
    coords = [point.co.copy() for point in mixed.data]
    human.shape_key_clear()
    for vertex, co in zip(human.data.vertices, coords):
        vertex.co = co
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

# Normalize the actual model to 1.74m, including shoes and hair.
bpy.context.view_layer.update()
objects = [human, eyes, brows, lashes, hair, clothes, shoes]
points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
low, high = min(p.z for p in points), max(p.z for p in points)
factor = 1.74 / (high - low)
rig.scale = (factor,) * 3
rig.location.z = -low * factor
bpy.context.view_layer.update()

# An ordinary, lowered-arm resting pose. Preserve the game rig and its finger,
# neck, eye, ankle and jaw bones for runtime animation. Current pose is exported
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

rig["identity"] = "Mara Vale"
rig["heightMeters"] = 1.74
rig["source"] = "MakeHuman / MPFB CC0 assets; see assets/character/README.md"
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True)
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(args.output), export_format="GLB", use_selection=True,
                          export_animations=False, export_rest_position_armature=False,
                          export_skins=True, export_morph=False, export_extras=True,
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
        material["pbrMetallicRoughness"]["baseColorFactor"] = [0.13, 0.064, 0.036, 1]
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
metadata = {"identity": "Mara Vale", "heightMeters": 1.74,
            "eyeHeightMeters": eye_height,
            "triangles": sum(len(p.vertices) - 2 for o in objects for p in o.data.polygons),
            "meshVertices": sum(len(o.data.vertices) for o in objects),
            "bones": len(rig.data.bones), "macro": macro,
            "sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
            "rigBones": [b.name for b in rig.data.bones]}
args.output.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n")
print("MARA_BUILD", json.dumps(metadata))

if args.preview:
    # Diagnostic studio render, kept outside the production checkout.
    diffuse_link = hair_node.inputs["Base Color"].links[0]
    diffuse = diffuse_link.from_socket
    hair_mat.node_tree.links.remove(diffuse_link)
    multiply = hair_mat.node_tree.nodes.new("ShaderNodeMixRGB")
    multiply.blend_type = "MULTIPLY"
    multiply.inputs[0].default_value = 1
    multiply.inputs[2].default_value = (0.13, 0.064, 0.036, 1)
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
