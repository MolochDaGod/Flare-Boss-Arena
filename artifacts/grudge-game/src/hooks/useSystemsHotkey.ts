import { useEffect, useState } from "react";
import { SYSTEMS_HOTKEY } from "@/data/gameFlow";

/** Shared open-state for Systems hub / Escape menu outside Shell. */
export function useSystemsHotkey(opts?: { alsoEscape?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.code === SYSTEMS_HOTKEY && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (opts?.alsoEscape && e.code === "Escape") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts?.alsoEscape]);

  return [open, setOpen] as const;
}
