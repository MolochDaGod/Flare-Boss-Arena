import { Router } from "express";

const router = Router();
const R2_BASE = "https://pub-e7fcf1fd4c9946ecb84b3766bbc7b50d.r2.dev";

const ENDPOINTS: Record<string, string> = {
  weapons: "/api/v1/weapons.json",
  armor: "/api/v1/armor.json",
  classes: "/api/v1/classes.json",
  races: "/api/v1/races.json",
  enemies: "/api/v1/enemies.json",
  sprites: "/api/v1/sprites2d.json",
  skillTrees: "/api/v1/skillTrees.json",
  weaponSkills: "/api/v1/weaponSkills.json",
};

const cache: Record<string, { data: unknown; fetchedAt: number }> = {};
const CACHE_TTL = 5 * 60 * 1000;

async function fetchR2<T>(key: string): Promise<T> {
  const now = Date.now();
  if (cache[key] && now - cache[key].fetchedAt < CACHE_TTL) {
    return cache[key].data as T;
  }
  const path = ENDPOINTS[key];
  if (!path) throw new Error(`Unknown R2 endpoint: ${key}`);
  const res = await fetch(R2_BASE + path);
  if (!res.ok) throw new Error(`R2 fetch failed: ${res.status}`);
  const data = await res.json();
  cache[key] = { data, fetchedAt: now };
  return data as T;
}

router.get("/gamedata/weapons", async (req, res) => {
  const data = await fetchR2("weapons");
  res.json(data);
});

router.get("/gamedata/armor", async (req, res) => {
  const data = await fetchR2("armor");
  res.json(data);
});

router.get("/gamedata/classes", async (req, res) => {
  const data = await fetchR2("classes");
  res.json(data);
});

router.get("/gamedata/races", async (req, res) => {
  const data = await fetchR2("races");
  res.json(data);
});

router.get("/gamedata/enemies", async (req, res) => {
  const data = await fetchR2("enemies");
  res.json(data);
});

router.get("/gamedata/sprites", async (req, res) => {
  const data = await fetchR2("sprites");
  res.json(data);
});

router.get("/gamedata/skillTrees", async (req, res) => {
  const data = await fetchR2("skillTrees");
  res.json(data);
});

router.get("/gamedata/weaponSkills", async (req, res) => {
  const data = await fetchR2("weaponSkills");
  res.json(data);
});

export default router;
