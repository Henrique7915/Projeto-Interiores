"""
Modelos GLB do Design3D, gerados por código no Blender (sem arquivos binários de origem).

Uso:  blender --background --python assets/blender/modelos.py [-- sofa-3 armchair ...]
Saída: assets/models/<nome>.glb

Convenções (iguais às do schema):
  - 1 unidade = 1 m; origem no centro da base; frente do móvel em +Z (glTF), topo em +Y.
  - No Blender (Z para cima) isso é: frente = -Y, topo = +Z. Os helpers P/S convertem de (x, altura, frente).
  - O nome do material é o nome do slot do catálogo (ex.: "upholstery"). O motor troca esses materiais
    pelos escolhidos na cena; materiais com outros nomes (folhas, caules) ficam como estão.
  - Sem UVs: o motor gera UVs em metros no carregamento, então a textura mantém a escala real.
O nome do arquivo é o nome do desenhista procedural (furniture/builders*.tsx): se o GLB não carregar, o motor usa o procedural.
"""
import math
import os
import sys

import bpy

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models')
os.makedirs(OUT, exist_ok=True)

_mats = {}


def mat(name, color=(0.8, 0.8, 0.8), rough=0.7, metal=0.0):
    if name not in _mats:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*color, 1)
        b.inputs['Roughness'].default_value = rough
        b.inputs['Metallic'].default_value = metal
        _mats[name] = m
    return _mats[name]


def P(x, y, z):
    return (x, -z, y)


def S(w, h, d):
    return (w, d, h)


def _finish(o, m, bevel=0.0, seg=3, subsurf=0):
    o.data.materials.append(mat(m) if isinstance(m, str) else m)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        md = o.modifiers.new('bevel', 'BEVEL')
        md.width = bevel
        md.segments = seg
        md.limit_method = 'NONE'
        md.profile = 0.7
        bpy.ops.object.modifier_apply(modifier=md.name)
    if subsurf:
        md = o.modifiers.new('sub', 'SUBSURF')
        md.levels = subsurf
        bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.ops.object.shade_smooth()
    if hasattr(o.data, 'use_auto_smooth'):
        o.data.use_auto_smooth = True
        o.data.auto_smooth_angle = math.radians(40)
    o.select_set(False)
    return o


def box(m, size, pos, bevel=0.01, seg=3, rot=(0, 0, 0)):
    """size=(largura, altura, profundidade); pos=(x, y de baixo pra cima, z para a frente) do CENTRO."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*pos))
    o = bpy.context.active_object
    o.scale = S(*size)
    o.rotation_euler = rot
    bv = min(bevel, min(size) / 2 * 0.9)
    return _finish(o, m, bv, seg)


def cyl(m, r, h, pos, r2=None, verts=24, rot=(0, 0, 0), bevel=0.0):
    if r2 is None or abs(r2 - r) < 1e-6:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=P(*pos))
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=h, vertices=verts, location=P(*pos))
    o = bpy.context.active_object
    o.rotation_euler = rot
    return _finish(o, m, bevel, 2)


def sph(m, scale, pos, rot=(0, 0, 0), sub=3):
    """scale=(rx, ry_altura, rz_frente)."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=14, location=P(*pos))
    o = bpy.context.active_object
    o.scale = S(*scale)
    o.rotation_euler = rot
    return _finish(o, m)


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    _mats.clear()
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def export(name):
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', export_apply=True, export_yup=True,
        export_cameras=False, export_lights=False, export_texcoords=False, export_extras=False,
    )
    print('GLB', name, os.path.getsize(path), 'bytes')


# ---------------------------------------------------------------------------

