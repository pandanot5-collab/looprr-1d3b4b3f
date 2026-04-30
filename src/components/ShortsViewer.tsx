import { useEffect, useRef, useState } from "react";
import { Heart, ThumbsDown, Zap, Flag, X, ExternalLink, AlertTriangle, Trash2, Eye, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/AppShell";
import { UsernameDisplay } from "@/components/UsernameDisplay";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FeedVideo } from "@/components/VideoCard";
import { TikTokEmbed } from "@/components/TikTokEmbed";
import { Comments } from "@/components/Comments";
import { checkAndMarkOnView } from "@/lib/video-health";

interface Props {
  videos: FeedVideo[];
  startIndex?: number;
  onClose?: () => void;
  inline?: boolean;
}

interface Counts {
  like: number;
  dislike: number;
  boost: number;
  views: number;
  reports: number;
  flagged: boolean;
}

export const ShortsViewer = ({ videos: initialVideos, startIndex = 0, onClose, inline = false }: Props) => {
  const { user, isAdmin } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [videos, setVideos] = useState<FeedVideo[]>(initialVideos);

  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

  // Per-video state keyed by id
  const [counts, setCounts] = useState<Record<string, Counts>>(() =>
    Object.fromEntries(
      initialVideos.map((v) => [
        v.id,
        {
          like: v.like_count,
          dislike: v.dislike_count,
          boost: v.boost_count,
          views: (v as any).view_count ?? 0,
          reports: (v as any).report_count ?? 0,
          flagged: (v as any).flagged ?? false,
        },
      ]),
    ),
  );
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike" | null>>({});
  const [boosted, setBoosted] = useState<Record<string, boolean>>({});
  const [reported, setReported] = useState<Record<string, boolean>>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [commentsTarget, setCommentsTarget] = useState<FeedVideo | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  // Scroll to start index on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const child = el.children[startIndex] as HTMLElement | undefined;
    if (child) el.scrollTo({ top: child.offsetTop, behavior: "instant" as ScrollBehavior });
    if (!inline) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [startIndex, inline]);

  // Track active index via scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const i = Math.round(el.scrollTop / el.clientHeight);
      setActiveIndex(i);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Track views + on-view health check
  const viewedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const v = videos[activeIndex];
    if (!v) return;
    // Fire-and-forget health probe
    if (v.external_id) checkAndMarkOnView(v.id, v.platform, v.url);
    if (viewedRef.current.has(v.id)) return;
    const id = v.id;
    const t = setTimeout(async () => {
      if (viewedRef.current.has(id)) return;
      viewedRef.current.add(id);
      const { error } = await supabase.rpc("increment_video_view", { _video_id: id });
      if (!error) {
        setCounts((c) => ({ ...c, [id]: { ...c[id], views: (c[id]?.views ?? 0) + 1 } }));
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [activeIndex, videos]);

  // Load comment counts for visible videos
  useEffect(() => {
    const ids = videos.map((v) => v.id);
    if (ids.length === 0) return;
    (async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        ids.map(async (id) => {
          const { count } = await supabase
            .from("video_comments")
            .select("*", { count: "exact", head: true })
            .eq("video_id", id);
          counts[id] = count ?? 0;
        }),
      );
      setCommentCounts(counts);
    })();
  }, [videos]);

  // Load reactions/boosts/reports for user
  useEffect(() => {
    if (!user) return;
    const ids = videos.map((v) => v.id);
    if (ids.length === 0) return;
    (async () => {
      const [{ data: rxn }, { data: bst }, { data: rpt }] = await Promise.all([
        supabase.from("video_reactions").select("video_id, reaction").eq("user_id", user.id).in("video_id", ids),
        supabase
          .from("video_boosts")
          .select("video_id")
          .eq("user_id", user.id)
          .eq("boosted_on", new Date().toISOString().slice(0, 10))
          .in("video_id", ids),
        supabase.from("video_reports").select("video_id").eq("user_id", user.id).in("video_id", ids),
      ]);
      setReactions(Object.fromEntries((rxn ?? []).map((r: any) => [r.video_id, r.reaction])));
      setBoosted(Object.fromEntries((bst ?? []).map((b: any) => [b.video_id, true])));
      setReported(Object.fromEntries((rpt ?? []).map((r: any) => [r.video_id, true])));
    })();
  }, [user, videos]);

  // Esc to close
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const requireAuth = () => {
    if (!user) {
      toast("Sign in to interact");
      return false;
    }
    return true;
  };

  const handleReact = async (videoId: string, type: "like" | "dislike") => {
    if (!requireAuth() || !user) return;
    const current = reactions[videoId] ?? null;
    if (current === type) {
      await supabase.from("video_reactions").delete().eq("video_id", videoId).eq("user_id", user.id);
      setCounts((c) => ({ ...c, [videoId]: { ...c[videoId], [type]: Math.max(0, c[videoId][type] - 1) } }));
      setReactions((r) => ({ ...r, [videoId]: null }));
    } else if (current) {
      await supabase
        .from("video_reactions")
        .update({ reaction: type })
        .eq("video_id", videoId)
        .eq("user_id", user.id);
      setCounts((c) => ({
        ...c,
        [videoId]: {
          ...c[videoId],
          [type]: c[videoId][type] + 1,
          [current]: Math.max(0, c[videoId][current] - 1),
        },
      }));
      setReactions((r) => ({ ...r, [videoId]: type }));
    } else {
      await supabase.from("video_reactions").insert({ video_id: videoId, user_id: user.id, reaction: type });
      setCounts((c) => ({ ...c, [videoId]: { ...c[videoId], [type]: c[videoId][type] + 1 } }));
      setReactions((r) => ({ ...r, [videoId]: type }));
    }
  };

  const handleBoost = async (videoId: string) => {
    if (!requireAuth() || !user) return;
    if (boosted[videoId]) {
      toast("Already boosted today");
      return;
    }
    const { error } = await supabase.from("video_boosts").insert({ video_id: videoId, user_id: user.id });
    if (error) {
      if (error.code === "23505") toast("You've already boosted a video today");
      else toast("Could not boost", { description: error.message });
      return;
    }
    setBoosted((b) => ({ ...b, [videoId]: true }));
    setCounts((c) => ({ ...c, [videoId]: { ...c[videoId], boost: c[videoId].boost + 1 } }));
    toast("Boosted ⚡");
  };

  const openReport = (videoId: string) => {
    if (!requireAuth()) return;
    if (reported[videoId]) {
      toast("You've already reported this video");
      return;
    }
    setReportTarget(videoId);
    setReportReason("");
    setReportOpen(true);
  };

  const submitReport = async () => {
    if (!user || !reportTarget) return;
    const { error } = await supabase
      .from("video_reports")
      .insert({ video_id: reportTarget, user_id: user.id, reason: reportReason.trim() || null });
    if (error) {
      if (error.code === "23505") toast("Already reported");
      else toast("Could not report", { description: error.message });
      return;
    }
    setReported((r) => ({ ...r, [reportTarget]: true }));
    setCounts((c) => ({
      ...c,
      [reportTarget]: { ...c[reportTarget], reports: c[reportTarget].reports + 1 },
    }));
    setReportOpen(false);
    toast("Report submitted");
  };

  const requiredReports = (likes: number) => Math.max(3, 3 + Math.floor(likes / 10));

  const canDelete = (v: FeedVideo) => {
    if (!user) return false;
    if (isAdmin) return true;
    if (v.posted_by === user.id) return true;
    if (v.categories?.owner_id && v.categories.owner_id === user.id) return true;
    return false;
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    const { error } = await supabase.from("videos").delete().eq("id", id);
    setDeleteTarget(null);
    if (error) {
      toast("Couldn't delete", { description: error.message });
      return;
    }
    setVideos((prev) => prev.filter((v) => v.id !== id));
    toast("Video deleted");
  };


  return (
    <div className={cn(inline ? "relative w-full bg-black h-[calc(100vh-3.5rem-4rem)]" : "fixed inset-0 z-50 bg-black")}>
      {!inline && onClose && (
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div
        ref={containerRef}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory no-scrollbar"
      >
        {videos.map((v, idx) => {
          const c = counts[v.id];
          const r = reactions[v.id] ?? null;
          const b = !!boosted[v.id];
          const rep = !!reported[v.id];
          const required = requiredReports(c.like);
          const isActive = idx === activeIndex;
          return (
            <section
              key={v.id}
              className="snap-start h-full w-full relative flex items-center justify-center"
            >
              {/* Player */}
              <div className="relative w-full h-full max-w-[500px] mx-auto">
                {v.platform === "youtube_shorts" && v.external_id ? (
                  <iframe
                    key={isActive ? `${v.id}-active` : v.id}
                    src={`https://www.youtube.com/embed/${v.external_id}?rel=0&modestbranding=1&playsinline=1&autoplay=${isActive ? 1 : 0}&mute=${isActive ? 0 : 1}`}
                    title={v.title ?? "Short video"}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : v.platform === "tiktok" && v.external_id ? (
                  <div className="w-full h-full overflow-y-auto bg-black flex items-start justify-center">
                    <TikTokEmbed videoId={v.external_id} url={v.url} className="w-full" />
                  </div>
                ) : (
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-full flex flex-col items-center justify-center text-white gap-3 bg-gradient-to-br from-zinc-900 to-black relative"
                  >
                    {v.thumbnail_url && (
                      <img src={v.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                    )}
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <ExternalLink className="w-10 h-10" />
                      <span className="text-sm font-medium">Open on TikTok</span>
                    </div>
                  </a>
                )}

                {/* Bottom overlay: meta */}
                <div className="absolute left-0 right-0 bottom-0 p-4 pr-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white pointer-events-none">
                  <div className="pointer-events-auto flex flex-col gap-2">
                    <Link to={`/u/${v.profiles?.username}`} className="flex items-center gap-2 w-fit">
                      <Avatar username={v.profiles?.username ?? "?"} url={v.profiles?.avatar_url} size={32} />
                      <span className="text-sm font-semibold">
                        <UsernameDisplay userId={v.posted_by} username={v.profiles?.username} iconSize={14} />
                      </span>
                    </Link>
                    {v.categories && (
                      <Link to={`/c/${v.categories.slug}`} className="text-xs text-white/80 w-fit">
                        #{v.categories.name}
                      </Link>
                    )}
                    {v.title && <p className="text-sm leading-snug line-clamp-2">{v.title}</p>}
                    {c.flagged && (
                      <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Flagged by community</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side action rail */}
                <div className="absolute right-2 bottom-24 flex flex-col items-center gap-4 text-white">
                  <RailButton
                    icon={<Heart className={cn("w-7 h-7", r === "like" && "fill-current text-red-500")} />}
                    label={c.like}
                    onClick={() => handleReact(v.id, "like")}
                  />
                  <RailButton
                    icon={<ThumbsDown className={cn("w-7 h-7", r === "dislike" && "fill-current")} />}
                    label={c.dislike}
                    onClick={() => handleReact(v.id, "dislike")}
                  />
                  <RailButton
                    icon={<Zap className={cn("w-7 h-7", b && "fill-current text-yellow-400")} />}
                    label={c.boost}
                    onClick={() => handleBoost(v.id)}
                  />
                  <RailButton
                    icon={<MessageCircle className="w-7 h-7" />}
                    label={commentCounts[v.id] ?? 0}
                    onClick={() => setCommentsTarget(v)}
                  />
                  <RailButton
                    icon={<Eye className="w-6 h-6" />}
                    label={c.views}
                    onClick={() => {}}
                    small
                  />
                  <RailButton
                    icon={<Flag className={cn("w-6 h-6", rep && "fill-current text-orange-400")} />}
                    label={`${c.reports}/${required}`}
                    onClick={() => openReport(v.id)}
                    small
                  />
                  {canDelete(v) && (
                    <RailButton
                      icon={<Trash2 className="w-6 h-6 text-red-400" />}
                      label=""
                      onClick={() => setDeleteTarget(v.id)}
                      small
                    />
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the video from this category. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report video</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tell us what's wrong. Popular videos require more reports before being flagged.
          </p>
          <Textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReport}>Submit report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!commentsTarget} onOpenChange={(o) => !o && setCommentsTarget(null)}>
        <SheetContent side="bottom" className="h-[80vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>Comments</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto pt-3">
            {commentsTarget && (
              <Comments
                videoId={commentsTarget.id}
                videoOwnerId={commentsTarget.posted_by}
                categoryOwnerId={commentsTarget.categories?.owner_id}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const RailButton = ({
  icon,
  label,
  onClick,
  small,
}: {
  icon: React.ReactNode;
  label: number | string;
  onClick: () => void;
  small?: boolean;
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
  >
    <span
      className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-black/70 transition-colors ring-1 ring-white/40 border border-black/60"
      style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.5)" }}
    >
      {icon}
    </span>
    <span
      className={cn("font-mono tabular-nums", small ? "text-[10px]" : "text-xs")}
      style={{ textShadow: "0 0 3px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)" }}
    >
      {label}
    </span>
  </button>
);
