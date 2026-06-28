/**
 * Resolve a skill's `icon` value into a usable image `src`.
 *
 * Accepts:
 *  - an absolute URL (`http(s)://…`) — returned as-is
 *  - a public-relative path (e.g. `icons/skilltree/FireMage_Free/FireMage_28.png`)
 *    — prefixed with `import.meta.env.BASE_URL` so it works under the artifact's
 *    base path.
 *
 * Returns `null` for empty input so callers can fall back to an emoji glyph.
 */
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/** KayKit icon CDN — serves `/icons/pack/**` (weapon/skill art). */
const OBJECT_STORE = "https://molochdagod.github.io/ObjectStore";

export function skillIconSrc(icon?: string | null): string | null {
  if (!icon) return null;
  if (/^https?:\/\//.test(icon)) return icon;
  const path = icon.replace(/^\//, "");
  // Skilltree art is bundled in this app's `public/icons/skilltree/**`.
  if (path.startsWith("icons/skilltree/")) return `${BASE}/${path}`;
  // Everything else under `icons/**` (e.g. `icons/pack/weapons/Sword_01.png`,
  // returned by the API) lives only on the ObjectStore CDN.
  if (path.startsWith("icons/")) return `${OBJECT_STORE}/${path}`;
  return `${BASE}/${path}`;
}
