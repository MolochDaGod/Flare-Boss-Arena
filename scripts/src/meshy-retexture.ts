/**
 * Grudge Warlords — Meshy Retexture pipeline.
 *
 * Reskins an existing GLB through Meshy's Retexture API into the Grudge
 * dark-fantasy house style, then downloads the result. Best-practice defaults
 * are baked in (see DEFAULTS below); per-character art direction lives in
 * meshy-presets.ts.
 *
 * Auth: reads MESHY_API_KEY from the environment (a managed secret). The key is
 * never logged.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run meshy:retexture -- --preset knight
 *   pnpm --filter @workspace/scripts run meshy:retexture -- --in path/to.glb --prompt "..."
 *   pnpm --filter @workspace/scripts run meshy:retexture -- --preset mage --hd --dry-run
 *
 * Flags:
 *   --preset <name>     One of the keys in meshy-presets.ts (sets model + prompt).
 *   --in <glb>          Source GLB (overrides the preset model). Small files are
 *                       sent inline as a base64 data URI.
 *   --model-url <url>   Publicly reachable model URL instead of inlining a file
 *                       (use for large GLBs that exceed the inline size cap).
 *   --prompt "<text>"   Custom core prompt (the Grudge style suffix is appended).
 *   --image-url <url>   Style reference image; takes priority over the text prompt.
 *   --out <dir>         Output dir (default: scripts/.meshy-out/<preset|name>).
 *   --hd                Request 4K base color (meshy-6 only; costs more).
 *   --no-pbr            Skip PBR maps (default is PBR on).
 *   --fresh-uv          Let Meshy unwrap new UVs (default keeps the model's UVs).
 *   --model <id>        AI model: meshy-5 | meshy-6 | latest (default meshy-6).
 *   --dry-run           Print the request payload and exit WITHOUT spending credits.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { PRESETS, buildPrompt } from "./meshy-presets.js";

const API_BASE = "https://api.meshy.ai/openapi/v1/retexture";
const ROOT = path.resolve(import.meta.dirname, "../..");

/**
 * Best-practice defaults for retexturing rigged, game-ready GLBs (KayKit heroes,
 * etc.). See .agents/skills/meshy-retexture/SKILL.md for the rationale.
 */
const DEFAULTS = {
  ai_model: "meshy-6", // newest: supports remove_lighting, emission, 4K.
  enable_pbr: true, // game uses MeshStandardMaterial — needs metallic/roughness/normal.
  enable_original_uv: true, // KayKit models ship clean UVs; preserve rig/material slots.
  remove_lighting: true, // the game owns its lighting/shadow rig — keep base color flat.
  hd_texture: false, // 4K opt-in via --hd (slower, more credits).
  target_formats: ["glb"], // Three.js only needs glb; fewer formats = faster task.
} as const;

const POLL_MS = 6000;
const TIMEOUT_MS = 12 * 60 * 1000;

interface Args {
  preset?: string;
  in?: string;
  modelUrl?: string;
  prompt?: string;
  imageUrl?: string;
  out?: string;
  hd: boolean;
  pbr: boolean;
  freshUv: boolean;
  model: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    hd: false,
    pbr: true,
    freshUv: false,
    model: DEFAULTS.ai_model,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--": break; // pnpm/tsx arg separator passthrough
      case "--preset": a.preset = next(); break;
      case "--in": a.in = next(); break;
      case "--model-url": a.modelUrl = next(); break;
      case "--prompt": a.prompt = next(); break;
      case "--image-url": a.imageUrl = next(); break;
      case "--out": a.out = next(); break;
      case "--hd": a.hd = true; break;
      case "--no-pbr": a.pbr = false; break;
      case "--fresh-uv": a.freshUv = true; break;
      case "--model": a.model = next() ?? DEFAULTS.ai_model; break;
      case "--dry-run": a.dryRun = true; break;
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    }
  }
  return a;
}

async function toDataUri(absPath: string): Promise<string> {
  const buf = await readFile(absPath);
  const mb = buf.byteLength / (1024 * 1024);
  if (mb > 12) {
    throw new Error(
      `${path.basename(absPath)} is ${mb.toFixed(1)}MB — too large to inline. ` +
        `Host it publicly and pass --model-url instead.`,
    );
  }
  return `data:application/octet-stream;base64,${buf.toString("base64")}`;
}

interface TaskBody {
  ai_model: string;
  enable_pbr: boolean;
  enable_original_uv: boolean;
  remove_lighting?: boolean;
  hd_texture: boolean;
  target_formats: string[];
  model_url?: string;
  text_style_prompt?: string;
  image_style_url?: string;
}

async function createTask(apiKey: string, body: TaskBody): Promise<string> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Create task failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { result: string };
  return json.result;
}

