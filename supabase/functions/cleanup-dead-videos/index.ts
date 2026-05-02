// Cron: scans non-dead videos and marks any whose source is gone.
// Invoke daily via pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VideoRow {
  id: string;
  url: string;
  platform: "youtube_shorts" | "tiktok";
}

async function isAlive(platform: string, url: string): Promise<boolean | null> {
  try {
    if (platform === "youtube_shorts") {
      const r = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      );
      if (r.status === 200) return true;
      if (r.status === 401 || r.status === 404) return false;
      return null;
    }
    if (platform === "tiktok") {
      const r = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      );
      if (r.status === 200) return true;
      if (r.status === 404 || r.status === 410) return false;
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require either the service-role key (cron / internal) or a shared cleanup secret.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cleanupSecret = Deno.env.get("CLEANUP_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  const providedSecret = req.headers.get("x-cleanup-secret") ?? "";
  const bearerOk = auth === `Bearer ${serviceKey}`;
  const secretOk = !!cleanupSecret && providedSecret === cleanupSecret;
  if (!bearerOk && !secretOk) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
  );

  // Pull oldest 200 unchecked / least-recently-checked videos
  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, url, platform")
    .eq("dead", false)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let dead = 0;
  let alive = 0;
  for (const v of (videos ?? []) as VideoRow[]) {
    const status = await isAlive(v.platform, v.url);
    if (status === false) {
      await supabase.from("videos").update({ dead: true, last_checked_at: new Date().toISOString() }).eq("id", v.id);
      dead++;
    } else {
      await supabase.from("videos").update({ last_checked_at: new Date().toISOString() }).eq("id", v.id);
      if (status === true) alive++;
    }
  }

  return new Response(JSON.stringify({ scanned: videos?.length ?? 0, dead, alive }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
