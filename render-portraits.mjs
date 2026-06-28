import http from "node:http";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const SKIN_DIR = path.join(ROOT, "artifacts/grudge-game/public/models/skins");
const OUT_DIR = path.join(ROOT, "artifacts/grudge-game/public/portraits");
const BUNDLE = path.join(ROOT, "/tmp/three-bundle.js");

const SKINS = [
  "nightmare_luffy", "law", "lucci", "smoker", "sanji_onigashima",
  "ryuma", "page_one", "marco", "marine_mullet", "shiryu",
  "ace_sabo_luffy", "shanks", "koby",
];

const bundleJs = await fs.readFile(BUNDLE, "utf8");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent}canvas{display:block}
</style></head><body><canvas id="c"></canvas>
<script>${bundleJs}</script>
<script>
const W=640,H=820;
const id=new URLSearchParams(location.search).get('id');
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setSize(W,H,false); canvas.width=W; canvas.height=H;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(28,W/H,0.1,100);
camera.position.set(0,1.18,4.5); camera.lookAt(0,1.02,0);
scene.add(new THREE.AmbientLight(0xffffff,0.95));
const key=new THREE.DirectionalLight(0xfff1d6,1.7); key.position.set(2.5,4,3); scene.add(key);
const rim=new THREE.DirectionalLight(0xc5a059,1.25); rim.position.set(-3,2.5,-2.5); scene.add(rim);
const fill=new THREE.DirectionalLight(0x88aaff,0.5); fill.position.set(0,1,4); scene.add(fill);
new window.GLTFLoader().load('/glb/'+id,(gltf)=>{
  try{
    const m=gltf.scene;
    const box=new THREE.Box3().setFromObject(m);
    const size=new THREE.Vector3(), center=new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const target=2.1, scale=size.y>0.001?target/size.y:1;
    m.scale.setScalar(scale);
    m.position.x=-center.x*scale; m.position.z=-center.z*scale; m.position.y=-box.min.y*scale;
    scene.add(m);
    if(gltf.animations && gltf.animations.length){
      const mixer=new THREE.AnimationMixer(m);
      const idle=gltf.animations.find(a=>/_idle_a$|_idlehome_a$/i.test(a.name))
        || gltf.animations.find(a=>a.name==='0011')
        || gltf.animations[0];
      if(idle){ mixer.clipAction(idle).play(); mixer.update(1.4); }
    }
    renderer.render(scene,camera);
    renderer.render(scene,camera);
    window.__dataurl=canvas.toDataURL('image/png');
    window.__done=true;
  }catch(e){ window.__error=String(e&&e.stack||e); window.__done=true; }
}, undefined, (err)=>{ window.__error='load: '+String(err); window.__done=true; });
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://x");
    if (u.pathname.startsWith("/glb/")) {
      const id = u.pathname.slice(5);
      const buf = await fs.readFile(path.join(SKIN_DIR, `${id}.glb`));
      res.writeHead(200, { "content-type": "model/gltf-binary", "access-control-allow-origin": "*" });
      res.end(buf);
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(html);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
console.log("server on", port);

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist", "--enable-webgl", "--no-sandbox",
    "--disable-dev-shm-usage",
  ],
});
const page = await browser.newPage({ viewport: { width: 640, height: 820 } });
page.on("console", (m) => { if (m.type() === "error") console.log("  page-err:", m.text()); });

const results = {};
for (const id of SKINS) {
  try {
    await page.goto(`http://127.0.0.1:${port}/?id=${id}`, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction("window.__done===true", { timeout: 45000 });
    const err = await page.evaluate("window.__error || null");
    const dataurl = await page.evaluate("window.__dataurl || null");
    if (dataurl) {
      const b64 = dataurl.split(",")[1];
      await fs.writeFile(path.join(OUT_DIR, `${id}.png`), Buffer.from(b64, "base64"));
      const bytes = Buffer.from(b64, "base64").length;
      results[id] = { ok: true, bytes };
      console.log("OK", id, bytes, "bytes");
    } else {
      results[id] = { ok: false, err };
      console.log("FAIL", id, err);
    }
  } catch (e) {
    results[id] = { ok: false, err: String(e) };
    console.log("ERR", id, String(e));
  }
}

await browser.close();
server.close();
console.log("DONE", JSON.stringify(results, null, 2));
