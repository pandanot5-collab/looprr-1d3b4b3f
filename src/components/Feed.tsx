import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FeedVideo } from "@/components/VideoCard";
import { ShortsViewer } from "@/components/ShortsViewer";
import { Loader2 } from "lucide-react";

export const Feed = () => {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("videos")
        .select(
          "id, url, platform, external_id, title, thumbnail_url, like_count, dislike_count, boost_count, report_count, flagged, created_at, posted_by, category_id, profiles!videos_posted_by_fkey(username, avatar_url), categories(name, slug)"
        )
        .order("boost_count", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      setVideos((data as any) ?? []);
      setLoading(false);
    };
    load();
  }, []);

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

  return <ShortsViewer videos={videos} inline />;
};