def sofa_3():
    w, h, d = 2.2, 0.85, 0.95
    leg_h, seat_h, arm, back = 0.12, 0.2, 0.2, 0.22
    inner = w - arm * 2
    cw = inner / 3
    mat('upholstery', (0.55, 0.57, 0.6), 0.9)
    mat('cushions', (0.83, 0.63, 0.17), 0.7)
    mat('legs', (0.42, 0.27, 0.19), 0.5)
    for sx in (-1, 1):
        for sz in (-1, 1):
            cyl('legs', 0.025, leg_h, (sx * (w / 2 - 0.1), leg_h / 2, sz * (d / 2 - 0.1)), r2=0.018, verts=12)
    box('upholstery', (w, seat_h, d), (0, leg_h + seat_h / 2, 0), 0.05, 4)
    ah = h - leg_h - 0.2
    for sx in (-1, 1):
        box('upholstery', (arm, ah, d), (sx * (w / 2 - arm / 2), leg_h + 0.2 + ah / 2 - 0.05, 0), 0.08, 4)
    bh = h - leg_h - seat_h
    box('upholstery', (inner, bh, back), (0, leg_h + seat_h + bh / 2 - 0.02, -d / 2 + back / 2), 0.08, 4)
    for i in range(3):
        box('upholstery', (cw - 0.012, 0.16, d - back - 0.04), (-inner / 2 + cw / 2 + i * cw, leg_h + seat_h + 0.08, back / 2 + 0.01), 0.06, 4)
        box('upholstery', (cw - 0.03, 0.4, 0.14), (-inner / 2 + cw / 2 + i * cw, leg_h + seat_h + 0.3, -d / 2 + back + 0.07), 0.06, 4, rot=(0.12, 0, 0))
    box('cushions', (0.42, 0.42, 0.14), (-inner / 2 + 0.28, leg_h + seat_h + 0.33, -d / 2 + back + 0.2), 0.06, 4, rot=(0.25, 0.1, 0.25))
    box('cushions', (0.4, 0.4, 0.14), (inner / 2 - 0.3, leg_h + seat_h + 0.31, -d / 2 + back + 0.19), 0.06, 4, rot=(0.25, -0.1, -0.2))
    export('sofa-3')


def armchair():
    w, h, d = 0.85, 0.85, 0.85
    mat('upholstery', (0.93, 0.92, 0.88), 0.95)
    mat('frame', (0.78, 0.6, 0.4), 0.55)
    for sx in (-1, 1):
        for sz in (-1, 1):
            cyl('frame', 0.028, 0.2, (sx * (w / 2 - 0.1), 0.1, sz * (d / 2 - 0.1)), r2=0.02, verts=12)
    box('upholstery', (w - 0.08, 0.2, d - 0.08), (0, 0.3, 0), 0.05, 4)
    for sx in (-1, 1):
        box('upholstery', (0.15, 0.3, d - 0.1), (sx * (w / 2 - 0.09), 0.5, 0), 0.06, 4)
        box('frame', (0.07, 0.03, d - 0.16), (sx * (w / 2 - 0.09), 0.665, 0.0), 0.012, 2)
    box('upholstery', (w - 0.08, 0.5, 0.17), (0, 0.58, -d / 2 + 0.1), 0.07, 4, rot=(0.14, 0, 0))
    box('upholstery', (w - 0.34, 0.12, d - 0.26), (0, 0.46, 0.06), 0.06, 4)
    export('armchair')


def bed_queen():
    w, h, d = 1.6, 1.0, 2.1
    mat('bedding', (0.9, 0.88, 0.82), 0.95)
    mat('accent', (0.77, 0.38, 0.18), 1.0)
    mat('frame', (0.42, 0.27, 0.19), 0.5)
    for sx in (-1, 1):
        for sz in (-1, 1):
            box('frame', (0.07, 0.15, 0.07), (sx * (w / 2 - 0.06), 0.075, sz * (d / 2 - 0.06)), 0.01, 2)
    box('frame', (w, 0.2, d), (0, 0.25, 0), 0.02, 3)
    box('frame', (w + 0.06, 0.95, 0.08), (0, 0.475, -d / 2 + 0.04), 0.03, 3)
    box('bedding', (w - 0.06, 0.22, d - 0.1), (0, 0.46, 0.03), 0.07, 4)
    for sx in (-1, 1):
        box('bedding', (0.62, 0.15, 0.38), (sx * 0.4, 0.66, -d / 2 + 0.34), 0.07, 4, rot=(0.25, 0, 0))
    box('bedding', (w - 0.03, 0.07, d * 0.62), (0, 0.6, 0.27), 0.03, 3)
    box('accent', (w - 0.01, 0.045, 0.55), (0, 0.66, 0.5), 0.02, 3)
    export('bed-queen')


