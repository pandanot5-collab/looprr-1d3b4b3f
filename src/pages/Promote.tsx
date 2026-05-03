import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { parseVideoUrl } from "@/lib/video-utils";

const CPM_USD = 0.01; // $0.01 per active user per 1000 impressions

const Promote = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [googleSlot, setGoogleSlot] = useState("");
  const [adType, setAdType] = useState<"promoted_short" | "google">("promoted_short");
  const [impressions, setImpressions] = useState(1000);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    supabase.rpc("get_active_user_count").then(({ data }) => {
      setActiveUsers(typeof data === "number" ? data : 0);
    });
  }, [user, authLoading, navigate]);

  const cost = activeUsers != null ? (CPM_USD * activeUsers * impressions) / 1000 : 0;

  const handleSubmit = async () => {
    if (!user) return;
    let payload: any = {
      posted_by: user.id,
      ad_type: adType,
      target_impressions: impressions,
      paid_amount_cents: Math.round(cost * 100),
    };
    if (adType === "google") {
      if (!googleSlot.trim()) return toast("Enter a Google ad slot ID");
      payload.google_slot = googleSlot.trim();
      payload.title = title.trim() || "Google Ad";
    } else {
      const parsed = parseVideoUrl(url);
      if (!parsed) return toast("Enter a valid TikTok or YouTube Shorts URL");
      payload.url = url.trim();
      payload.platform = parsed.platform;
      payload.external_id = parsed.externalId;
      payload.thumbnail_url = parsed.thumbnailUrl || null;
      payload.title = title.trim() || null;
    }
    setSubmitting(true);
    const { error } = await supabase.from("ads").insert(payload);
    setSubmitting(false);
    if (error) {
      console.error(error);
      toast("Couldn't create ad");
      return;
    }
    toast("Ad live ⚡", { description: "Your ad will start appearing in feeds." });
    navigate("/");
  };

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-md mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-400" /> Promote
          </h1>
          <p className="text-muted-foreground text-sm">
            Boost a short to the top of every feed as a sponsored slot.
          </p>
        </div>

        <div className="surface-elevated border border-border rounded-2xl p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Active in last 5h</p>
            <p className="text-2xl font-bold tabular-nums">
              {activeUsers == null ? <Loader2 className="w-5 h-5 animate-spin" /> : activeUsers.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setAdType("promoted_short")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${adType === "promoted_short" ? "bg-foreground text-background border-foreground" : "border-border"}`}
          >
            Promoted short
          </button>
          <button
            onClick={() => setAdType("google")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${adType === "google" ? "bg-foreground text-background border-foreground" : "border-border"}`}
          >
            Google Ad
          </button>
        </div>

        {adType === "promoted_short" ? (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Video URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/shorts/..." className="h-12" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Google Ad Slot ID</label>
            <Input value={googleSlot} onChange={(e) => setGoogleSlot(e.target.value)} placeholder="ca-pub-XXXX/slot-id" className="h-12" />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title (optional)</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className="h-12" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Target impressions: {impressions.toLocaleString()}
          </label>
          <input
            type="range"
            min={500}
            max={50000}
            step={500}
            value={impressions}
            onChange={(e) => setImpressions(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="surface-elevated border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Estimated cost</span>
            <span className="text-3xl font-bold tabular-nums">${cost.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            ${CPM_USD.toFixed(2)} × {activeUsers ?? 0} active users per 1,000 impressions.
          </p>
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="h-12 text-base">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-2" /> Launch ad</>}
        </Button>
        <p className="text-[10px] text-muted-foreground text-center">
          Payment is mocked for now — ad is created immediately.
        </p>
      </div>
    </AppShell>
  );
};

export default Promote;
