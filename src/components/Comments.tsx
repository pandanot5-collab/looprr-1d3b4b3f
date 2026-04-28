import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/AppShell";
import { UsernameDisplay } from "@/components/UsernameDisplay";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  body: string;
  user_id: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | null;
}

interface Props {
  videoId: string;
  videoOwnerId: string;
  categoryOwnerId?: string;
}

export const Comments = ({ videoId, videoOwnerId, categoryOwnerId }: Props) => {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("video_comments")
      .select("id, body, user_id, created_at, profiles!video_comments_user_id_fkey(username, avatar_url)")
      .eq("video_id", videoId)
      .order("created_at", { ascending: false })
      .limit(200);
    setComments((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const submit = async () => {
    if (!user) {
      toast("Sign in to comment");
      return;
    }
    const text = body.trim();
    if (text.length < 1 || text.length > 1000) return;
    setPosting(true);
    const { error } = await supabase
      .from("video_comments")
      .insert({ video_id: videoId, user_id: user.id, body: text });
    setPosting(false);
    if (error) {
      toast("Couldn't post", { description: error.message });
      return;
    }
    setBody("");
    load();
  };

  const canDelete = (c: Comment) => {
    if (!user) return false;
    return (
      isAdmin ||
      c.user_id === user.id ||
      videoOwnerId === user.id ||
      categoryOwnerId === user.id
    );
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("video_comments").delete().eq("id", id);
    if (error) toast("Couldn't delete", { description: error.message });
    else setComments((cs) => cs.filter((c) => c.id !== id));
  };

  return (
    <div className="flex flex-col gap-3">
      {user ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            maxLength={1000}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={posting || body.trim().length === 0}>
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sign in to comment.</p>
      )}

      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar username={c.profiles?.username ?? "?"} url={c.profiles?.avatar_url} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">
                    <UsernameDisplay userId={c.user_id} username={c.profiles?.username} />
                    <span className="ml-1.5 text-muted-foreground font-normal">
                      · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                  </p>
                  {canDelete(c) && (
                    <button
                      onClick={() => remove(c.id)}
                      aria-label="Delete comment"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm leading-snug whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
