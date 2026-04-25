import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, Avatar } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, ChevronRight } from "lucide-react";

const Profile = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ videos: 0, totalLikes: 0, totalBoosts: 0 });
  const [category, setCategory] = useState<{ name: string; slug: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    supabase
      .from("categories")
      .select("name, slug")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => setCategory(data));

    supabase
      .from("videos")
      .select("like_count, boost_count")
      .eq("posted_by", user.id)
      .then(({ data }) => {
        if (!data) return;
        setStats({
          videos: data.length,
          totalLikes: data.reduce((s, v) => s + v.like_count, 0),
          totalBoosts: data.reduce((s, v) => s + v.boost_count, 0),
        });
      });
  }, [user, loading, navigate]);

  if (loading || !profile) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-4 py-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Avatar username={profile.username} url={profile.avatar_url} size={72} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">@{profile.username}</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {profile.is_subscriber ? "PRO MEMBER" : "FREE TIER"}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Videos" value={stats.videos} />
          <Stat label="Likes" value={stats.totalLikes} />
          <Stat label="Boosts" value={stats.totalBoosts} />
        </div>

        {/* Category */}
        {category ? (
          <Link
            to={`/c/${category.slug}`}
            className="surface-elevated border border-border rounded-2xl p-4 flex items-center justify-between hover:border-foreground transition-colors"
          >
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Your category
              </span>
              <p className="text-lg font-semibold">#{category.name}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
        ) : (
          <Link
            to="/post"
            className="surface-subtle border border-dashed border-border rounded-2xl p-4 text-center text-sm text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
          >
            Create your category to start posting →
          </Link>
        )}

        {/* Sign out */}
        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
          className="h-12 mt-4"
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
      </div>
    </AppShell>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="surface-elevated border border-border rounded-2xl p-3 text-center">
    <p className="text-2xl font-bold tabular-nums font-mono">{value}</p>
    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
      {label}
    </p>
  </div>
);

export default Profile;
