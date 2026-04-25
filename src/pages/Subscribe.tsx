import { useNavigate } from "react-router-dom";
import { Crown, Check, Trash2, Zap, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Subscribe = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const features = [
    { icon: Trash2, title: "Vote to remove videos", desc: "Flag low-quality posts. 5 Pro votes = removal." },
    { icon: Zap, title: "Unlimited daily boosts", desc: "Push your favorite videos to the top, all day." },
    { icon: Sparkles, title: "Pro badge on your profile", desc: "Stand out as a power curator." },
  ];

  return (
    <AppShell>
      <div className="px-4 py-8 max-w-md mx-auto flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
            <Crown className="w-7 h-7 fill-current" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Loopr Pro</h1>
          <p className="text-muted-foreground text-sm max-w-xs">
            Help keep the feed clean. Get more control over what shows up.
          </p>
        </div>

        {/* Pricing card */}
        <div className="surface-elevated border-2 border-foreground rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight tabular-nums">$4</span>
            <span className="text-muted-foreground text-sm">/month</span>
          </div>

          <ul className="flex flex-col gap-3">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <f.icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          {profile?.is_subscriber ? (
            <div className="flex items-center justify-center gap-2 h-12 rounded-lg bg-secondary text-foreground font-medium">
              <Check className="w-4 h-4" /> You're a Pro member
            </div>
          ) : (
            <Button
              className="h-12 text-base"
              onClick={() => {
                if (!user) {
                  navigate("/auth");
                  return;
                }
                toast("Pro is launching soon", {
                  description: "We'll notify you the moment subscriptions go live.",
                });
              }}
            >
              {user ? "Join the waitlist" : "Sign in to subscribe"}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center font-mono uppercase tracking-wider">
          Cancel anytime · Powered by Loopr
        </p>
      </div>
    </AppShell>
  );
};

export default Subscribe;
