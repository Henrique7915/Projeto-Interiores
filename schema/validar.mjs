#!/usr/bin/env node
// Valida cenas do Design3D: JSON Schema + regras de consistência que o schema não expressa.
// Uso: node validar.mjs <cena.json> [...]      (sai com código 1 se houver erro)
// Se ../assets/catalog.json existir, ele é validado e as cenas são conferidas contra ele.
// Também exporta validateScene(scene, { catalog }) e validateCatalog(catalog) para o app e o servidor MCP.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
const sceneSchema = JSON.parse(readFileSync(join(here, "scene.schema.json"), "utf8"));
const catalogSchema = JSON.parse(readFileSync(join(here, "catalog.schema.json"), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(sceneSchema);
ajv.addSchema(catalogSchema);
const validateSchema = ajv.getSchema(sceneSchema.$id);
const validateCatalogSchema = ajv.getSchema(catalogSchema.$id);

const schemaErrors = (fn) =>
  fn.errors.map((e) => {
    const extra = e.params?.additionalProperty ?? e.params?.allowedValues?.join(", ");
    return `schema ${e.instancePath || "/"}: ${e.message}${extra ? ` (${extra})` : ""}`;
  });

/** Valida um catálogo (assets/catalog.json): schema + ids únicos + materiais de slots existentes. */
export function validateCatalog(catalog) {
  if (!validateCatalogSchema(catalog)) return { valid: false, errors: schemaErrors(validateCatalogSchema), warnings: [] };
  const errors = [];
  const seen = new Set();
  const mats = catalog.materials ?? {};
  for (const [i, item] of catalog.items.entries()) {
    if (seen.has(item.id)) errors.push(`/items/${i}: id '${item.id}' repetido`);
    seen.add(item.id);
    for (const [slot, def] of Object.entries(item.materialSlots ?? {}))
      if (!mats[def.default]) errors.push(`/items/${i}: slot '${slot}' de '${item.id}' usa material inexistente '${def.default}'`);
  }
  for (const [id, m] of Object.entries(mats))
    if (m.base && !mats[m.base]) errors.push(`/materials/${id}: base inexistente '${m.base}'`);
  return { valid: errors.length === 0, errors, warnings: [] };
}

const EPS = 1e-6;
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const area = (poly) =>
  Math.abs(poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;

function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
function selfIntersects(poly) {
  const n = poly.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true;
    }
  return false;
}

// Duas paredes na mesma linha que se sobrepõem (ex.: cômodos colados, cada um com a sua parede) tapam portas
// e piscam no 3D. É aviso, não erro: a cena abre, mas quase sempre é engano.
function checkOverlappingWalls(walls, path, warnings) {
  const TOL = 0.02;
  for (let i = 0; i < walls.length; i++)
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i], b = walls[j];
      const L = dist(a.start, a.end);
      if (L < EPS) continue;
      const ux = (a.end[0] - a.start[0]) / L, uz = (a.end[1] - a.start[1]) / L;
      const off = (p) => Math.abs((p[0] - a.start[0]) * uz - (p[1] - a.start[1]) * ux);
      if (off(b.start) > TOL || off(b.end) > TOL) continue;
      const t = (p) => (p[0] - a.start[0]) * ux + (p[1] - a.start[1]) * uz;
      const lo = Math.max(0, Math.min(t(b.start), t(b.end)));
      const hi = Math.min(L, Math.max(t(b.start), t(b.end)));
      if (hi - lo > TOL)
        warnings.push(`${path}: paredes '${a.id}' e '${b.id}' se sobrepõem em ${(hi - lo).toFixed(2)} m na mesma linha; use uma parede só (aberturas numa delas ficam tapadas pela outra)`);
    }
}

