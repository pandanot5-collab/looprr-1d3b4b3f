import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SubTier = "free" | "starter" | "pro" | "elite";

export interface TierInfo {
  tier: SubTier;
  /** Resolved HSL color string like "280 90% 60%" (no hsl() wrapper). */
  color: string | null;
}

interface State {
  globals: Record<SubTier, string>;
  /** userId -> { tier, override? } */
  users: Map<string, { tier: SubTier; override: string | null }>;
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
        .select("id, subscription_tier, tier_color_override"),
    ]);
    const globals: Record<SubTier, string> = { ...DEFAULTS };
    (tcRes.data ?? []).forEach((r: any) => {
      if (r?.tier && r?.color) globals[r.tier as SubTier] = r.color;
    });
    const users = new Map<string, { tier: SubTier; override: string | null }>();
    (profRes.data ?? []).forEach((p: any) => {
      users.set(p.id, {
        tier: (p.subscription_tier ?? "free") as SubTier,
        override: p.tier_color_override ?? null,
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
    if (!userId || !state) return { tier: "free", color: null };
    const u = state.users.get(userId);
    if (!u) return { tier: "free", color: null };
    if (u.tier === "free") return { tier: "free", color: null };
    return {
      tier: u.tier,
      color: u.override ?? state.globals[u.tier] ?? null,
    };
  };

  return {
    getTierInfo,
    globals: state?.globals ?? DEFAULTS,
  };
};
