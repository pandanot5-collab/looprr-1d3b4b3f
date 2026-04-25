import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { VideoCard, FeedVideo } from "@/components/VideoCard";
import { Avatar } from "@/components/AppShell";
import { Loader2 } from "lucide-react";

const Category = () => {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<any>(null);
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data: cat } = await supabase
        .from("categories")
        .select("id, name, slug, description, owner_id, profiles!categories_owner_id_fkey(username, avatar_url)")
        .eq("slug", slug)
        .maybeSingle();
      setCategory(cat);

      if (cat) {
        const { data: vids } = await supabase
          .from("videos")
          .select(
            "id, url, platform, external_id, title, thumbnail_url, like_count, dislike_count, boost_count, created_at, posted_by, category_id, profiles!videos_posted_by_fkey(username, avatar_url), categories(name, slug)"
          )
          .eq("category_id", cat.id)
          .order("boost_count", { ascending: false })
          .order("created_at", { ascending: false });
        setVideos((vids as any) ?? []);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!category) {
    return (
      <AppShell>
        <div className="px-6 py-12 text-center">
          <h1 className="text-xl font-semibold mb-2">Category not found</h1>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 py-6 border-b border-border">
        <h1 className="text-3xl font-bold tracking-tight mb-2">#{category.name}</h1>
        {category.description && (
          <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
        )}
        <div className="flex items-center gap-2 text-sm">
          <Avatar username={category.profiles?.username ?? "?"} url={category.profiles?.avatar_url} size={24} />
          <span className="text-muted-foreground">curated by</span>
          <span className="font-semibold">@{category.profiles?.username}</span>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">
          No videos in this category yet.
        </div>
      ) : (
        <div className="snap-y-mandatory overflow-y-auto no-scrollbar h-[calc(100vh-3.5rem-4rem-9rem)]">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </AppShell>
  );
};

export default Category;
