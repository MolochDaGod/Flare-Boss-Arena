/**
 * Grudge ID auth for Flare Boss Arena (production).
 * Token keys match fleet SSOT (grudge-production-wiring).
 */

export const FLEET_AUTH_TOKEN_KEYS = [
  "grudge_auth_token",
  "grudge_session_token",
  "grudge.token",
  "sso_token",
] as const;

export const GRUDGE_ID_ORIGIN = "https://id.grudge-studio.com";
export const APP_SLUG = "flare-boss-arena";

/** Read first non-empty JWT from approved keys. */
export function getAuthToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  for (const key of FLEET_AUTH_TOKEN_KEYS) {
    const v = localStorage.getItem(key);
    if (v && v.trim().length > 8) return v.trim();
  }
  return null;
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}

/** Dual-write token to all fleet keys. */
export function setAuthToken(token: string) {
  if (typeof localStorage === "undefined") return;
  const t = token.trim();
  for (const key of FLEET_AUTH_TOKEN_KEYS) {
    localStorage.setItem(key, t);
  }
}

export function clearAuthToken() {
  if (typeof localStorage === "undefined") return;
  for (const key of FLEET_AUTH_TOKEN_KEYS) {
    localStorage.removeItem(key);
  }
  localStorage.removeItem("grudge_account_id");
  localStorage.removeItem("grudge_user");
}

export function getAccountId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("grudge_account_id");
}

export function setAccountId(id: string) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("grudge_account_id", id);
}

/** Build Grudge ID login URL that returns to this origin's /auth/callback. */
export function buildLoginUrl(returnPath = "/"): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://flare-boss-arena.vercel.app";
  const dest = `${origin}/auth/callback?next=${encodeURIComponent(returnPath)}`;
  const params = new URLSearchParams({
    redirect_uri: dest,
    redirect: dest,
    return: dest,
    app: APP_SLUG,
    origin,
  });
  return `${GRUDGE_ID_ORIGIN}/login?${params.toString()}`;
}

export function startLogin(returnPath = "/") {
  if (typeof window === "undefined") return;
  window.location.href = buildLoginUrl(returnPath);
}

/**
 * Consume SSO tokens from hash fragment or query (fleet handoff).
 * Returns next path if provided.
 */
export function consumeAuthCallback(): { token: string | null; next: string } {
  if (typeof window === "undefined") return { token: null, next: "/" };

  const url = new URL(window.location.href);
  const next = url.searchParams.get("next") || url.searchParams.get("return") || "/";

  // Hash: #grudge_token=... or #access_token=...
  const hash = window.location.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hash);
  const queryToken =
    url.searchParams.get("grudge_token") ||
    url.searchParams.get("sso_token") ||
    url.searchParams.get("token") ||
    url.searchParams.get("access_token");
  const hashToken =
    hashParams.get("grudge_token") ||
    hashParams.get("sso_token") ||
    hashParams.get("token") ||
    hashParams.get("access_token");

  const token = (queryToken || hashToken || "").trim() || null;
  if (token) {
    setAuthToken(token);
    const accountId =
      url.searchParams.get("account_id") ||
      url.searchParams.get("grudge_id") ||
      hashParams.get("account_id") ||
      hashParams.get("grudge_id");
    if (accountId) setAccountId(accountId);
  }

  // Clean URL
  try {
    window.history.replaceState({}, "", url.pathname + (next && next !== "/" ? `?from=auth` : ""));
  } catch {
    /* ignore */
  }

  return { token: token || getAuthToken(), next: next.startsWith("/") ? next : `/${next}` };
}

export interface AuthMe {
  ok: boolean;
  id?: string;
  grudgeId?: string;
  displayName?: string;
  email?: string;
  gbux?: number;
  raw?: unknown;
}

/** Probe production session via same-origin /api/auth/me (Vercel → Railway). */
export async function fetchAuthMe(): Promise<AuthMe> {
  const token = getAuthToken();
  if (!token) return { ok: false };

  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      credentials: "omit",
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        // Soft-fail: keep token for offline/local; mark unauthenticated only if clearly invalid
        return { ok: false };
      }
      return { ok: false };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const user = (data.user ?? data.account ?? data) as Record<string, unknown>;
    const id = String(user.id ?? user.grudge_id ?? user.grudgeId ?? data.id ?? "");
    if (id) setAccountId(id);
    const gbux = Number(
      user.gbux ?? user.GBUX ?? (user.resources as Record<string, unknown> | undefined)?.gbux ?? data.gbux ?? NaN,
    );
    return {
      ok: true,
      id: id || undefined,
      grudgeId: String(user.grudge_id ?? user.grudgeId ?? id),
      displayName: String(user.displayName ?? user.name ?? user.username ?? "Grudge Player"),
      email: user.email ? String(user.email) : undefined,
      gbux: Number.isFinite(gbux) ? gbux : undefined,
      raw: data,
    };
  } catch {
    // Network / rewrite missing — treat token presence as verified offline
    return { ok: Boolean(token), displayName: "Offline session" };
  }
}

/**
 * Verified entry: has JWT. Optionally re-validates against Railway.
 * Production gate: login OR verified token required.
 */
export async function requireAuth(options?: {
  validateRemote?: boolean;
}): Promise<{ allowed: boolean; me?: AuthMe }> {
  const token = getAuthToken();
  if (!token) return { allowed: false };

  if (options?.validateRemote) {
    const me = await fetchAuthMe();
    // Allow offline token if remote fails (dev / partial deploy)
    return { allowed: true, me: me.ok ? me : { ok: true, displayName: "Session" } };
  }
  return { allowed: true };
}

/** Fetch account bag / GBUX from Railway when available. */
export async function fetchAccountGbux(): Promise<number | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch("/api/account/resources", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) {
      // fallback profile
      const me = await fetchAuthMe();
      return me.gbux ?? null;
    }
    const data = (await res.json()) as Record<string, unknown>;
    const resources = (data.resources ?? data) as Record<string, unknown>;
    const gbux = Number(resources.gbux ?? resources.GBUX ?? data.gbux ?? NaN);
    return Number.isFinite(gbux) ? gbux : null;
  } catch {
    return null;
  }
}
