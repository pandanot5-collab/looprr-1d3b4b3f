import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, Avatar } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Ban, ShieldCheck, Upload, Trash2, Save, RefreshCw, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { UsernameDisplay } from "@/components/UsernameDisplay";
import { refreshCustomStyles } from "@/hooks/useCustomStyles";

interface AdminProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  custom_gradient: string | null;
  custom_icon_url: string | null;
  banned: boolean;
}

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<AdminProfile | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) navigate("/");
  }, [user, isAdmin, loading, navigate]);

  const search = async (q: string) => {
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, custom_gradient, custom_icon_url, banned")
      .ilike("username", `%${q}%`)
      .limit(25);
    setResults((data as any) ?? []);
    setSearching(false);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length >= 1) search(query.trim());
      else setResults([]);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  if (loading || !isAdmin) {
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-accent" /> Admin
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage users, custom gradients, icons, and bans.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users by username…"
              className="pl-9 h-11"
            />
          </div>
        </div>

        {searching ? (
          <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="surface-elevated border border-border rounded-xl p-3 flex items-center gap-3 hover:border-foreground transition-colors text-left"
              >
                <Avatar username={r.username} url={r.avatar_url} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">
                    <UsernameDisplay userId={r.id} username={r.username} />
                  </p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {r.banned ? "BANNED" : "ACTIVE"}
                  </p>
                </div>
              </button>
            ))}
            {!searching && query && results.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">No matches.</p>
            )}
          </div>
        )}

        {selected && (
          <UserEditor
            profile={selected}
            onClose={() => setSelected(null)}
            onChanged={(p) => {
              setSelected(p);
              setResults((rs) => rs.map((r) => (r.id === p.id ? p : r)));
            }}
          />
        )}
      </div>
    </AppShell>
  );
};

// ---------- Color helpers (hex <-> hsl string used by --grad) ----------
const hexToHsl = (hex: string): string => {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16) / 255;
  const g = parseInt(m.substring(2, 4), 16) / 255;
  const b = parseInt(m.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
};

const hslStringToHex = (hsl: string): string => {
  const m = hsl.match(/hsl\(\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*\)/i);
  if (!m) return "#888888";
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const parseGradientToHexStops = (grad: string): string[] => {
  if (!grad.trim()) return [];
  const matches = grad.match(/hsl\([^)]+\)/gi);
  if (!matches) return [];
  return matches.map(hslStringToHex);
};

const stopsToGradient = (stops: string[]): string =>
  stops.map(hexToHsl).join(", ");

const UserEditor = ({
  profile,
  onClose,
  onChanged,
}: {
  profile: AdminProfile;
  onClose: () => void;
  onChanged: (p: AdminProfile) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stops, setStops] = useState<string[]>(() => {
    const parsed = parseGradientToHexStops(profile.custom_gradient ?? "");
    return parsed.length >= 2 ? parsed : [];
  });
  const [iconUrl, setIconUrl] = useState(profile.custom_icon_url ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const parsed = parseGradientToHexStops(profile.custom_gradient ?? "");
    setStops(parsed.length >= 2 ? parsed : []);
    setIconUrl(profile.custom_icon_url ?? "");
  }, [profile.id]);

  const gradient = stops.length >= 2 ? stopsToGradient(stops) : "";

  const save = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({
        custom_gradient: gradient.trim() || null,
        custom_icon_url: iconUrl.trim() || null,
      })
      .eq("id", profile.id)
      .select("id, username, avatar_url, custom_gradient, custom_icon_url, banned")
      .single();
    setBusy(false);
    if (error) {
      toast("Couldn't save", { description: error.message });
      return;
    }
    onChanged(data as any);
    refreshCustomStyles();
    toast("Saved");
  };

  const onIconPick = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast("Icon too large (max 2MB)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${profile.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("user-icons")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      toast("Upload failed", { description: upErr.message });
      return;
    }
    const { data: pub } = supabase.storage.from("user-icons").getPublicUrl(path);
    setIconUrl(pub.publicUrl);
    setUploading(false);
  };

  const removeIcon = () => setIconUrl("");

  const ban = async () => {
    if (!confirm(`Ban @${profile.username}? This deletes all their videos and comments.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_ban_user", { _user_id: profile.id });
    setBusy(false);
    if (error) {
      toast("Couldn't ban", { description: error.message });
      return;
    }
    onChanged({ ...profile, banned: true });
    toast("User banned");
  };

  const unban = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_unban_user", { _user_id: profile.id });
    setBusy(false);
    if (error) {
      toast("Couldn't unban", { description: error.message });
      return;
    }
    onChanged({ ...profile, banned: false });
    toast("User unbanned");
  };

  const PRESETS: Array<{ label: string; value: string }> = [
    { label: "Sunset", value: "hsl(20 100% 55%), hsl(330 100% 55%)" },
    { label: "Ocean", value: "hsl(200 100% 55%), hsl(260 100% 60%)" },
    { label: "Lime", value: "hsl(140 80% 50%), hsl(60 100% 55%)" },
    { label: "Gold", value: "hsl(45 100% 55%), hsl(20 100% 50%)" },
    { label: "Mono", value: "hsl(0 0% 90%), hsl(0 0% 30%)" },
  ];

  return (
    <div className="surface-elevated border border-border rounded-2xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar username={profile.username} url={profile.avatar_url} size={44} />
          <div className="min-w-0">
            <p className="text-base font-semibold">
              <UsernameDisplay userId={profile.id} username={profile.username} iconSize={16} />
            </p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {profile.banned ? "BANNED" : "ACTIVE"}
            </p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>

      {/* Custom gradient */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Custom username gradient
        </label>
        <Input
          value={gradient}
          onChange={(e) => setGradient(e.target.value)}
          placeholder="e.g. hsl(0 100% 50%), hsl(40 100% 60%)"
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setGradient(p.value)}
              className="text-xs px-2.5 h-7 rounded-full border border-border hover:border-foreground transition-colors"
              style={{
                backgroundImage: `linear-gradient(90deg, ${p.value})`,
                color: "white",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              {p.label}
            </button>
          ))}
          {gradient && (
            <button
              onClick={() => setGradient("")}
              className="text-xs px-2.5 h-7 rounded-full border border-border hover:border-destructive text-muted-foreground"
            >
              Clear
            </button>
          )}
        </div>
        {gradient && (
          <div className="text-2xl font-bold text-gradient-stack" style={{ ["--grad" as any]: gradient }}>
            @{profile.username}
          </div>
        )}
      </div>

      {/* Custom icon */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Custom icon
        </label>
        <div className="flex items-center gap-3">
          {iconUrl ? (
            <img src={iconUrl} alt="" className="w-10 h-10 rounded object-contain bg-muted p-1" />
          ) : (
            <div className="w-10 h-10 rounded bg-muted" />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onIconPick(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4 mr-1.5" /> Upload</>}
          </Button>
          {iconUrl && (
            <Button size="sm" variant="ghost" onClick={removeIcon}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={busy} className="flex-1">
          <Save className="w-4 h-4 mr-1.5" /> Save changes
        </Button>
        {profile.banned ? (
          <Button onClick={unban} variant="outline" disabled={busy}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Unban
          </Button>
        ) : (
          <Button onClick={ban} variant="destructive" disabled={busy}>
            <Ban className="w-4 h-4 mr-1.5" /> Ban
          </Button>
        )}
      </div>
    </div>
  );
};

export default Admin;
