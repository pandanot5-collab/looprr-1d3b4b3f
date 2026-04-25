import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import logo from "@/assets/loopr-logo.png";

const emailSchema = z.string().email("Enter a valid email");
const usernameSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(20, "Max 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, underscores");

type Step = "email" | "code";

const RESEND_SECONDS = 30;

const Auth = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const sendCode = async () => {
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast(emailResult.error.issues[0].message);
      return;
    }
    if (mode === "signup") {
      const u = usernameSchema.safeParse(username);
      if (!u.success) {
        toast(u.error.issues[0].message);
        return;
      }
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: mode === "signup",
        data: mode === "signup" ? { username } : undefined,
      },
    });
    setLoading(false);
    if (error) {
      toast("Could not send code", { description: error.message });
      return;
    }
    setStep("code");
    setResendIn(RESEND_SECONDS);
    toast("Check your email", { description: "We sent you a 6-digit code." });
  };

  const verifyCode = async (codeToVerify: string) => {
    if (codeToVerify.length !== 6) {
      toast("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: codeToVerify,
      type: "email",
    });
    setLoading(false);
    if (error) {
      toast("Invalid or expired code", { description: error.message });
      setCode("");
      return;
    }
    toast("Welcome to Loopr");
    navigate("/");
  };

  // Auto-verify when 6 digits typed
  useEffect(() => {
    if (step === "code" && code.length === 6 && !loading) {
      verifyCode(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  return (
    <AppShell>
      <div className="px-6 py-12 max-w-sm mx-auto flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 mb-2">
          <img src={logo} alt="Loopr" className="w-14 h-14" width={56} height={56} />
          <h1 className="text-3xl font-bold tracking-tight text-center">
            {step === "email" ? (mode === "signup" ? "Create account" : "Welcome back") : "Enter code"}
          </h1>
          <p className="text-muted-foreground text-sm text-center">
            {step === "email"
              ? "We'll send a 6-digit code to your email."
              : `Sent to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Username
                </label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_handle"
                  maxLength={20}
                  className="h-12"
                  autoComplete="username"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                type="email"
                className="h-12"
                autoComplete="email"
                onKeyDown={(e) => e.key === "Enter" && sendCode()}
              />
            </div>
            <Button onClick={sendCode} disabled={loading} className="h-12 text-base">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send code"}
            </Button>
            <button
              onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {mode === "signup" ? "Already have an account? Sign in" : "New here? Create account"}
            </button>
          </>
        ) : (
          <>
            {/* Locked banner */}
            <div className="surface-subtle border border-border rounded-xl p-3 flex items-start gap-2.5">
              <Lock className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your account is locked until you enter the verification code we just emailed you.
              </p>
            </div>

            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="h-16 text-center text-3xl font-mono tracking-[0.5em]"
              maxLength={6}
              disabled={loading}
            />

            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
              </div>
            )}

            <button
              onClick={() => {
                if (resendIn > 0) return;
                sendCode();
              }}
              disabled={resendIn > 0 || loading}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>

            <button
              onClick={() => {
                setStep("email");
                setCode("");
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Use a different email
            </button>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default Auth;
