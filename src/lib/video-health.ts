import { supabase } from "@/integrations/supabase/client";

/**
 * Best-effort client-side check whether a video still exists at its source.
 * - YouTube: oembed returns 401/404 if private/deleted.
 * - TikTok: oembed returns 404/410 if removed (often returns 200 even if private).
 * Returns true if the video appears alive, false if confirmed dead, null if unknown.
 */
export async function checkVideoAlive(
  platform: "youtube_shorts" | "tiktok",
  url: string,
): Promise<boolean | null> {
  try {
    if (platform === "youtube_shorts") {
      const r = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { method: "GET", mode: "cors" },
      );
      if (r.status === 200) return true;
      if (r.status === 401 || r.status === 404) return false;
      return null;
    }
    if (platform === "tiktok") {
      const r = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
        { method: "GET", mode: "cors" },
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

const seen = new Set<string>();

/**
 * Fire-and-forget on-view check. Marks a video dead in the DB if its source
 * is gone. Skips repeats within the same session.
 */
export function checkAndMarkOnView(
  videoId: string,
  platform: "youtube_shorts" | "tiktok",
  url: string,
) {
  if (seen.has(videoId)) return;
  seen.add(videoId);
  void (async () => {
    const alive = await checkVideoAlive(platform, url);
    if (alive === false) {
      await supabase.rpc("mark_video_dead", { _video_id: videoId });
    } else if (alive === true) {
      await supabase.rpc("mark_video_alive", { _video_id: videoId });
    }
  })();
}
