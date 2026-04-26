import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Simple in-memory cache so we don't refetch the admin set on every render
let cachedAdmins: Set<string> | null = null;
let inFlight: Promise<Set<string>> | null = null;
const subscribers = new Set<(s: Set<string>) => void>();

const loadAdmins = async (): Promise<Set<string>> => {
  if (cachedAdmins) return cachedAdmins;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const set = new Set<string>((data ?? []).map((r: any) => r.user_id));
    cachedAdmins = set;
    inFlight = null;
    subscribers.forEach((cb) => cb(set));
    return set;
  })();
  return inFlight;
};

export const useAdminUsers = () => {
  const [admins, setAdmins] = useState<Set<string>>(cachedAdmins ?? new Set());

  useEffect(() => {
    let mounted = true;
    loadAdmins().then((s) => mounted && setAdmins(s));
    const cb = (s: Set<string>) => mounted && setAdmins(new Set(s));
    subscribers.add(cb);
    return () => {
      mounted = false;
      subscribers.delete(cb);
    };
  }, []);

  return admins;
};

export const isUserAdmin = (userId: string | null | undefined) => {
  if (!userId || !cachedAdmins) return false;
  return cachedAdmins.has(userId);
};