/**
 * @param {object} scene
 * @param {{ catalog?: object }} [opts] com catálogo, avisa sobre catalogId e materiais desconhecidos
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateScene(scene, opts = {}) {
  const errors = [];
  const warnings = [];

  if (!validateSchema(scene)) {
    errors.push(...schemaErrors(validateSchema));
    return { valid: false, errors, warnings };
  }

  const ids = new Map();
  const seeId = (id, path) => {
    if (ids.has(id)) errors.push(`${path}: id '${id}' repetido (já usado em ${ids.get(id)})`);
    else ids.set(id, path);
  };
  seeId(scene.id, "/");
  (scene.views ?? []).forEach((v, i) => seeId(v.id, `/views/${i}`));

  const checkContainer = (c, path, levelHeight) => {
    const walls = new Map();
    (c.walls ?? []).forEach((w, i) => {
      const p = `${path}/walls/${i}`;
      seeId(w.id, p);
      walls.set(w.id, w);
      if (dist(w.start, w.end) < EPS) errors.push(`${p}: parede '${w.id}' tem comprimento zero`);
    });
    (c.openings ?? []).forEach((o, i) => {
      const p = `${path}/openings/${i}`;
      seeId(o.id, p);
      const w = walls.get(o.wallId);
      if (!w) return errors.push(`${p}: abertura '${o.id}' aponta para parede inexistente '${o.wallId}'`);
      const len = dist(w.start, w.end);
      if (o.offset - o.width / 2 < -EPS || o.offset + o.width / 2 > len + EPS)
        errors.push(`${p}: abertura '${o.id}' (centro ${o.offset} m, largura ${o.width} m) sai da parede '${w.id}' de ${len.toFixed(3)} m`);
      const wallH = Math.min(w.height ?? levelHeight ?? Infinity, w.heightEnd ?? w.height ?? levelHeight ?? Infinity);
      if ((o.sill ?? 0) + o.height > wallH + EPS)
        errors.push(`${p}: abertura '${o.id}' (peitoril + altura = ${((o.sill ?? 0) + o.height).toFixed(2)} m) é mais alta que a parede (${wallH} m)`);
    });
    // aberturas sobrepostas na mesma parede
    const byWall = {};
    for (const o of c.openings ?? []) (byWall[o.wallId] ??= []).push(o);
    for (const list of Object.values(byWall)) {
      list.sort((a, b) => a.offset - b.offset);
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1], b = list[i];
        if (a.offset + a.width / 2 > b.offset - b.width / 2 + EPS)
          errors.push(`${path}: aberturas '${a.id}' e '${b.id}' se sobrepõem na parede '${a.wallId}'`);
      }
    }
    (c.rooms ?? []).forEach((r, i) => {
      const p = `${path}/rooms/${i}`;
      seeId(r.id, p);
      if (area(r.polygon) < EPS) errors.push(`${p}: cômodo '${r.id}' tem área zero`);
      if (selfIntersects(r.polygon)) errors.push(`${p}: polígono do cômodo '${r.id}' se cruza`);
    });
    (c.zones ?? []).forEach((z, i) => {
      const p = `${path}/zones/${i}`;
      seeId(z.id, p);
      if (selfIntersects(z.polygon)) errors.push(`${p}: polígono da zona '${z.id}' se cruza`);
    });
    (c.objects ?? []).forEach((o, i) => seeId(o.id, `${path}/objects/${i}`));
    checkOverlappingWalls(c.walls ?? [], path, warnings);
    // v0.2
    (c.roofs ?? []).forEach((r, i) => {
      seeId(r.id, `${path}/roofs/${i}`);
      if (selfIntersects(r.polygon)) errors.push(`${path}/roofs/${i}: polígono do telhado '${r.id}' se cruza`);
      if (r.kind !== "flat" && r.pitchDeg === undefined) warnings.push(`${path}/roofs/${i}: telhado '${r.id}' (${r.kind}) sem pitchDeg; o motor usa o padrão`);
    });
    (c.slabOpenings ?? []).forEach((v, i) => {
      seeId(v.id, `${path}/slabOpenings/${i}`);
      if (selfIntersects(v.polygon)) errors.push(`${path}/slabOpenings/${i}: polígono do vão '${v.id}' se cruza`);
    });
    const objIds = new Set((c.objects ?? []).map((o) => o.id));
    const grouped = new Map();
    (c.groups ?? []).forEach((g, i) => {
      seeId(g.id, `${path}/groups/${i}`);
      for (const id of g.objectIds) {
        if (!objIds.has(id)) errors.push(`${path}/groups/${i}: grupo '${g.id}' tem objeto inexistente '${id}'`);
        if (grouped.has(id)) errors.push(`${path}/groups/${i}: objeto '${id}' está nos grupos '${grouped.get(id)}' e '${g.id}'`);
        grouped.set(id, g.id);
      }
    });
    (c.annotations ?? []).forEach((a, i) => {
      seeId(a.id, `${path}/annotations/${i}`);
      if (a.kind === "dimension" && dist(a.start, a.end) < EPS) errors.push(`${path}/annotations/${i}: cota '${a.id}' tem comprimento zero`);
    });
    return walls;
  };

  const containers = [];
  scene.levels.forEach((lvl, i) => {
    seeId(lvl.id, `/levels/${i}`);
    containers.push({ c: lvl, path: `/levels/${i}`, walls: checkContainer(lvl, `/levels/${i}`, lvl.height) });
  });
  if (scene.site) {
    if (scene.site.boundary && selfIntersects(scene.site.boundary)) errors.push(`/site/boundary: limite do terreno se cruza`);
    containers.push({ c: scene.site, path: "/site", walls: checkContainer(scene.site, "/site", undefined) });
  }

  // referências de objetos
  for (const { c, path, walls } of containers) {
    const roomIds = new Set((c.rooms ?? []).map((r) => r.id));
    const objIds = new Set((c.objects ?? []).map((o) => o.id));
    (c.objects ?? []).forEach((o, i) => {
      const p = `${path}/objects/${i}`;
      if (o.wallId && !walls.has(o.wallId)) errors.push(`${p}: objeto '${o.id}' aponta para parede inexistente '${o.wallId}'`);
      if (o.mount === "wall" && !o.wallId) warnings.push(`${p}: objeto '${o.id}' é de parede mas não tem wallId`);
      if (o.parentId && !objIds.has(o.parentId)) errors.push(`${p}: objeto '${o.id}' apoiado em objeto inexistente '${o.parentId}'`);
      if (o.parentId === o.id) errors.push(`${p}: objeto '${o.id}' apoiado nele mesmo`);
      if (o.roomId && !roomIds.has(o.roomId)) errors.push(`${p}: objeto '${o.id}' em cômodo inexistente '${o.roomId}'`);
    });
  }

  if (opts.catalog) checkAgainstCatalog(scene, opts.catalog, warnings);
  return { valid: errors.length === 0, errors, warnings };
}

// Itens e materiais desconhecidos viram aviso: o motor desenha um substituto, mas provavelmente é erro de digitação.
function checkAgainstCatalog(scene, catalog, warnings) {
  const items = new Set(catalog.items.map((i) => i.id));
  const mats = new Set([...Object.keys(catalog.materials ?? {}), ...Object.keys(scene.materials ?? {})]);
  const mat = (ref, where) => {
    if (ref && !mats.has(ref)) warnings.push(`${where}: material '${ref}' não existe no catálogo nem na cena`);
  };
  const slots = (m, where) => Object.values(m ?? {}).forEach((r) => mat(r, where));
  const d = scene.defaults ?? {};
  [d.wallMaterial, d.floorMaterial, d.ceilingMaterial].forEach((r) => mat(r, "/defaults"));
  Object.entries(scene.materials ?? {}).forEach(([id, m]) => mat(m.base, `/materials/${id}`));
  const containers = [...scene.levels.map((l, i) => [l, `/levels/${i}`]), ...(scene.site ? [[scene.site, "/site"]] : [])];
  for (const [c, path] of containers) {
    (c.walls ?? []).forEach((w) => ["left", "right", "top"].forEach((k) => mat(w.finish?.[k], `${path} parede '${w.id}'`)));
    (c.openings ?? []).forEach((o) => slots(o.materials, `${path} abertura '${o.id}'`));
    (c.rooms ?? []).forEach((r) => (mat(r.floor?.material, `${path} cômodo '${r.id}'`), mat(r.ceiling?.material, `${path} cômodo '${r.id}'`)));
    (c.zones ?? []).forEach((z) => (mat(z.material, `${path} zona '${z.id}'`), mat(z.edgeMaterial, `${path} zona '${z.id}'`)));
    (c.roofs ?? []).forEach((r) => (mat(r.material, `${path} telhado '${r.id}'`), mat(r.ceilingMaterial, `${path} telhado '${r.id}'`)));
    (c.openings ?? []).forEach((o) => mat(o.treatment?.material, `${path} abertura '${o.id}'`));
    mat(c.groundMaterial, path);
    (c.objects ?? []).forEach((o) => {
      if (!items.has(o.catalogId)) warnings.push(`${path} objeto '${o.id}': item '${o.catalogId}' não existe no catálogo`);
      slots(o.materials, `${path} objeto '${o.id}'`);
    });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("uso: node validar.mjs <cena.json> [...]");
    process.exit(2);
  }
  let ok = true;
  const catalogPath = process.env.DESIGN3D_CATALOG ?? join(here, "..", "assets", "catalog.json");
  let catalog;
  if (existsSync(catalogPath)) {
    catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
    const r = validateCatalog(catalog);
    console.log(`${r.valid ? "✓" : "✗"} ${catalogPath} (catálogo)`);
    for (const e of r.errors) console.log(`   erro: ${e}`);
    ok &&= r.valid;
    if (!r.valid) catalog = undefined;
  }
  for (const f of files) {
    let scene;
    try {
      scene = JSON.parse(readFileSync(f, "utf8"));
    } catch (e) {
      console.log(`✗ ${f}: JSON inválido (${e.message})`);
      ok = false;
      continue;
    }
    const r = validateScene(scene, { catalog });
    console.log(`${r.valid ? "✓" : "✗"} ${f}`);
    for (const e of r.errors) console.log(`   erro: ${e}`);
    for (const w of r.warnings) console.log(`   aviso: ${w}`);
    ok &&= r.valid;
  }
  process.exit(ok ? 0 : 1);
}
