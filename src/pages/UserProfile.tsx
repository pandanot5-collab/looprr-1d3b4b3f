import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, Avatar } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronRight, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";

const UserProfile = () => {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [category, setCategory] = useState<any>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!username) return;
    setLoading(true);
    const { data: p } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, is_subscriber")
      .eq("username", username)
      .maybeSingle();
    setProfile(p);

    if (p) {
      const [{ data: cat }, { count: fCount }, { count: gCount }, followRes] = await Promise.all([
        supabase.from("categories").select("name, slug, image_url").eq("owner_id", p.id).maybeSingle(),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
        user
          ? supabase
              .from("follows")
              .select("id")
              .eq("follower_id", user.id)
              .eq("following_id", p.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setCategory(cat);
      setFollowers(fCount ?? 0);
      setFollowing(gCount ?? 0);
      setIsFollowing(!!(followRes as any).data);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [username, user?.id]);

  const toggleFollow = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!profile) return;
    setBusy(true);
    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profile.id);
      if (error) toast("Couldn't unfollow", { description: error.message });
      else {
        setIsFollowing(false);
        setFollowers((c) => Math.max(0, c - 1));
      }
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: profile.id });
      if (error) toast("Couldn't follow", { description: error.message });
      else {
        setIsFollowing(true);
        setFollowers((c) => c + 1);
      }
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="px-6 py-12 text-center">
          <h1 className="text-xl font-semibold mb-2">User not found</h1>
        </div>
      </AppShell>
    );
  }

  const isMe = user?.id === profile.id;

  return (
    <AppShell>
      <div className="px-4 py-6 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar username={profile.username} url={profile.avatar_url} size={72} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">@{profile.username}</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {profile.is_subscriber ? "PRO MEMBER" : "FREE TIER"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Followers" value={followers} />
          <Stat label="Following" value={following} />
        </div>

        {!isMe && (
          <Button
            onClick={toggleFollow}
            disabled={busy}
            variant={isFollowing ? "outline" : "default"}
            className="h-11"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isFollowing ? (
              <><UserMinus className="w-4 h-4 mr-2" /> Unfollow</>
            ) : (
              <><UserPlus className="w-4 h-4 mr-2" /> Follow</>
            )}
          </Button>
        )}

        {category && (
          <Link
            to={`/c/${category.slug}`}
            className="surface-elevated border border-border rounded-2xl p-4 flex items-center justify-between hover:border-foreground transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              {category.image_url && (
                <img
                  src={category.image_url}
                  alt={category.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Category
                </span>
                <p className="text-lg font-semibold truncate">#{category.name}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </Link>
        )}
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

export default UserProfile;
