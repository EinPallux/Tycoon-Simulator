/**
 * Asset pipeline build (run: `pnpm assets`).
 *
 * raw kit GLB ──(dedup, prune, weld, bake transform)──▶ public/assets/models/<id>.<hash>.glb
 * skybox PNG  ──(copy)───────────────────────────────▶ public/assets/sky/<id>.<hash>.png
 *                                     └──▶ src/content/asset-manifest.ts (typed ids + credits)
 *
 * Files are content-hashed for immutable CDN caching; the budget gate fails
 * the build if shipped weight exceeds ASSET_BUDGET_BYTES.
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld } from "@gltf-transform/functions";
import {
  ASSET_BUDGET_BYTES,
  MODEL_SOURCES,
  SKY_SOURCES,
  SPRITE_SOURCES,
  type ModelSource,
} from "./manifest.source";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ASSETS_DIR = path.join(ROOT, "assets");
const OUT_MODELS = path.join(ROOT, "public/assets/models");
const OUT_SKY = path.join(ROOT, "public/assets/sky");
const OUT_SPRITES = path.join(ROOT, "public/assets/sprites");
const MANIFEST_OUT = path.join(ROOT, "src/content/asset-manifest.ts");

async function findFileInKit(kit: string, file: string, within?: string): Promise<string> {
  const kitDir = path.join(ASSETS_DIR, kit);
  const matches: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.name === file && (!within || p.includes(within))) matches.push(p);
    }
  }
  await walk(kitDir);
  if (matches.length === 0) throw new Error(`Not found: ${file} in ${kit}`);
  if (matches.length > 1) throw new Error(`Ambiguous: ${file} in ${kit} → ${matches.join(", ")}`);
  return matches[0] as string;
}

const hash8 = (data: Uint8Array): string =>
  createHash("sha256").update(data).digest("hex").slice(0, 8);

const slug = (id: string): string => id.replace(/[^a-z0-9]+/gi, "-");

interface BuiltEntry {
  id: string;
  url: string;
  bytes: number;
  kit: string;
}

async function buildModel(io: NodeIO, id: string, source: ModelSource): Promise<BuiltEntry> {
  const sourcePath = await findFileInKit(source.kit, source.file);
  const document = await io.read(sourcePath);
  await document.transform(dedup(), prune(), weld());

  // Bake per-model orientation/scale overrides into the scene roots.
  if (source.rotateYQuarter || source.scale) {
    const rad = ((source.rotateYQuarter ?? 0) * Math.PI) / 2;
    for (const scene of document.getRoot().listScenes()) {
      for (const node of scene.listChildren()) {
        if (source.rotateYQuarter) {
          const [x, y, z, w] = node.getRotation();
          const half = rad / 2;
          const ry = { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
          node.setRotation([
            w * ry.x + x * ry.w + y * ry.z - z * ry.y,
            w * ry.y - x * ry.z + y * ry.w + z * ry.x,
            w * ry.z + x * ry.y - y * ry.x + z * ry.w,
            w * ry.w - x * ry.x - y * ry.y - z * ry.z,
          ]);
        }
        if (source.scale) {
          const [sx, sy, sz] = node.getScale();
          node.setScale([sx * source.scale, sy * source.scale, sz * source.scale]);
        }
      }
    }
  }

  const bytes = await io.writeBinary(document);
  const name = `${slug(id)}.${hash8(bytes)}.glb`;
  await writeFile(path.join(OUT_MODELS, name), bytes);
  return { id, url: `/assets/models/${name}`, bytes: bytes.byteLength, kit: source.kit };
}

async function buildSky(id: string, kit: string, file: string): Promise<BuiltEntry> {
  const sourcePath = await findFileInKit(kit, file);
  const bytes = await readFile(sourcePath);
  const name = `${slug(id)}.${hash8(bytes)}.png`;
  await writeFile(path.join(OUT_SKY, name), bytes);
  return { id, url: `/assets/sky/${name}`, bytes: bytes.byteLength, kit };
}

async function buildSprite(
  id: string,
  kit: string,
  file: string,
  within?: string,
): Promise<BuiltEntry> {
  const sourcePath = await findFileInKit(kit, file, within);
  const bytes = await readFile(sourcePath);
  const name = `${slug(id)}.${hash8(bytes)}.png`;
  await writeFile(path.join(OUT_SPRITES, name), bytes);
  return { id, url: `/assets/sprites/${name}`, bytes: bytes.byteLength, kit };
}

function generateManifest(models: BuiltEntry[], skies: BuiltEntry[], sprites: BuiltEntry[]): string {
  const modelLines = models
    .map((m) => `  "${m.id}": { url: "${m.url}", kit: "${m.kit}" },`)
    .join("\n");
  const skyLines = skies.map((s) => `  "${s.id}": { url: "${s.url}", kit: "${s.kit}" },`).join("\n");
  const spriteLines = sprites
    .map((s) => `  "${s.id}": { url: "${s.url}", kit: "${s.kit}" },`)
    .join("\n");
  const kits = [...new Set([...models, ...skies, ...sprites].map((e) => e.kit))].sort();
  return `/**
 * GENERATED by tools/asset-pipeline/build.ts — do not edit by hand.
 * Run \`pnpm assets\` after changing manifest.source.ts.
 * All content: CC0-1.0 by Kenney (kenney.nl) — see ASSET_GUIDE.md.
 */

