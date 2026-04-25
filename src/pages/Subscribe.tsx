import { useNavigate } from "react-router-dom";
import { Crown, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tier = {
  id: string;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  highlight?: boolean;
  cta: string;
};

const tiers: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    price: 2,
    tagline: "Dip your toes into Pro.",
    features: [
      "1 vote to remove videos per week",
      "2 daily boosts (vs 1 free)",
      "Ad-free feed",
    ],
    cta: "Choose Starter",
  },
  {
    id: "pro",
    name: "Pro",
    price: 4,
    tagline: "For active curators.",
    features: [
      "Unlimited remove-video votes",
      "Unlimited daily boosts",
      "Pro badge on your profile",
      "Ad-free feed",
    ],
    highlight: true,
    cta: "Choose Pro",
  },
  {
    id: "elite",
    name: "Elite",
    price: 9,
    tagline: "Full power, zero limits.",
    features: [
      "Everything in Pro",
      "Elite gold badge",
      "2x voting weight on removals",
      "Early access to new features",
      "Priority support",
    ],
    cta: "Choose Elite",
  },
];

const Subscribe = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const handleSelect = (tier: Tier) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    toast(`${tier.name} is launching soon`, {
      description: "We'll notify you the moment subscriptions go live.",
    });
  };

  return (
    <AppShell>
      <div className="px-4 py-8 max-w-md mx-auto flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
            <Crown className="w-7 h-7 fill-current" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Loopr Plans</h1>
          <p className="text-muted-foreground text-sm max-w-xs">
            Pick the level of control you want over the feed.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={cn(
                "surface-elevated rounded-2xl p-6 flex flex-col gap-5 border-2 relative",
                tier.highlight ? "border-foreground" : "border-border",
              )}
            >
              {tier.highlight && (
                <span className="absolute -top-2.5 left-6 bg-foreground text-background text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded">
                  Most popular
                </span>
              )}

              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-bold tracking-tight">{tier.name}</h2>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight tabular-nums">
                      ${tier.price}
                    </span>
                    <span className="text-muted-foreground text-xs">/mo</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{tier.tagline}</p>
              </div>

              <ul className="flex flex-col gap-2.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                    <p className="text-sm">{f}</p>
                  </li>
                ))}
              </ul>

              {profile?.is_subscriber && tier.id === "pro" ? (
                <div className="flex items-center justify-center gap-2 h-11 rounded-lg bg-secondary text-foreground font-medium text-sm">
                  <Check className="w-4 h-4" /> Current plan
                </div>
              ) : (
                <Button
                  variant={tier.highlight ? "default" : "outline"}
                  className="h-11 text-sm"
                  onClick={() => handleSelect(tier)}
                >
                  {user ? tier.cta : "Sign in to subscribe"}
                </Button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center font-mono uppercase tracking-wider">
          Cancel anytime · Powered by Loopr
        </p>
      </div>
    </AppShell>
  );
};

export default Subscribe;
