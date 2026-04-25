import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { parseVideoUrl, slugify } from "@/lib/video-utils";
import { Loader2, Link2, Sparkles } from "lucide-react";

const urlSchema = z.string().url("Enter a valid URL");
const titleSchema = z.string().max(140).optional();
const categoryNameSchema = z
  .string()
  .min(2, "At least 2 characters")
  .max(30, "Max 30 characters");

const Post = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [myCategory, setMyCategory] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryDesc, setCategoryDesc] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    supabase
      .from("categories")
      .select("id, name, slug")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMyCategory(data);
        setChecking(false);
      });
  }, [user, authLoading, navigate]);

  const handleCreateCategory = async () => {
    if (!user) return;
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
      .select("id, name, slug")
      .single();
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") toast("That category already exists. Try another name.");
      else toast("Could not create category", { description: error.message });
      return;
    }
    setMyCategory(data);
    toast("Category created");
  };

  const handlePost = async () => {
    if (!user || !myCategory) return;
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
      category_id: myCategory.id,
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
    navigate("/");
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

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-md mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Post a video</h1>
          <p className="text-muted-foreground text-sm">
            Drop a link from TikTok or YouTube Shorts.
          </p>
        </div>

        {!myCategory ? (
          <div className="surface-elevated border border-border rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold">Create your category first</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Each user gets one unique category. Make it count.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Category name
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
            <Button onClick={handleCreateCategory} disabled={submitting} className="h-11">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create category"}
            </Button>
          </div>
        ) : (
          <>
            <div className="surface-subtle border border-border rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Posting to
                </span>
                <p className="text-base font-semibold">#{myCategory.name}</p>
              </div>
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

            <Button onClick={handlePost} disabled={submitting} className="h-12 text-base">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post video"}
            </Button>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default Post;