def chair_dining():
    w, h, d = 0.46, 0.86, 0.5
    mat('frame', (0.42, 0.27, 0.19), 0.5)
    mat('seat', (0.77, 0.38, 0.18), 0.95)
    for sx in (-1, 1):
        box('frame', (0.04, h, 0.04), (sx * (w / 2 - 0.03), h / 2, -d / 2 + 0.03), 0.01, 2)
        box('frame', (0.04, 0.45, 0.04), (sx * (w / 2 - 0.03), 0.225, d / 2 - 0.03), 0.01, 2)
        box('frame', (0.025, 0.025, d - 0.1), (sx * (w / 2 - 0.03), 0.18, 0), 0.006, 2)
    box('frame', (w - 0.06, 0.03, 0.025), (0, 0.18, 0), 0.006, 2)
    box('seat', (w - 0.02, 0.06, d), (0, 0.46, 0), 0.025, 3)
    box('frame', (w - 0.06, 0.08, 0.025), (0, h - 0.05, -d / 2 + 0.03), 0.012, 3)
    box('frame', (w - 0.06, 0.06, 0.02), (0, h - 0.22, -d / 2 + 0.03), 0.01, 3)
    box('frame', (w - 0.06, 0.06, 0.02), (0, h - 0.34, -d / 2 + 0.03), 0.01, 3)
    export('chair-dining')


def plant_monstera():
    w, h = 0.7, 1.4
    mat('pot', (0.72, 0.66, 0.56), 0.9)
    mat('stem', (0.25, 0.42, 0.2), 0.7)
    mat('leaf', (0.18, 0.42, 0.18), 0.55)
    mat('soil', (0.17, 0.12, 0.09), 1.0)
    cyl('pot', 0.2, 0.38, (0, 0.19, 0), r2=0.27, verts=32, bevel=0.012)
    cyl('soil', 0.255, 0.02, (0, 0.375, 0), verts=24)
    n = 11
    for i in range(n):
        a = i * 2.39996  # ângulo áureo
        t = i / (n - 1)
        ph = 0.5 + t * 0.82          # altura da folha
        reach = 0.1 + 0.2 * (1 - t) + 0.06
        x, z = math.cos(a) * reach, math.sin(a) * reach
        # caule do vaso até a folha (cilindro inclinado)
        top = (x, ph * h * 0.95, z)
        base = (x * 0.15, 0.38, z * 0.15)
        mid = tuple((b + c) / 2 for b, c in zip(base, top))
        dx, dy, dz = top[0] - base[0], top[1] - base[1], top[2] - base[2]
        L = math.sqrt(dx * dx + dy * dy + dz * dz)
        ang_x = math.atan2(dz, dy)    # rotação em torno de X (glTF) → X do Blender
        ang_z = -math.atan2(dx, dy)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.011, depth=L, vertices=8, location=P(*mid))
        o = bpy.context.active_object
        o.rotation_euler = (-ang_x, 0, ang_z) if False else (0, 0, 0)
        # orienta o cilindro: eixo Z do Blender → direção (dx,-dz,dy) em coordenadas do Blender
        from mathutils import Vector
        dirv = Vector((dx, -dz, dy)).normalized()
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(dirv)
        _finish(o, 'stem')
        # folha: elipsoide achatado cujo eixo longo aponta para fora do caule e cai um pouco
        from mathutils import Euler, Matrix
        ln = 0.2 + 0.03 * ((i * 7) % 3)
        wd = ln * 0.82
        droop = 0.55 - 0.35 * t
        c = (top[0] + math.cos(a) * ln * 0.8, top[1] - math.sin(droop) * ln * 0.5 + 0.02, top[2] + math.sin(a) * ln * 0.8)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=20, ring_count=10, location=P(*c))
        lf = bpy.context.active_object
        lf.scale = (ln, wd, 0.012)
        lf.rotation_euler = (Matrix.Rotation(-a, 3, 'Z') @ Euler((0, droop, 0)).to_matrix()).to_euler()
        _finish(lf, 'leaf')
    export('plant-monstera')


