import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { consumeAuthCallback, fetchAuthMe, fetchAccountGbux } from "@/data/grudgeAuth";
import { ensureEconomyBootstrapped, setGbux } from "@/data/flareEconomy";

/**
 * SSO return landing — stores JWT, syncs GBUX, grants starter economy, redirects.
 */
export default function AuthCallback() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState("Verifying Grudge Studio session…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      ensureEconomyBootstrapped();
      const { token, next } = consumeAuthCallback();
      if (!token) {
        setStatus("No token received — redirecting to sign-in…");
        setTimeout(() => navigate("/account?needLogin=1"), 800);
        return;
      }
      setStatus("Session stored. Syncing account…");
      const me = await fetchAuthMe();
      if (cancelled) return;
      if (me.gbux != null) setGbux(me.gbux);
      else {
        const g = await fetchAccountGbux();
        if (g != null && !cancelled) setGbux(g);
      }
      setStatus(me.displayName ? `Welcome, ${me.displayName}` : "Welcome to production Flare");
      setTimeout(() => {
        // Capital Harbor is production start; honor explicit next when set
        if (!cancelled) navigate(next && next !== "/" ? next : "/camp");
      }, 600);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
      <p className="font-serif text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Flare Boss · Production
      </p>
      <p className="font-serif text-lg text-[#c5a059] animate-pulse">{status}</p>
    </div>
  );
}
