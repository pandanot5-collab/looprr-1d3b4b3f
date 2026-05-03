import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Pings the server every 2 minutes so we can count active users in the last 5h.
export const useHeartbeat = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const ping = () => supabase.rpc("upsert_heartbeat");
    ping();
    const id = setInterval(ping, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);
};
