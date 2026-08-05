/**
 * Player combat state machine — patterns from annihilate-reference (XState Maria/Paladin):
 *   • discrete states: idle | run | attack | block | dodge | skill | hit | dead
 *   • tags gate systems: canMove, canDamage, invulnerable, canFacing
 *   • timed after-transitions (dodge duration, attack recovery)
 *
 * Pure TS (no XState dep) so the GameEngine stays lightweight. Mirrors the
 * annihilate `service.state.hasTag('canMove')` call sites used by AI / movement.
 */

export type CombatPhase =
  | "idle"
  | "run"
  | "attack"
  | "block"
  | "dodge"
  | "skill"
  | "hit"
  | "dead";

export type CombatTag = "canMove" | "canDamage" | "invulnerable" | "canFacing";

const TAGS: Record<CombatPhase, ReadonlySet<CombatTag>> = {
  idle: new Set(["canMove", "canFacing"]),
  run: new Set(["canMove", "canFacing"]),
  attack: new Set(["canDamage", "canFacing"]),
  block: new Set(["invulnerable", "canFacing"]),
  dodge: new Set(["canMove", "invulnerable"]),
  skill: new Set(["canDamage", "canFacing"]),
  hit: new Set([]),
  dead: new Set([]),
};

/** Human-readable badge for the HUD (annihilate active-state strip). */
const LABEL: Record<CombatPhase, string> = {
  idle: "IDLE",
  run: "RUN",
  attack: "ATK",
  block: "BLOCK",
  dodge: "DODGE",
  skill: "SKILL",
  hit: "HIT",
  dead: "DOWN",
};

export class CombatStateMachine {
  private phase: CombatPhase = "idle";
  /** Seconds remaining in a timed phase; 0 = no timer. */
  private timer = 0;
  private returnTo: CombatPhase = "idle";

  get value(): CombatPhase {
    return this.phase;
  }

  get label(): string {
    return LABEL[this.phase];
  }

  hasTag(tag: CombatTag): boolean {
    return TAGS[this.phase].has(tag);
  }

  /** True when player may freely WASD / click-move. */
  get canMove(): boolean {
    return this.hasTag("canMove");
  }

  get invulnerable(): boolean {
    return this.hasTag("invulnerable");
  }

  get canDamage(): boolean {
    return this.hasTag("canDamage");
  }

  /**
   * Advance timers. Call once per sim step.
   * Returns true if the phase changed this tick (HUD can force-notify).
   */
  update(dt: number): boolean {
    if (this.timer <= 0) return false;
    this.timer -= dt;
    if (this.timer > 0) return false;
    this.timer = 0;
    const next = this.returnTo;
    this.returnTo = "idle";
    if (next !== this.phase) {
      this.phase = next;
      return true;
    }
    return false;
  }

  private enter(phase: CombatPhase, duration = 0, after: CombatPhase = "idle") {
    this.phase = phase;
    this.timer = duration;
    this.returnTo = after;
  }

  /** Locomotion from input — only when canMove (or already running). */
  setMoving(moving: boolean) {
    if (this.phase === "dead" || this.phase === "hit") return;
    if (this.phase === "attack" || this.phase === "skill" || this.phase === "block" || this.phase === "dodge") {
      return; // one-shots own the phase until timer ends
    }
    this.phase = moving ? "run" : "idle";
    this.timer = 0;
  }

  /** Basic attack one-shot (~0.45s active). */
  attack(duration = 0.45) {
    if (this.phase === "dead" || this.phase === "hit" || this.phase === "dodge") return false;
    this.enter("attack", duration, "idle");
    return true;
  }

  /** Skill cast window. */
  skill(duration = 0.55) {
    if (this.phase === "dead" || this.phase === "hit") return false;
    this.enter("skill", duration, "idle");
    return true;
  }

  /** Q block — held; release via endBlock(). */
  beginBlock() {
    if (this.phase === "dead" || this.phase === "hit" || this.phase === "dodge") return false;
    this.enter("block", 0);
    return true;
  }

  endBlock() {
    if (this.phase === "block") {
      this.phase = "idle";
      this.timer = 0;
    }
  }

  /** Shift dodge i-frame window. Can cancel attack/skill recovery. */
  dodge(duration = 0.4) {
    if (this.phase === "dead") return false;
    // Hit-stun blocks dodge; everything else can be cancelled into a roll.
    if (this.phase === "hit") return false;
    this.enter("dodge", duration, "idle");
    return true;
  }

  /** Damage reaction — short stun. */
  hit(duration = 0.28) {
    if (this.phase === "dead") return;
    this.enter("hit", duration, "idle");
  }

  die() {
    this.enter("dead", 0);
  }

  reset() {
    this.phase = "idle";
    this.timer = 0;
    this.returnTo = "idle";
  }
}
