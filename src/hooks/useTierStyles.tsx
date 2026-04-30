import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubTier = "free" | "starter" | "pro" | "elite";

export interface TierInfo {
  /** Effective tier (free if expired). */
  tier: SubTier;
  /** Tier they USED to have (only meaningful when expired). */
  pastTier: SubTier | null;
  /** True when sub has lapsed (was paid, now expired). */
  expired: boolean;
  /** Resolved HSL color string like "280 90% 60%" (no hsl() wrapper) — null for free with no history. */
  color: string | null;
}

interface UserRow {
  tier: SubTier;
  override: string | null;
  profileColor: string | null;
  videoColor: string | null;
  expiresAt: string | null;
  lastPaidTier: SubTier | null;
}

interface State {
  globals: Record<SubTier, string>;
  users: Map<string, UserRow>;
}

const DEFAULTS: Record<SubTier, string> = {
  free: "0 0% 50%",
  starter: "200 90% 55%",
  pro: "280 90% 60%",
  elite: "45 100% 55%",
};

let cache: State | null = null;
let inflight: Promise<State> | null = null;
const listeners = new Set<() => void>();

const fetchAll = async (): Promise<State> => {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const [tcRes, profRes] = await Promise.all([
      supabase.from("tier_colors").select("tier, color"),
      supabase
        .from("profiles")
        .select(
          "id, subscription_tier, tier_color_override, profile_color, video_color, subscription_expires_at, last_paid_tier",
        ),
    ]);
    const globals: Record<SubTier, string> = { ...DEFAULTS };
    (tcRes.data ?? []).forEach((r: any) => {
      if (r?.tier && r?.color) globals[r.tier as SubTier] = r.color;
    });
    const users = new Map<string, UserRow>();
    (profRes.data ?? []).forEach((p: any) => {
      users.set(p.id, {
        tier: (p.subscription_tier ?? "free") as SubTier,
        override: p.tier_color_override ?? null,
        profileColor: p.profile_color ?? null,
        videoColor: p.video_color ?? null,
        expiresAt: p.subscription_expires_at ?? null,
        lastPaidTier: (p.last_paid_tier ?? null) as SubTier | null,
      });
    });
    cache = { globals, users };
    inflight = null;
    listeners.forEach((l) => l());
    return cache;
  })();
  return inflight;
};

export const refreshTierStyles = () => {
  cache = null;
  inflight = null;
  fetchAll();
};

/** Desaturate an HSL triplet "H S% L%" — drops saturation by 65% and shifts lightness toward gray. */
const fadeHsl = (hsl: string): string => {
  const m = hsl.match(/^\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/);
  if (!m) return hsl;
  const h = parseFloat(m[1]);
  const s = Math.round(parseFloat(m[2]) * 0.25);
  const l = Math.round(parseFloat(m[3]) * 0.7 + 30 * 0.3); // pull toward 30% lightness
  return `${h} ${s}% ${l}%`;
};

const isExpired = (u: UserRow | undefined): boolean => {
  if (!u || !u.expiresAt) return false;
  return new Date(u.expiresAt).getTime() < Date.now();
};

export const useTierStyles = () => {
  const [state, setState] = useState<State | null>(cache);
  useEffect(() => {
    const update = () => setState(cache ? { ...cache } : null);
    listeners.add(update);
    fetchAll().then(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const getTierInfo = (userId: string | null | undefined): TierInfo => {
    if (!userId || !state) {
      return { tier: "free", pastTier: null, expired: false, color: null };
    }
    const u = state.users.get(userId);
    if (!u) return { tier: "free", pastTier: null, expired: false, color: null };

    const expired = isExpired(u) && u.tier !== "free";
    // Effective tier: if expired, treat as free
    const effective: SubTier = expired ? "free" : u.tier;

    if (effective !== "free") {
      // Active paid: full color
      const color = u.override ?? state.globals[effective] ?? null;
      return { tier: effective, pastTier: null, expired: false, color };
    }

    // Free OR expired
    if (expired && u.lastPaidTier && u.lastPaidTier !== "free") {
      // Faded "former member" look using their previous tier color
      const baseColor = u.override ?? state.globals[u.lastPaidTier] ?? null;
      return {
        tier: "free",
        pastTier: u.lastPaidTier,
        expired: true,
        color: baseColor ? fadeHsl(baseColor) : null,
      };
    }

    return { tier: "free", pastTier: null, expired: false, color: null };
  };

  /** Color used for a person's profile page accent. Falls back to tier color. */
  const getProfileColor = (userId: string | null | undefined): string | null => {
    if (!userId || !state) return null;
    const u = state.users.get(userId);
    if (!u) return null;
    const expired = isExpired(u) && u.tier !== "free";
    if (u.profileColor) return expired ? fadeHsl(u.profileColor) : u.profileColor;
    return getTierInfo(userId).color;
  };

  /** Color used for the border + UI accents on a creator's videos. Falls back to tier color. */
  const getVideoColor = (userId: string | null | undefined): string | null => {
    if (!userId || !state) return null;
    const u = state.users.get(userId);
    if (!u) return null;
    const expired = isExpired(u) && u.tier !== "free";
    if (u.videoColor) return expired ? fadeHsl(u.videoColor) : u.videoColor;
    return getTierInfo(userId).color;
  };

  return {
    getTierInfo,
    getProfileColor,
    getVideoColor,
    globals: state?.globals ?? DEFAULTS,
  };
};
