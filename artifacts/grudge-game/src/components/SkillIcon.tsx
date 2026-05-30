import { useState } from "react";
import { skillIconSrc } from "@/data/skillIcons";

interface SkillIconProps {
  /** Public-relative path or absolute URL of the skill art. */
  icon?: string | null;
  /** Emoji fallback rendered when there's no icon or it fails to load. */
  glyph?: string;
  /** Square size in px (defaults to 28). */
  size?: number;
  /** Corner radius in px (defaults to 6). */
  radius?: number;
  className?: string;
  /** Final fallback when neither icon nor glyph is available. */
  fallback?: string;
}

/**
 * Renders a real skill icon image with graceful fallback to the emoji glyph.
 * Used everywhere class/weapon skills are surfaced so art stays consistent.
 */
export function SkillIcon({
  icon,
  glyph,
  size = 28,
  radius = 6,
  className,
  fallback = "✦",
}: SkillIconProps) {
  const [errored, setErrored] = useState(false);
  const src = skillIconSrc(icon);

  if (src && !errored) {
    return (
      <img
        src={src}
        alt={glyph ?? ""}
        draggable={false}
        onError={() => setErrored(true)}
        className={className}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: radius, display: "block" }}
      />
    );
  }

  return (
    <span className={className} style={{ fontSize: Math.round(size * 0.78), lineHeight: 1 }}>
      {glyph ?? fallback}
    </span>
  );
}
