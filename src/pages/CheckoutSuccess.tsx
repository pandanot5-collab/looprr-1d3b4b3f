import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Crown, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  elite: "Elite",
};

const CheckoutSuccess = () => {
  const { tierId } = useParams();
  const planName = (tierId && PLAN_NAMES[tierId]) || "Loopr";

  useEffect(() => {
    document.title = `Welcome to ${planName} · Loopr`;
  }, [planName]);

  return (
    <AppShell>
      <div className="px-4 py-12 max-w-md mx-auto flex flex-col items-center gap-8 text-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
            <Check className="w-10 h-10 stroke-[3]" />
          </div>
          <Sparkles className="absolute -top-1 -right-2 w-6 h-6 text-accent" />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Payment confirmed
          </span>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to {planName}</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Your subscription is active. Enjoy your new perks across Loopr.
          </p>
        </div>

        <div className="surface-elevated rounded-2xl border border-border w-full p-5 flex items-center gap-4 text-left">
          <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
            <Crown className="w-5 h-5 fill-current" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">{planName} plan active</div>
            <div className="text-xs text-muted-foreground">
              Manage or cancel anytime from your profile.
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <Button asChild className="h-11">
            <Link to="/">Start exploring</Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link to="/profile">Go to profile</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
};

export default CheckoutSuccess;
