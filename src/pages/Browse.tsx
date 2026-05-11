import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Search, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  image_url: string | null;
  video_count?: number;
  affinity?: number;
}

const Browse = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [forYou, setForYou] = useState<CategoryRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name, slug, description, owner_id, image_url");
      if (!cats) return;

      const { data: vids } = await supabase
        .from("videos")
        .select("id, category_id, like_count");
      const counts: Record<string, number> = {};
      const likes: Record<string, number> = {};
      const videoCategory: Record<string, string> = {};
      vids?.forEach((v: any) => {
        counts[v.category_id] = (counts[v.category_id] ?? 0) + 1;
        likes[v.category_id] = (likes[v.category_id] ?? 0) + (v.like_count ?? 0);
        videoCategory[v.id] = v.category_id;
      });

      // Build affinity scores from the user's likes + boosts
      const affinity: Record<string, number> = {};
      if (user) {
        const [{ data: reactions }, { data: boosts }] = await Promise.all([
          supabase
            .from("video_reactions")
            .select("video_id, reaction")
            .eq("user_id", user.id),
          supabase
            .from("video_boosts")
            .select("video_id")
            .eq("user_id", user.id),
        ]);
        reactions?.forEach((r: any) => {
          const cat = videoCategory[r.video_id];
          if (!cat) return;
          affinity[cat] = (affinity[cat] ?? 0) + (r.reaction === "like" ? 2 : -1);
        });
        boosts?.forEach((b: any) => {
          const cat = videoCategory[b.video_id];
          if (!cat) return;
          affinity[cat] = (affinity[cat] ?? 0) + 3;
        });
      }

      const enriched = cats.map((c) => ({
        ...c,
        video_count: counts[c.id] ?? 0,
        affinity: affinity[c.id] ?? 0,
      }));

      const personalized = enriched
        .filter((c) => (c.affinity ?? 0) > 0)
        .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))
        .slice(0, 6);

      enriched.sort((a, b) => (likes[b.id] ?? 0) - (likes[a.id] ?? 0));
      setCategories(enriched);
      setForYou(personalized);
    };
    load();
  }, [user]);

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.description?.toLowerCase().includes(query.toLowerCase())
  );

  const renderCard = (c: CategoryRow) => (
    <Link
      key={c.id}
      to={`/c/${c.slug}`}
      className="surface-elevated border border-border rounded-2xl overflow-hidden hover:border-foreground transition-colors flex flex-col aspect-square relative"
    >
      {c.image_url ? (
        <>
          <img
            src={c.image_url}
            alt={c.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </>
      ) : null}
      <div className="relative z-10 p-4 flex flex-col gap-2 h-full">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {c.video_count} {c.video_count === 1 ? "video" : "videos"}
        </span>
        <span className="text-lg font-semibold tracking-tight mt-auto">#{c.name}</span>
        {c.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
        )}
      </div>
    </Link>
  );

  const showForYou = user && forYou.length > 0 && query.length === 0;

  return (
    <AppShell>
      <div className="px-4 py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Browse</h1>
          <p className="text-muted-foreground text-sm">Explore categories curated by people.</p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories..."
            className="pl-10 h-12"
          />
        </div>

        {showForYou && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-foreground" />
              <h2 className="text-sm font-mono uppercase tracking-wider">For you</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Based on what you like and boost.
            </p>
            <div className="grid grid-cols-2 gap-3">{forYou.map(renderCard)}</div>
          </section>
        )}

        {showForYou && (
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              All categories
            </h2>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="surface-subtle border border-border rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {categories.length === 0 ? "No categories yet. Be the first to create one." : "No matches."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">{filtered.map(renderCard)}</div>
        )}
      </div>
    </AppShell>
  );
};

export default Browse;
