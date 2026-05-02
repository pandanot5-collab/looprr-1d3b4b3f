import { useState, FormEvent } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Lock, Check, CreditCard, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PLANS: Record<string, { name: string; price: number; tagline: string; features: string[] }> = {
  starter: {
    name: "Starter",
    price: 2,
    tagline: "Dip your toes into Pro.",
    features: ["3 categories", "1 remove vote / week", "2 daily boosts", "Ad-free feed"],
  },
  pro: {
    name: "Pro",
    price: 4,
    tagline: "For active curators.",
    features: ["10 categories", "Unlimited remove votes", "Unlimited boosts", "Pro badge", "Ad-free feed"],
  },
  elite: {
    name: "Elite",
    price: 9,
    tagline: "Full power, zero limits.",
    features: ["Unlimited categories", "Elite gold badge", "2x voting weight", "Early access", "Priority support"],
  },
};

const formatCard = (v: string) =>
  v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
const formatExpiry = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const Checkout = () => {
  const { tierId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const plan = tierId ? PLANS[tierId] : undefined;

  const [name, setName] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [submitting, setSubmitting] = useState(false);

  if (!plan) {
    return (
      <AppShell>
        <div className="px-4 py-16 text-center flex flex-col gap-4 items-center">
          <h1 className="text-2xl font-bold">Plan not found</h1>
          <Button asChild variant="outline">
            <Link to="/subscribe">Back to plans</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const tax = +(plan.price * 0.0).toFixed(2);
  const total = (plan.price + tax).toFixed(2);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (card.replace(/\s/g, "").length < 12 || expiry.length < 5 || cvc.length < 3) {
      toast.error("Please fill in all card details");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      navigate(`/checkout/${tierId}/success`);
    }, 1400);
  };

  return (
    <AppShell>
      <div className="px-4 py-6 max-w-md mx-auto flex flex-col gap-6">
        <Link
          to="/subscribe"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to plans
        </Link>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Checkout
          </span>
          <h1 className="text-3xl font-bold tracking-tight">Subscribe to {plan.name}</h1>
          <p className="text-sm text-muted-foreground">{plan.tagline}</p>
        </div>

        {/* Order summary */}
        <div className="surface-elevated rounded-2xl p-5 border border-border flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{plan.name} plan</div>
              <div className="text-xs text-muted-foreground">Billed monthly · Cancel anytime</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums">${plan.price}</div>
              <div className="text-[10px] text-muted-foreground font-mono uppercase">/ month</div>
            </div>
          </div>

          <ul className="flex flex-col gap-2 pt-3 border-t border-border">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-accent shrink-0" /> {f}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm text-muted-foreground">Total today</span>
            <span className="text-lg font-bold tabular-nums">${total}</span>
          </div>
        </div>

        {/* Payment form */}
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Cardholder name</Label>
            <Input
              id="name"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="card">Card number</Label>
            <div className="relative">
              <Input
                id="card"
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
                value={card}
                onChange={(e) => setCard(formatCard(e.target.value))}
                className="pl-10"
                required
              />
              <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expiry">Expiry</Label>
              <Input
                id="expiry"
                placeholder="MM/YY"
                inputMode="numeric"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cvc">CVC</Label>
              <Input
                id="cvc"
                placeholder="123"
                inputMode="numeric"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className={cn("h-12 text-sm font-semibold mt-2")}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processing…
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" /> Pay ${total} / month
              </>
            )}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
            <Lock className="w-3 h-3" /> Demo checkout · No real charge
          </p>
        </form>
      </div>
    </AppShell>
  );
};

export default Checkout;
