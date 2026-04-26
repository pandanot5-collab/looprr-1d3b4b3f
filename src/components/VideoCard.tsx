import { useEffect, useState } from "react";
import { Heart, ThumbsDown, Zap, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/AppShell";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TikTokEmbed } from "@/components/TikTokEmbed";
import { UsernameDisplay } from "@/components/UsernameDisplay";

export interface FeedVideo {
  id: string;
  url: string;
  platform: "tiktok" | "youtube_shorts";
  external_id: string | null;
  title: string | null;
  thumbnail_url: string | null;
  like_count: number;
  dislike_count: number;
  boost_count: number;
  created_at: string;
  posted_by: string;
  category_id: string;
  profiles: { username: string; avatar_url: string | null } | null;
  categories: { name: string; slug: string } | null;
}

export const VideoCard = ({ video, onMutate, onOpen }: { video: FeedVideo; onMutate?: () => void; onOpen?: () => void }) => {
  const { user } = useAuth();
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [boosted, setBoosted] = useState(false);
  const [counts, setCounts] = useState({
    like: video.like_count,
    dislike: video.dislike_count,
    boost: video.boost_count,
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("video_reactions")
      .select("reaction")
      .eq("video_id", video.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setReaction((data?.reaction as "like" | "dislike") ?? null));

    supabase
      .from("video_boosts")
      .select("id")
      .eq("video_id", video.id)
      .eq("user_id", user.id)
      .eq("boosted_on", new Date().toISOString().slice(0, 10))
      .maybeSingle()
      .then(({ data }) => setBoosted(!!data));
  }, [user, video.id]);

  const requireAuth = () => {
    if (!user) {
      toast("Sign in to interact", { description: "Create an account to like and boost videos." });
      return false;
    }
    return true;
  };

  const handleReact = async (type: "like" | "dislike") => {
    if (!requireAuth() || !user) return;
    if (reaction === type) {
      // remove
      await supabase.from("video_reactions").delete().eq("video_id", video.id).eq("user_id", user.id);
      setCounts((c) => ({ ...c, [type]: Math.max(0, c[type] - 1) }));
      setReaction(null);
    } else if (reaction) {
      await supabase
        .from("video_reactions")
        .update({ reaction: type })
        .eq("video_id", video.id)
        .eq("user_id", user.id);
      setCounts((c) => ({
        ...c,
        [type]: c[type] + 1,
        [reaction]: Math.max(0, c[reaction] - 1),
      }));
      setReaction(type);
    } else {
      await supabase.from("video_reactions").insert({ video_id: video.id, user_id: user.id, reaction: type });
      setCounts((c) => ({ ...c, [type]: c[type] + 1 }));
      setReaction(type);
    }
  };

  const handleBoost = async () => {
    if (!requireAuth() || !user) return;
    if (boosted) {
      toast("Already used your daily boost");
      return;
    }
    const { error } = await supabase
      .from("video_boosts")
      .insert({ video_id: video.id, user_id: user.id });
    if (error) {
      if (error.code === "23505") toast("You've already boosted a video today");
      else toast("Could not boost", { description: error.message });
      return;
    }
    setBoosted(true);
    setCounts((c) => ({ ...c, boost: c.boost + 1 }));
    toast("Boosted ⚡", { description: "This video will rank higher in the feed." });
  };

  return (
    <article className="snap-start-always min-h-[calc(100vh-8.5rem)] flex flex-col py-3 px-3">
      <div className="surface-elevated border border-border rounded-2xl overflow-hidden flex flex-col flex-1">
        {/* Video player */}
        <div className="relative bg-black aspect-[9/16] w-full max-h-[70vh] group">
          {video.platform === "youtube_shorts" && video.external_id ? (
            <iframe
              src={`https://www.youtube.com/embed/${video.external_id}?rel=0&modestbranding=1&playsinline=1`}
              title={video.title ?? "Short video"}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : video.platform === "tiktok" && video.external_id ? (
            <div className="w-full h-full overflow-y-auto bg-black flex items-start justify-center">
              <TikTokEmbed videoId={video.external_id} url={video.url} className="w-full" />
            </div>
          ) : (
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-full flex flex-col items-center justify-center text-white gap-3 bg-gradient-to-br from-zinc-900 to-black"
            >
              {video.thumbnail_url && (
                <img src={video.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
              )}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <ExternalLink className="w-8 h-8" />
                <span className="text-sm font-medium">Open on TikTok</span>
              </div>
            </a>
          )}
        </div>

        {/* Meta */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar username={video.profiles?.username ?? "?"} url={video.profiles?.avatar_url} size={32} />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  <UsernameDisplay userId={video.posted_by} username={video.profiles?.username} />
                </p>
                {video.categories && (
                  <Link
                    to={`/c/${video.categories.slug}`}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    #{video.categories.name}
                  </Link>
                )}
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">
              {video.platform === "tiktok" ? "TikTok" : "YT Short"}
            </span>
          </div>

          {video.title && <p className="text-sm leading-snug">{video.title}</p>}

          {/* Actions */}
          <div className="flex items-center gap-1 pt-1">
            <ActionButton
              active={reaction === "like"}
              onClick={() => handleReact("like")}
              icon={<Heart className={cn("w-4 h-4", reaction === "like" && "fill-current")} />}
              label={counts.like}
            />
            <ActionButton
              active={reaction === "dislike"}
              onClick={() => handleReact("dislike")}
              icon={<ThumbsDown className={cn("w-4 h-4", reaction === "dislike" && "fill-current")} />}
              label={counts.dislike}
            />
            <ActionButton
              active={boosted}
              onClick={handleBoost}
              icon={<Zap className={cn("w-4 h-4", boosted && "fill-current")} />}
              label={counts.boost}
              accent
            />
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 h-9 rounded-full hover:bg-muted transition-colors"
            >
              Source <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};

const ActionButton = ({
  icon,
  label,
  active,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: number;
  active?: boolean;
  onClick: () => void;
  accent?: boolean;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium transition-all",
      "hover:bg-muted",
      active && !accent && "bg-foreground text-background hover:bg-foreground hover:opacity-90",
      active && accent && "bg-accent text-accent-foreground hover:bg-accent hover:opacity-90"
    )}
  >
    {icon}
    <span className="font-mono text-xs tabular-nums">{label}</span>
  </button>
);
