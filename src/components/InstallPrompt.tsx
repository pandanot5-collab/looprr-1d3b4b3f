import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const SCROLL_KEY = "loopr.scrollCount";
const PROMPTED_KEY = "loopr.installPromptedAt";
const SCROLL_THRESHOLD = 20;
const COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const incrementScrollCount = () => {
  try {
    const n = Number(localStorage.getItem(SCROLL_KEY) ?? "0") + 1;
    localStorage.setItem(SCROLL_KEY, String(n));
    window.dispatchEvent(new CustomEvent("loopr:scroll-count", { detail: n }));
  } catch {}
};

export const InstallButton = ({ compact = false }: { compact?: boolean }) => {
  const { installed, canPrompt, ios, promptInstall } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);
  const [genericOpen, setGenericOpen] = useState(false);

  // Hide only once the app is actually installed/running standalone
  if (installed) return null;

  const onClick = async () => {
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome === "accepted") return;
      // user dismissed native prompt — fall through to standalone window fallback
      openStandaloneWindow();
    } else if (ios) {
      setIosOpen(true);
    } else {
      // Any other browser (desktop Firefox, in-app browsers, etc.):
      // open the site in a chrome-less popup so it still "feels like an app".
      openStandaloneWindow();
      setGenericOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={onClick}
        aria-label="Install app"
        className={
          compact
            ? "h-9 px-2.5 rounded-full bg-foreground text-background text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            : "h-9 px-3 rounded-full bg-foreground text-background text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
        }
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install</span>
      </button>
      <IosInstructions open={iosOpen} onOpenChange={setIosOpen} />
      <GenericInstallInstructions open={genericOpen} onOpenChange={setGenericOpen} />
    </>
  );
};

const GenericInstallInstructions = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Install Loopr</DialogTitle>
        <DialogDescription>
          Open your browser menu and choose <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong> to install Loopr.
        </DialogDescription>
      </DialogHeader>
      <p className="text-xs text-muted-foreground pt-1">
        On Chrome / Edge: tap the ⋮ menu. On Safari: tap the Share button. If you don't see the option, your browser may not support installs — try Chrome or Safari.
      </p>
    </DialogContent>
  </Dialog>
);

const IosInstructions = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Install Loopr on your iPhone</DialogTitle>
        <DialogDescription>Add Loopr to your home screen for the full app experience.</DialogDescription>
      </DialogHeader>
      <ol className="flex flex-col gap-3 text-sm pt-1">
        <li className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center font-mono text-xs">1</span>
          Tap the <Share className="w-4 h-4 inline" /> Share button in Safari
        </li>
        <li className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center font-mono text-xs">2</span>
          Scroll and tap <Plus className="w-4 h-4 inline" /> "Add to Home Screen"
        </li>
        <li className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-muted text-foreground flex items-center justify-center font-mono text-xs">3</span>
          Tap "Add" — done!
        </li>
      </ol>
    </DialogContent>
  </Dialog>
);

export const ScrollInstallPrompt = () => {
  const { available, ios, promptInstall } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    const check = (n: number) => {
      if (!available) return;
      if (n < SCROLL_THRESHOLD) return;
      try {
        const last = Number(localStorage.getItem(PROMPTED_KEY) ?? "0");
        if (Date.now() - last < COOLDOWN_MS) return;
        localStorage.setItem(PROMPTED_KEY, String(Date.now()));
        setOpen(true);
      } catch {}
    };
    const onCount = (e: Event) => check((e as CustomEvent<number>).detail);
    window.addEventListener("loopr:scroll-count", onCount);
    // initial check on mount in case threshold already crossed
    try {
      check(Number(localStorage.getItem(SCROLL_KEY) ?? "0"));
    } catch {}
    return () => window.removeEventListener("loopr:scroll-count", onCount);
  }, [available]);

  const accept = async () => {
    setOpen(false);
    if (ios) setIosOpen(true);
    else await promptInstall();
  };

  if (!available) return <IosInstructions open={iosOpen} onOpenChange={setIosOpen} />;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" /> Get the Loopr app
            </DialogTitle>
            <DialogDescription>
              Add Loopr to your home screen for faster loading, fullscreen playback, and a native feel.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
              <X className="w-4 h-4 mr-1.5" /> Not now
            </Button>
            <Button className="flex-1" onClick={accept}>
              <Download className="w-4 h-4 mr-1.5" /> Install
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <IosInstructions open={iosOpen} onOpenChange={setIosOpen} />
    </>
  );
};
