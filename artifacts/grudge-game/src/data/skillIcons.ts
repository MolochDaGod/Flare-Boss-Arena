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

export function skillIconSrc(icon?: string | null): string | null {
  if (!icon) return null;
  if (/^https?:\/\//.test(icon)) return icon;
  return `${BASE}/${icon.replace(/^\//, "")}`;
}
