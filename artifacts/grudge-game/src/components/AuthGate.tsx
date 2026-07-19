import { useEffect, useState, type ReactNode } from "react";
import {
  getAuthToken,
  setAuthToken,
  startLogin,
  fetchAuthMe,
  type AuthMe,
} from "@/data/grudgeAuth";
import { ensureEconomyBootstrapped, setGbux } from "@/data/flareEconomy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flame, LogIn, Shield } from "lucide-react";

/**
 * Production entry gate: require login or verified JWT before game shell.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [me, setMe] = useState<AuthMe | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    ensureEconomyBootstrapped();
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (path.includes("/auth/callback")) {
      setAllowed(true);
      setReady(true);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setAllowed(false);
      setReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const profile = await fetchAuthMe();
      if (cancelled) return;
      if (profile.gbux != null) setGbux(profile.gbux);
      setMe(profile.ok ? profile : { ok: true, displayName: "Verified session" });
      setAllowed(true);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitToken = async () => {
    const t = tokenDraft.trim();
    if (t.length < 12) {
      setTokenError("Token looks too short.");
      return;
    }
    setAuthToken(t);
    setTokenError(null);
    const profile = await fetchAuthMe();
    if (profile.gbux != null) setGbux(profile.gbux);
    setMe(profile.ok ? profile : { ok: true, displayName: "Verified token" });
    setAllowed(true);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-serif text-sm uppercase tracking-widest text-[#c5a059] animate-pulse">
          Checking credentials…
        </p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_0_24px_-4px_rgba(197,160,89,0.5)]">
          <Flame className="h-7 w-7" />
        </div>
        <div className="space-y-2 max-w-md">
          <p className="font-serif text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Grudge Studio · Production
          </p>
          <h1 className="font-serif text-3xl font-bold uppercase tracking-widest text-[#c5a059]">
            Flare Boss Arena
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sign in with Grudge ID or enter a verified session token. All fighters are locked —
            unlock with Flare Grudge Tokens (1000 GBUX each, or 5 boss kills → 1 token). New players
            receive <span className="text-[#c5a059] font-mono">2 tokens</span> on start. Three
            random fighters free each week for testing (levels save only if owned).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button size="lg" className="font-serif tracking-widest" onClick={() => startLogin("/")}>
            <LogIn className="mr-2 h-4 w-4" />
            Sign in with Grudge ID
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="font-serif tracking-widest border-primary/40"
            onClick={() => setShowToken((v) => !v)}
          >
            <Shield className="mr-2 h-4 w-4" />
            Enter verified token
          </Button>
        </div>
        {showToken && (
          <div className="w-full max-w-md space-y-2 text-left">
            <label className="font-serif text-[10px] uppercase tracking-widest text-muted-foreground">
              Paste JWT / sso_token
            </label>
            <Input
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="grudge_auth_token…"
              className="font-mono text-xs"
            />
            {tokenError && <p className="text-xs text-destructive">{tokenError}</p>}
            <Button className="w-full font-serif tracking-widest" onClick={submitToken}>
              Verify & enter
            </Button>
          </div>
        )}
        {me?.displayName && (
          <p className="text-[10px] font-mono text-muted-foreground">Session: {me.displayName}</p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
