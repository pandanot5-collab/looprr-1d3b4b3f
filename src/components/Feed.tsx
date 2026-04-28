import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FeedVideo } from "@/components/VideoCard";
import { ShortsViewer } from "@/components/ShortsViewer";
import { Loader2 } from "lucide-react";
import { PlatformFilter, type PlatformFilterValue } from "@/components/PlatformFilter";

export const Feed = () => {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PlatformFilterValue>("all");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("videos")
        .select(
          "id, url, platform, external_id, title, thumbnail_url, like_count, dislike_count, boost_count, view_count, report_count, flagged, created_at, posted_by, category_id, profiles!videos_posted_by_fkey(username, avatar_url, banned), categories(name, slug, owner_id)"
        )
        .eq("dead", false)
        .order("boost_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(80);
      // Hide content from banned users
      const filtered = (data ?? []).filter((v: any) => !v.profiles?.banned);
      setVideos(filtered as any);
      setLoading(false);
    };
    load();
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return videos;
    return videos.filter((v) => v.platform === filter);
  }, [videos, filter]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Empty loop</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          No videos posted yet. Be the first — paste a TikTok or YouTube Shorts link to seed your category.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="px-3 pt-2">
        <PlatformFilter value={filter} onChange={setFilter} />
      </div>
      {visible.length === 0 ? (
        <div className="min-h-[40vh] flex items-center justify-center px-6 text-sm text-muted-foreground">
          No videos match this filter.
        </div>
      ) : (
        <ShortsViewer videos={visible} inline />
      )}
    </div>
  );
};