export interface AssetEntry {
  url: string;
  kit: string;
}

export const MODEL_ASSETS = {
${modelLines}
} as const satisfies Record<string, AssetEntry>;

export type ModelAssetId = keyof typeof MODEL_ASSETS;

export const SKY_ASSETS = {
${skyLines}
} as const satisfies Record<string, AssetEntry>;

export type SkyAssetId = keyof typeof SKY_ASSETS;

export const SPRITE_ASSETS = {
${spriteLines}
} as const satisfies Record<string, AssetEntry>;

export type SpriteAssetId = keyof typeof SPRITE_ASSETS;

export function spriteUrl(id: SpriteAssetId): string {
  return SPRITE_ASSETS[id].url;
}

/** Source kits shipped in this build (feeds the credits screen). */
export const CREDIT_KITS: readonly string[] = ${JSON.stringify(kits, null, 2)};

export function modelUrl(id: ModelAssetId): string {
  return MODEL_ASSETS[id].url;
}

export function skyUrl(id: SkyAssetId): string {
  return SKY_ASSETS[id].url;
}
`;
}

async function main(): Promise<void> {
  await rm(OUT_MODELS, { recursive: true, force: true });
  await rm(OUT_SKY, { recursive: true, force: true });
  await rm(OUT_SPRITES, { recursive: true, force: true });
  await mkdir(OUT_MODELS, { recursive: true });
  await mkdir(OUT_SKY, { recursive: true });
  await mkdir(OUT_SPRITES, { recursive: true });

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const models: BuiltEntry[] = [];
  for (const [id, source] of Object.entries(MODEL_SOURCES)) {
    models.push(await buildModel(io, id, source));
  }
  const skies: BuiltEntry[] = [];
  for (const [id, source] of Object.entries(SKY_SOURCES)) {
    skies.push(await buildSky(id, source.kit, source.file));
  }
  const sprites: BuiltEntry[] = [];
  for (const [id, source] of Object.entries(SPRITE_SOURCES)) {
    sprites.push(await buildSprite(id, source.kit, source.file, source.within));
  }

  await writeFile(MANIFEST_OUT, generateManifest(models, skies, sprites));

  const total = [...models, ...skies, ...sprites].reduce((sum, e) => sum + e.bytes, 0);
  const report = [...models, ...skies, ...sprites]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10)
    .map((e) => `  ${(e.bytes / 1024).toFixed(1).padStart(8)} KB  ${e.id}`)
    .join("\n");
  console.log(`asset-pipeline: ${models.length} models + ${skies.length} skies + ${sprites.length} sprites`);
  console.log(`largest:\n${report}`);
  console.log(`total shipped: ${(total / 1024 / 1024).toFixed(2)} MB`);
  if (total > ASSET_BUDGET_BYTES) {
    console.error(
      `❌ BUDGET EXCEEDED: ${(total / 1024 / 1024).toFixed(2)} MB > ${(ASSET_BUDGET_BYTES / 1024 / 1024).toFixed(0)} MB`,
    );
    process.exit(1);
  }
}

await main();
