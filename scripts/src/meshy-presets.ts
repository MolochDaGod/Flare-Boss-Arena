/**
 * Grudge Warlords retexture presets for the Meshy Retexture API.
 *
 * Each preset is a *texture-only* prompt: it describes materials, palette, and
 * wear — never geometry (retexture cannot change the mesh). Prompts are tuned to
 * pull the generic KayKit / asset-pack look back into the Grudge house style:
 * grim dark fantasy, blackened battle-worn metal, weathered leather, and the
 * signature ember / antique-gold accent (#c5a059). Keep each final prompt under
 * the Meshy 600-character limit.
 */

/**
 * Shared style suffix appended to every preset. This is the "brand lock" — it
 * keeps the palette and finish cohesive across the whole roster so retextured
 * characters read as one set, not six unrelated models.
 */
export const GRUDGE_STYLE_SUFFIX =
  "grim dark-fantasy game character, battle-worn and weathered, cohesive palette of blackened iron, charcoal, deep oxblood, and antique ember-gold (#c5a059) accents, soot and rust in the crevices, matte PBR surfaces, no bright saturated colors, no glossy plastic, no cartoon shading";

export interface RetexturePreset {
  /** Human label for logs / CLI. */
  label: string;
  /** Default source GLB, relative to the grudge-game public/ dir. */
  model: string;
  /** Core material/palette description (the suffix is appended automatically). */
  prompt: string;
}

const HEROES = "artifacts/grudge-game/public/models/kaykit/heroes";

export const PRESETS: Record<string, RetexturePreset> = {
  knight: {
    label: "Knight — Iron Warlord",
    model: `${HEROES}/Knight.glb`,
    prompt:
      "A grim warlord knight in blackened, battle-scarred steel plate with tarnished edges and dented pauldrons; antique ember-gold filigree etched into the breastplate and helm, dark oxblood-stained cloth tabard, worn brown leather straps and gauntlets, faint glowing amber runes in the armor seams",
  },
  barbarian: {
    label: "Barbarian — Ashen Reaver",
    model: `${HEROES}/Barbarian.glb`,
    prompt:
      "A savage warlord reaver in blood-rusted iron and dark weathered fur pelts, bare scarred skin streaked with ash and dried war-paint, blackened bronze arm bands with ember-gold inlay, frayed leather wraps and bone trophies, grime and soot across the hide",
  },
  mage: {
    label: "Mage — Emberbound Sorcerer",
    model: `${HEROES}/Mage.glb`,
    prompt:
      "A dark-fantasy sorcerer in charred ash-grey layered robes singed at the hems, molten antique-gold filigree along the trim, glowing ember-amber sigils woven into the fabric, blackened leather belt and clasps, smoke-stained cloth, a grim battle-worn look",
  },
  ranger: {
    label: "Ranger — Blackwood Stalker",
    model: `${HEROES}/Ranger.glb`,
    prompt:
      "A grim warlord ranger in dark weathered forest-black leather armor with mud and moss staining, a deep charcoal hooded cloak, antique ember-gold buckles and arrow fittings, worn quiver straps, scuffed boots, a muted earthy dark-fantasy palette",
  },
  rogue: {
    label: "Rogue — Cinder Shade",
    model: `${HEROES}/Rogue.glb`,
    prompt:
      "A shadowy warlord assassin in matte black weathered leather with shadow-grey wrappings, blackened steel buckles touched with ember-gold, scuffed and scarred surfaces, a grim battle-worn finish, muted dark-fantasy palette with faint amber accents",
  },
  rogue_hooded: {
    label: "Rogue (Hooded) — Ashen Wraith",
    model: `${HEROES}/Rogue_Hooded.glb`,
    prompt:
      "A hooded warlord wraith in tattered ash-grey and black layered cloth and weathered leather, deep shadowed hood, blackened buckles with antique ember-gold edges, soot-stained frayed fabric, a grim spectral dark-fantasy look with faint amber glow",
  },
};

/** Compose a preset (or raw prompt) into the final Meshy text_style_prompt. */
export function buildPrompt(core: string): string {
  const full = `${core.trim()}, ${GRUDGE_STYLE_SUFFIX}`;
  if (full.length > 600) {
    // Meshy hard-caps at 600 chars; trim the core, keep the brand lock intact.
    const room = 600 - (GRUDGE_STYLE_SUFFIX.length + 2);
    return `${core.trim().slice(0, Math.max(0, room))}, ${GRUDGE_STYLE_SUFFIX}`;
  }
  return full;
}
