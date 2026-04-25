import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  image_url: string | null;
  video_count?: number;
}

const Browse = () => {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name, slug, description, owner_id, image_url")
        .order("created_at", { ascending: false });
      if (!cats) return;

      const { data: vids } = await supabase.from("videos").select("category_id");
      const counts: Record<string, number> = {};
      vids?.forEach((v) => {
        counts[v.category_id] = (counts[v.category_id] ?? 0) + 1;
      });

      setCategories(cats.map((c) => ({ ...c, video_count: counts[c.id] ?? 0 })));
    };
    load();
  }, []);

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.description?.toLowerCase().includes(query.toLowerCase())
  );

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

        {filtered.length === 0 ? (
          <div className="surface-subtle border border-border rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {categories.length === 0 ? "No categories yet. Be the first to create one." : "No matches."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((c) => (
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
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Browse;
