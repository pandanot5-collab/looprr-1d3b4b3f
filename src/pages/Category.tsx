import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, Avatar } from "@/components/AppShell";
import { FeedVideo } from "@/components/VideoCard";
import { ShortsViewer } from "@/components/ShortsViewer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  LockOpen,
  Image as ImageIcon,
  UserPlus,
  X,
  Settings,
} from "lucide-react";
import { UsernameDisplay } from "@/components/UsernameDisplay";
import { PlatformFilter, type PlatformFilterValue } from "@/components/PlatformFilter";

interface Collaborator {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
}

const Category = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<any>(null);
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collabUsername, setCollabUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<PlatformFilterValue>("all");

  const isOwner = user && category && user.id === category.owner_id;

  const load = async () => {
    if (!slug) return;
    const { data: cat } = await supabase
      .from("categories")
      .select(
        "id, name, slug, description, owner_id, locked, image_url, profiles!categories_owner_id_fkey(username, avatar_url)",
      )
      .eq("slug", slug)
      .maybeSingle();
    setCategory(cat);

    if (cat) {
      const { data: vids } = await supabase
        .from("videos")
        .select(
          "id, url, platform, external_id, title, thumbnail_url, like_count, dislike_count, boost_count, view_count, report_count, flagged, created_at, posted_by, category_id, profiles!videos_posted_by_fkey(username, avatar_url, banned), categories(name, slug, owner_id)",
        )
        .eq("category_id", cat.id)
        .eq("dead", false)
        .order("boost_count", { ascending: false })
        .order("created_at", { ascending: false });
      const filtered = (vids ?? []).filter((v: any) => !v.profiles?.banned);
      setVideos(filtered as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [slug]);

  const loadCollaborators = async () => {
    if (!category) return;
    const { data } = await supabase
      .from("category_collaborators")
      .select("id, user_id, profiles!category_collaborators_user_id_fkey(username, avatar_url)")
      .eq("category_id", category.id);
    setCollaborators(
      (data ?? []).map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        username: d.profiles?.username ?? "?",
        avatar_url: d.profiles?.avatar_url,
      })),
    );
  };

  useEffect(() => {
    if (showSettings) loadCollaborators();
  }, [showSettings, category?.id]);

  const toggleLock = async () => {
    if (!category) return;
    setBusy(true);
    const { error } = await supabase
      .from("categories")
      .update({ locked: !category.locked })
      .eq("id", category.id);
    setBusy(false);
    if (error) toast("Couldn't update", { description: error.message });
    else {
      setCategory({ ...category, locked: !category.locked });
      toast(category.locked ? "Category unlocked" : "Category locked");
    }
  };

  const addCollaborator = async () => {
    if (!category || !collabUsername.trim()) return;
    setBusy(true);
    const { data: target } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", collabUsername.trim())
      .maybeSingle();
    if (!target) {
      toast("User not found");
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("category_collaborators")
      .insert({ category_id: category.id, user_id: target.id });
    setBusy(false);
    if (error) {
      if (error.code === "23505") toast("Already a collaborator");
      else toast("Couldn't add", { description: error.message });
      return;
    }
    setCollabUsername("");
    toast("Collaborator added");
    loadCollaborators();
  };

  const removeCollaborator = async (id: string) => {
    const { error } = await supabase.from("category_collaborators").delete().eq("id", id);
    if (error) toast("Couldn't remove", { description: error.message });
    else loadCollaborators();
  };

  const onImagePick = async (file: File) => {
    if (!user || !category) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("Image too large (max 5MB)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${category.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("category-images")
      .upload(path, file, { upsert: true });
    if (upErr) {
      toast("Upload failed", { description: upErr.message });
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("category-images").getPublicUrl(path);
    const { error: updErr } = await supabase
      .from("categories")
      .update({ image_url: pub.publicUrl })
      .eq("id", category.id);
    setUploading(false);
    if (updErr) {
      toast("Couldn't save image", { description: updErr.message });
      return;
    }
    setCategory({ ...category, image_url: pub.publicUrl });
    toast("Cover image updated");
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
      {/* Cover */}
      {category.image_url && (
        <div className="w-full aspect-[3/1] bg-muted overflow-hidden">
          <img
            src={category.image_url}
            alt={category.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="px-4 py-6 border-b border-border">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            #{category.name}
            {category.locked && <Lock className="w-5 h-5 text-muted-foreground" />}
          </h1>
          {isOwner && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSettings(!showSettings)}
              className="shrink-0"
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>
        {category.description && (
          <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
        )}
        <Link
          to={`/u/${category.profiles?.username}`}
          className="inline-flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
        >
          <Avatar
            username={category.profiles?.username ?? "?"}
            url={category.profiles?.avatar_url}
            size={24}
          />
          <span className="text-muted-foreground">curated by</span>
          <span className="font-semibold">
            <UsernameDisplay userId={category.owner_id} username={category.profiles?.username} />
          </span>
        </Link>

        {/* Owner settings panel */}
        {isOwner && showSettings && (
          <div className="mt-4 surface-elevated border border-border rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {category.locked ? "Locked" : "Open"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {category.locked
                    ? "Only you and collaborators can post"
                    : "Anyone can post here"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={toggleLock} disabled={busy}>
                {category.locked ? (
                  <><LockOpen className="w-4 h-4 mr-1.5" /> Unlock</>
                ) : (
                  <><Lock className="w-4 h-4 mr-1.5" /> Lock</>
                )}
              </Button>
            </div>

            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImagePick(f);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><ImageIcon className="w-4 h-4 mr-1.5" /> {category.image_url ? "Change cover image" : "Add cover image"}</>
                )}
              </Button>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Allowed posters {category.locked ? "(active)" : "(only enforced when locked)"}
              </p>
              <div className="flex gap-2 mb-2">
                <Input
                  value={collabUsername}
                  onChange={(e) => setCollabUsername(e.target.value)}
                  placeholder="username"
                  className="h-9"
                />
                <Button size="sm" onClick={addCollaborator} disabled={busy}>
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {collaborators.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No collaborators yet.</p>
                ) : (
                  collaborators.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-muted/50 px-2.5 py-1.5 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar username={c.username} url={c.avatar_url} size={20} />
                        <span className="text-sm">
                          <UsernameDisplay userId={c.user_id} username={c.username} />
                        </span>
                      </div>
                      <button
                        onClick={() => removeCollaborator(c.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {videos.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-muted-foreground">
          No videos in this category yet.
        </div>
      ) : (
        <>
          <div className="px-3 pt-2">
            <PlatformFilter value={filter} onChange={setFilter} />
          </div>
          {(() => {
            const visible = filter === "all" ? videos : videos.filter((v) => v.platform === filter);
            return visible.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No videos match this filter.
              </div>
            ) : (
              <ShortsViewer videos={visible} inline />
            );
          })()}
        </>
      )}
    </AppShell>
  );
};

export default Category;