def toilet():
    w, h, d = 0.4, 0.78, 0.7
    mat('ceramic', (0.97, 0.97, 0.96), 0.12)
    mat('seat', (0.96, 0.96, 0.95), 0.35)
    tank_h = h - 0.42
    cyl('ceramic', 0.1, 0.26, (0, 0.13, d / 2 - d * 0.36), r2=0.13, verts=24)
    sph('ceramic', (w * 0.5, 0.17, d * 0.4), (0, 0.27, d / 2 - d * 0.4))
    sph('seat', (w * 0.5 + 0.012, 0.025, d * 0.4 + 0.012), (0, 0.43, d / 2 - d * 0.4))
    box('ceramic', (w, tank_h, 0.2), (0, 0.42 + tank_h / 2, -d / 2 + 0.1), 0.03, 4)
    box('ceramic', (w + 0.02, 0.025, 0.22), (0, h + 0.012, -d / 2 + 0.1), 0.01, 2)
    cyl('seat', 0.022, 0.012, (0, h + 0.03, -d / 2 + 0.1), verts=16)
    export('toilet')


def sofa_chaise():
    w, h, d = 2.5, 0.85, 1.6
    leg_h, base_h, arm = 0.12, 0.3, 0.14
    sd, cw = 0.95, 0.85
    top = leg_h + base_h
    mat('upholstery', (0.55, 0.57, 0.6), 0.9)
    mat('cushions', (0.83, 0.63, 0.17), 0.7)
    mat('legs', (0.42, 0.27, 0.19), 0.5)
    for sx in (-1, 1):
        for sz in (-1, 1):
            if sx < 0 and sz > 0:
                continue  # sem perna onde não há corpo (a chaise fica só à direita)
            cyl('legs', 0.03, leg_h, (sx * (w / 2 - 0.1), leg_h / 2, sz * (d / 2 - 0.1)), r2=0.022, verts=12)
    box('upholstery', (w, base_h, sd), (0, leg_h + base_h / 2, -d / 2 + sd / 2), 0.04, 4)
    box('upholstery', (cw, base_h, d - sd), (w / 2 - cw / 2, leg_h + base_h / 2, -d / 2 + sd + (d - sd) / 2), 0.04, 4)
    box('upholstery', (w, h - top, 0.22), (0, top + (h - top) / 2, -d / 2 + 0.11), 0.07, 4)
    box('upholstery', (arm, 0.3, sd - 0.1), (-w / 2 + arm / 2, top + 0.15, -d / 2 + sd / 2 + 0.05), 0.05, 4)
    n = 3
    cwid = (w - cw - arm) / n
    for i in range(n):
        x = -w / 2 + arm + cwid * (i + 0.5)
        box('upholstery', (cwid - 0.02, 0.14, sd - 0.24), (x, top + 0.07, -d / 2 + sd / 2 + 0.07), 0.05, 4)
        box('upholstery', (cwid - 0.04, 0.36, 0.15), (x, top + 0.2, -d / 2 + 0.3), 0.06, 4, rot=(0.18, 0, 0))
    box('upholstery', (cw - 0.02, 0.14, d - sd - 0.02), (w / 2 - cw / 2, top + 0.07, -d / 2 + sd + (d - sd) / 2), 0.05, 4)
    box('cushions', (0.4, 0.4, 0.13), (-w / 2 + arm + 0.3, top + 0.33, -d / 2 + sd / 2 + 0.12), 0.05, 4, rot=(0.3, 0.1, 0.25))
    export('sofa-chaise')


