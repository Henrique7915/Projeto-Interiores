#!/usr/bin/env node
// Valida cenas do Design3D: JSON Schema + regras de consistência que o schema não expressa.
// Uso: node validar.mjs <cena.json> [...]      (sai com código 1 se houver erro)
// Também exporta validateScene(scene) para o app e o servidor MCP reutilizarem.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
const sceneSchema = JSON.parse(readFileSync(join(here, "scene.schema.json"), "utf8"));
const catalogSchema = JSON.parse(readFileSync(join(here, "catalog.schema.json"), "utf8"));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(sceneSchema, "scene.schema.json");
ajv.addSchema(catalogSchema, "catalog.schema.json");
const validateSchema = ajv.getSchema("scene.schema.json");

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

/** @returns {{ valid: boolean, errors: string[], warnings: string[] }} */
export function validateScene(scene) {
  const errors = [];
  const warnings = [];

  if (!validateSchema(scene)) {
    for (const e of validateSchema.errors) {
      const extra = e.params?.additionalProperty ?? e.params?.allowedValues?.join(", ");
      errors.push(`schema ${e.instancePath || "/"}: ${e.message}${extra ? ` (${extra})` : ""}`);
    }
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

  return { valid: errors.length === 0, errors, warnings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("uso: node validar.mjs <cena.json> [...]");
    process.exit(2);
  }
  let ok = true;
  for (const f of files) {
    let scene;
    try {
      scene = JSON.parse(readFileSync(f, "utf8"));
    } catch (e) {
      console.log(`✗ ${f}: JSON inválido (${e.message})`);
      ok = false;
      continue;
    }
    const r = validateScene(scene);
    console.log(`${r.valid ? "✓" : "✗"} ${f}`);
    for (const e of r.errors) console.log(`   erro: ${e}`);
    for (const w of r.warnings) console.log(`   aviso: ${w}`);
    ok &&= r.valid;
  }
  process.exit(ok ? 0 : 1);
}
