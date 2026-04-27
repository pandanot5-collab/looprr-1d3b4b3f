import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CreatorPlatform = "youtube" | "tiktok";

export interface CreatorBadge {
  user_id: string;
  platform: CreatorPlatform;
  handle: string | null;
  subscriber_count: number;
}

// Module-level cache so every UsernameDisplay shares one fetch
let cache: Map<string, CreatorBadge[]> | null = null;
let inflight: Promise<Map<string, CreatorBadge[]>> | null = null;
const listeners = new Set<() => void>();

const fetchAll = async (): Promise<Map<string, CreatorBadge[]>> => {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("creator_badges")
      .select("user_id, platform, handle, subscriber_count");
    const map = new Map<string, CreatorBadge[]>();
    (data ?? []).forEach((b: any) => {
      const arr = map.get(b.user_id) ?? [];
      arr.push(b as CreatorBadge);
      map.set(b.user_id, arr);
    });
    cache = map;
    inflight = null;
    listeners.forEach((l) => l());
    return map;
  })();
  return inflight;
};

export const refreshCreatorBadges = () => {
  cache = null;
  inflight = null;
  fetchAll();
};

export const useCreatorBadges = () => {
  const [map, setMap] = useState<Map<string, CreatorBadge[]>>(cache ?? new Map());

  useEffect(() => {
    const update = () => setMap(new Map(cache ?? new Map()));
    listeners.add(update);
    fetchAll().then(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  return map;
};
