/**
 * Post-deploy smoke for Flare Boss Arena (Vercel).
 * Usage: node scripts/smoke-deploy.mjs [baseUrl]
 * Default: https://flare-boss-arena.vercel.app
 */
const base = (process.argv[2] ?? process.env.SMOKE_BASE ?? "https://flare-boss-arena.vercel.app").replace(
  /\/$/,
  "",
);

const checks = [
  { path: "/", name: "index" },
  { path: "/index.html", name: "index.html" },
  { path: "/assets/", name: "assets-dir", allowFail: true },
  { path: "/models/buildings/orc_camp_set.glb", name: "orc_camp_set", head: true },
  { path: "/models/buildings/old_wooden_watchtower.glb", name: "watchtower", head: true },
  { path: "/models/buildings/modular_rusty_fences.glb", name: "fences", head: true },
  { path: "/models/buildings/farm_modular_pack.glb", name: "farm_pack", head: true },
  { path: "/models/pirates/world/Ship_Small.gltf", name: "ship_small", head: true },
  { path: "/models/racalvin/brothers_keeper.glb", name: "brothers_keeper", head: true },
];

async function hit({ path, name, head, allowFail }) {
  const url = `${base}${path}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: head ? "HEAD" : "GET", redirect: "follow" });
    const ms = Date.now() - t0;
    const ok = res.ok || (allowFail && res.status === 404);
    const status = res.status;
    const len = res.headers.get("content-length") ?? "?";
    const cache = res.headers.get("x-vercel-cache") ?? res.headers.get("cf-cache-status") ?? "-";
    console.log(
      `${ok ? "OK " : "FAIL"} ${status} ${ms}ms cache=${cache} len=${len}  ${name}  ${path}`,
    );
    return ok;
  } catch (e) {
    console.log(`FAIL ERR ${name} ${path}  ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

console.log(`smoke-deploy → ${base}`);
let failed = 0;
for (const c of checks) {
  // eslint-disable-next-line no-await-in-loop
  const ok = await hit(c);
  if (!ok) failed++;
}
// JS bundle probe: fetch HTML and look for script src
try {
  const html = await (await fetch(base + "/")).text();
  const m = html.match(/src="(\/assets\/[^"]+\.js)"/);
  if (m) {
    const js = m[1];
    const r = await fetch(base + js, { method: "HEAD" });
    console.log(
      `${r.ok ? "OK " : "FAIL"} ${r.status} bundle  ${js}  cache=${r.headers.get("x-vercel-cache") ?? "-"}`,
    );
    if (!r.ok) failed++;
  } else {
    console.log("WARN no /assets/*.js found in index HTML (SPA may still work)");
  }
  if (/flare|grudge|root/i.test(html) || html.includes("id=\"root\"") || html.includes("type=\"module\"")) {
    console.log("OK  SPA shell markers present");
  }
} catch (e) {
  console.log("FAIL HTML parse", e instanceof Error ? e.message : e);
  failed++;
}

console.log(failed ? `\nSMOKE FAILED (${failed})` : "\nSMOKE PASSED");
process.exit(failed ? 1 : 0);