def dresser():
    w, h, d = 1.0, 0.85, 0.5
    leg_h = 0.12
    bh = h - leg_h
    mat('body', (0.82, 0.72, 0.58), 0.55)
    mat('handles', (0.79, 0.63, 0.29), 0.3, 0.9)
    for sx in (-1, 1):
        for sz in (-1, 1):
            cyl('body', 0.03, leg_h, (sx * (w / 2 - 0.06), leg_h / 2, sz * (d / 2 - 0.06)), r2=0.02, verts=12)
    box('body', (w, bh, d), (0, leg_h + bh / 2, 0), 0.015, 3)
    rows = 4
    rh = bh / rows
    for r in range(rows):
        y = leg_h + rh * (r + 0.5)
        box('body', (w - 0.025, rh - 0.02, 0.02), (0, y, d / 2 + 0.004), 0.006, 2)
        cyl('handles', 0.011, 0.016, (-0.1, y + 0.02, d / 2 + 0.025), verts=12, rot=(math.pi / 2, 0, 0))
        cyl('handles', 0.011, 0.016, (0.1, y + 0.02, d / 2 + 0.025), verts=12, rot=(math.pi / 2, 0, 0))
    export('dresser')


def garden_bench():
    w, h, d = 1.5, 0.85, 0.55
    seat_h = h * 0.5
    mat('frame', (0.11, 0.11, 0.12), 0.45, 0.7)
    mat('slats', (0.55, 0.38, 0.2), 0.6)
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.06)
        box('frame', (0.05, seat_h, d), (x, seat_h / 2, 0), 0.01, 2)
        box('frame', (0.05, h - seat_h * 0.8, 0.05), (x, seat_h * 0.8 + (h - seat_h * 0.8) / 2, -d / 2 + 0.06), 0.01, 2, rot=(0.2, 0, 0))
        box('frame', (0.06, 0.04, d), (x, seat_h * 0.95, 0), 0.01, 2)
    for i in range(4):
        box('slats', (w, 0.03, (d - 0.04) / 4 - 0.012), (0, seat_h, -d / 2 + 0.1 + i * (d - 0.12) / 3), 0.006, 2)
    for i in range(3):
        box('slats', (w, 0.08, 0.025), (0, seat_h + 0.18 + i * 0.12, -d / 2 + 0.06 - i * 0.02), 0.006, 2, rot=(0.2, 0, 0))
    export('garden-bench')


def plant_fern():
    w, h = 0.7, 0.9
    from mathutils import Euler, Matrix
    mat('pot', (0.72, 0.4, 0.28), 0.85)
    mat('foliage', (0.2, 0.5, 0.2), 0.6)
    mat('soil', (0.17, 0.12, 0.09), 1.0)
    ph = h * 0.28
    cyl('pot', w * 0.28, ph, (0, ph / 2, 0), r2=w * 0.34, verts=32, bevel=0.01)
    cyl('soil', w * 0.3, 0.02, (0, ph, 0), verts=24)
    n = 18
    for i in range(n):
        a = i * 2.39996
        tier = i % 3
        ln = (h - ph) * (0.85 + 0.12 * ((i * 5) % 3)) * (1.0 - 0.12 * tier)
        tilt = 0.5 + 0.18 * tier + 0.05 * (i % 4)
        # centro da fronda: parte do pé do vaso e sobe/cai para fora
        out = math.sin(tilt) * ln * 0.5
        up = math.cos(tilt) * ln * 0.5
        c = (math.cos(a) * out, ph + up, math.sin(a) * out)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=16, ring_count=8, location=P(*c))
        lf = bpy.context.active_object
        lf.scale = (0.04 + 0.01 * tier, ln * 0.5, 0.008)
        lf.rotation_euler = (Matrix.Rotation(-a + math.pi / 2, 3, 'Z') @ Euler((-tilt, 0, 0)).to_matrix()).to_euler()
        _finish(lf, 'foliage')
    export('plant-fern')


MODELS = {
    'sofa-3': sofa_3, 'armchair': armchair, 'bed-queen': bed_queen,
    'chair-dining': chair_dining, 'plant-monstera': plant_monstera, 'toilet': toilet,
    'sofa-chaise': sofa_chaise, 'dresser': dresser, 'garden-bench': garden_bench, 'plant-fern': plant_fern,
}

if __name__ == '__main__':
    only = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(MODELS)
    for n in only:
        clear()
        MODELS[n]()
