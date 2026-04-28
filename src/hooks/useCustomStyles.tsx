import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomStyle {
  gradient: string | null;
  iconUrl: string | null;
}

let cache: Map<string, CustomStyle> | null = null;
let inflight: Promise<Map<string, CustomStyle>> | null = null;
const listeners = new Set<() => void>();

const fetchAll = async (): Promise<Map<string, CustomStyle>> => {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, custom_gradient, custom_icon_url")
      .or("custom_gradient.not.is.null,custom_icon_url.not.is.null");
    const map = new Map<string, CustomStyle>();
    (data ?? []).forEach((p: any) => {
      map.set(p.id, { gradient: p.custom_gradient, iconUrl: p.custom_icon_url });
    });
    cache = map;
    inflight = null;
    listeners.forEach((l) => l());
    return map;
  })();
  return inflight;
};

export const refreshCustomStyles = () => {
  cache = null;
  inflight = null;
  fetchAll();
};

export const useCustomStyles = () => {
  const [map, setMap] = useState<Map<string, CustomStyle>>(cache ?? new Map());
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