interface TaskStatus {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress: number;
  model_urls?: Record<string, string>;
  texture_urls?: Array<Record<string, string>>;
  thumbnail_url?: string;
  task_error?: { message?: string };
}

async function getTask(apiKey: string, id: string): Promise<TaskStatus> {
  const res = await fetch(`${API_BASE}/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Get task failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TaskStatus;
}

async function pollUntilDone(apiKey: string, id: string): Promise<TaskStatus> {
  const deadline = Date.now() + TIMEOUT_MS;
  let last = -1;
  while (Date.now() < deadline) {
    const task = await getTask(apiKey, id);
    if (task.progress !== last) {
      console.log(`  [${task.status}] ${task.progress}%`);
      last = task.progress;
    }
    if (task.status === "SUCCEEDED") return task;
    if (task.status === "FAILED" || task.status === "CANCELED") {
      throw new Error(
        `Task ${task.status}: ${task.task_error?.message ?? "unknown error"}`,
      );
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`Timed out after ${TIMEOUT_MS / 1000}s waiting for task ${id}`);
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${dest}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`  saved ${path.basename(dest)} (${(buf.byteLength / 1024).toFixed(0)}KB)`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey && !args.dryRun) {
    throw new Error("MESHY_API_KEY is not set in the environment.");
  }

  // Resolve model source + prompt from preset and/or flags.
  const preset = args.preset ? PRESETS[args.preset] : undefined;
  if (args.preset && !preset) {
    throw new Error(
      `Unknown preset "${args.preset}". Options: ${Object.keys(PRESETS).join(", ")}`,
    );
  }

  const corePrompt = args.prompt ?? preset?.prompt;
  if (!corePrompt && !args.imageUrl) {
    throw new Error("Provide --prompt, --preset, or --image-url for the style.");
  }

  const name = args.preset ?? (args.in ? path.basename(args.in, ".glb") : "retexture");
  const outDir = args.out ?? path.join(ROOT, "scripts/.meshy-out", name);

  // remove_lighting, hd_texture, and the emission map are meshy-6/latest only.
  const isMeshy6 = args.model === "meshy-6" || args.model === "latest";
  if (args.hd && !isMeshy6) {
    throw new Error(`--hd (4K texture) requires --model meshy-6 (got "${args.model}").`);
  }

  // Build the request body with best-practice defaults.
  const body: TaskBody = {
    ai_model: args.model,
    enable_pbr: args.pbr,
    enable_original_uv: !args.freshUv,
    hd_texture: args.hd,
    target_formats: [...DEFAULTS.target_formats],
  };
  if (isMeshy6) body.remove_lighting = DEFAULTS.remove_lighting;

  if (args.imageUrl) body.image_style_url = args.imageUrl;
  else if (corePrompt) body.text_style_prompt = buildPrompt(corePrompt);

  // Model source: explicit URL, else inline the local GLB as a data URI.
  if (args.modelUrl) {
    body.model_url = args.modelUrl;
  } else {
    const rel = args.in ?? preset?.model;
    if (!rel) throw new Error("Provide --in <glb>, --model-url, or a --preset.");
    const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
    if (!existsSync(abs)) throw new Error(`Model not found: ${abs}`);
    body.model_url = await toDataUri(abs);
  }

  // Logging (never print the data URI payload or the API key).
  const printable = {
    ...body,
    model_url: body.model_url?.startsWith("data:")
      ? `<inline ${name}.glb>`
      : body.model_url,
  };
  console.log(`Meshy retexture — ${preset?.label ?? name}`);
  console.log(JSON.stringify(printable, null, 2));

  if (args.dryRun) {
    console.log("\n--dry-run: no task created, no credits spent.");
    return;
  }

  await mkdir(outDir, { recursive: true });
  console.log("\nCreating task…");
  const id = await createTask(apiKey!, body);
  console.log(`Task ${id} created. Polling…`);

  const task = await pollUntilDone(apiKey!, id);

  const glb = task.model_urls?.glb;
  if (!glb) throw new Error("Task succeeded but no GLB URL was returned.");

  console.log(`\nDownloading results to ${path.relative(ROOT, outDir)}/`);
  await download(glb, path.join(outDir, `${name}.glb`));
  if (task.thumbnail_url) {
    await download(task.thumbnail_url, path.join(outDir, `${name}.preview.png`));
  }
  const tex = task.texture_urls?.[0] ?? {};
  for (const [map, url] of Object.entries(tex)) {
    if (url) await download(url, path.join(outDir, `${name}.${map}.png`));
  }

  await writeFile(
    path.join(outDir, `${name}.task.json`),
    JSON.stringify({ id, status: task.status, model_urls: task.model_urls }, null, 2),
  );
  console.log("\nDone. Note: Meshy output URLs expire — these files are now local copies.");
}

main().catch((err) => {
  console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
