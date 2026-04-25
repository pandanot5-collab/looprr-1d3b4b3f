import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, CATEGORY_LIMITS } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { parseVideoUrl, slugify } from "@/lib/video-utils";
import { Loader2, Link2, Sparkles, Search, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const urlSchema = z.string().url("Enter a valid URL");
const titleSchema = z.string().max(140).optional();
const categoryNameSchema = z
  .string()
  .min(2, "At least 2 characters")
  .max(30, "Max 30 characters");

interface CategoryOpt {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  locked: boolean;
}

const Post = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetCategory = params.get("category");

  const [myCategories, setMyCategories] = useState<CategoryOpt[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryOpt[]>([]);
  const [collabIds, setCollabIds] = useState<Set<string>>(new Set());
  const [selectedCat, setSelectedCat] = useState<CategoryOpt | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryDesc, setCategoryDesc] = useState("");

  const tier = profile?.subscription_tier ?? "free";
  const categoryLimit = CATEGORY_LIMITS[tier];
  const ownedCount = myCategories.length;
  const canCreateMore = ownedCount < categoryLimit;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    const load = async () => {
      const [{ data: cats }, { data: collabs }] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name, slug, owner_id, locked")
          .order("created_at", { ascending: false }),
        supabase.from("category_collaborators").select("category_id").eq("user_id", user.id),
      ]);
      const allCats = (cats as CategoryOpt[]) ?? [];
      setAllCategories(allCats);
      const mine = allCats.filter((c) => c.owner_id === user.id);
      setMyCategories(mine);
      const collabSet = new Set((collabs ?? []).map((c) => c.category_id));
      setCollabIds(collabSet);

      if (presetCategory) {
        const found = allCats.find((c) => c.slug === presetCategory);
        if (found && canPost(found, user.id, mine, collabSet)) setSelectedCat(found);
      } else if (mine.length > 0) {
        setSelectedCat(mine[0]);
      }
      setChecking(false);
    };
    load();
  }, [user, authLoading, navigate, presetCategory]);

  const canPost = (
    c: CategoryOpt,
    uid: string,
    _mine: CategoryOpt[],
    collabSet: Set<string>,
  ) => c.owner_id === uid || !c.locked || collabSet.has(c.id);

  const handleCreateCategory = async () => {
    if (!user) return;
    if (!canCreateMore) {
      toast(`Your plan allows ${categoryLimit} ${categoryLimit === 1 ? "category" : "categories"}. Upgrade for more.`);
      return;
    }
    const result = categoryNameSchema.safeParse(categoryName);
    if (!result.success) {
      toast(result.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const slug = slugify(categoryName);
    const { data, error } = await supabase
      .from("categories")
      .insert({
        owner_id: user.id,
        name: categoryName.trim(),
        slug,
        description: categoryDesc.trim() || null,
      })
      .select("id, name, slug, owner_id, locked")
      .single();
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") toast("That category already exists. Try another name.");
      else toast("Could not create category", { description: error.message });
      return;
    }
    const newCat = data as CategoryOpt;
    setMyCategories((prev) => [newCat, ...prev]);
    setAllCategories((prev) => [newCat, ...prev]);
    setSelectedCat(newCat);
    setShowCreate(false);
    setCategoryName("");
    setCategoryDesc("");
    toast("Category created");
  };

  const handlePost = async () => {
    if (!user || !selectedCat) return;
    const urlResult = urlSchema.safeParse(url);
    if (!urlResult.success) {
      toast(urlResult.error.issues[0].message);
      return;
    }
    const titleResult = titleSchema.safeParse(title.trim() || undefined);
    if (!titleResult.success) {
      toast(titleResult.error.issues[0].message);
      return;
    }
    const parsed = parseVideoUrl(url);
    if (!parsed) {
      toast("Unsupported link", { description: "Use TikTok or YouTube Shorts URLs." });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("videos").insert({
      posted_by: user.id,
      category_id: selectedCat.id,
      url: url.trim(),
      platform: parsed.platform,
      external_id: parsed.externalId,
      title: title.trim() || null,
      thumbnail_url: parsed.thumbnailUrl || null,
    });
    setSubmitting(false);
    if (error) {
      toast("Could not post", { description: error.message });
      return;
    }
    toast("Posted!");
    setUrl("");
    setTitle("");
    navigate(`/c/${selectedCat.slug}`);
  };

  if (authLoading || checking) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const postable = user
    ? allCategories.filter((c) => canPost(c, user.id, myCategories, collabIds))
    : [];
  const filtered = postable.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-md mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Post a video</h1>
          <p className="text-muted-foreground text-sm">
            Drop a link from TikTok or YouTube Shorts.
          </p>
        </div>

        {showCreate ? (
          <div className="surface-elevated border border-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold">Create a category</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {categoryLimit === Infinity
                    ? `Elite plan · unlimited categories (you own ${ownedCount})`
                    : `${tier.charAt(0).toUpperCase() + tier.slice(1)} plan · ${ownedCount} of ${categoryLimit} used`}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="late night cooking"
                maxLength={30}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Description (optional)
              </label>
              <Textarea
                value={categoryDesc}
                onChange={(e) => setCategoryDesc(e.target.value)}
                placeholder="What goes here?"
                maxLength={200}
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleCreateCategory}
                disabled={submitting || !canCreateMore}
                className="flex-1 h-11"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Choose a category
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search categories..."
                  className="pl-10 h-11"
                />
              </div>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 border border-border rounded-xl p-2">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No categories. Create one below.
                  </p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCat(c)}
                      className={cn(
                        "text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between",
                        selectedCat?.id === c.id
                          ? "bg-foreground text-background"
                          : "hover:bg-muted",
                      )}
                    >
                      <span>#{c.name}</span>
                      <div className="flex items-center gap-1.5">
                        {c.owner_id === user!.id && (
                          <span className="text-[9px] font-mono uppercase opacity-70">yours</span>
                        )}
                        {c.locked && <Lock className="w-3 h-3 opacity-70" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => {
                  if (!canCreateMore) {
                    toast(`Your ${tier} plan allows ${categoryLimit} ${categoryLimit === 1 ? "category" : "categories"}.`, {
                      description: "Upgrade your plan to create more.",
                    });
                    return;
                  }
                  setShowCreate(true);
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 text-left"
              >
                {canCreateMore
                  ? `+ Create a new category (${ownedCount}/${categoryLimit === Infinity ? "∞" : categoryLimit} used)`
                  : `Category limit reached (${ownedCount}/${categoryLimit}) — upgrade for more`}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Video URL
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/shorts/..."
                  className="pl-10 h-12"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Title (optional)
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a short caption"
                maxLength={140}
                className="h-12"
              />
            </div>

            <Button
              onClick={handlePost}
              disabled={submitting || !selectedCat}
              className="h-12 text-base"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : selectedCat ? (
                `Post to #${selectedCat.name}`
              ) : (
                "Pick a category"
              )}
            </Button>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default Post;
