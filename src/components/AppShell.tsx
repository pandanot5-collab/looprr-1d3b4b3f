import { Link, useLocation } from "react-router-dom";
import { Compass, Plus, Search, User, Sun, Moon, Crown, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { UsernameDisplay } from "@/components/UsernameDisplay";
import { InstallButton, ScrollInstallPrompt } from "@/components/InstallPrompt";
import logo from "@/assets/loopr-logo.png";
import { cn } from "@/lib/utils";

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user, profile, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();

  const navItems = [
    { to: "/", icon: Compass, label: "Feed" },
    { to: "/browse", icon: Search, label: "Browse" },
    { to: "/post", icon: Plus, label: "Post" },
    { to: "/subscribe", icon: Crown, label: "Pro" },
    { to: user ? "/profile" : "/auth", icon: User, label: user ? "Profile" : "Sign in" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Loopr" className="w-7 h-7" width={28} height={28} />
            <span className="font-semibold text-lg tracking-tight">loopr</span>
          </Link>
          <div className="flex items-center gap-1">
            <InstallButton compact />
            {isAdmin && (
              <Link
                to="/admin"
                aria-label="Admin"
                className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center transition-colors text-accent"
              >
                <ShieldCheck className="w-4 h-4" />
              </Link>
            )}
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {profile && (
              <Link
                to="/profile"
                className="ml-1 flex items-center gap-2 px-2 h-9 rounded-full hover:bg-muted transition-colors"
              >
                <Avatar username={profile.username} url={profile.avatar_url} size={24} />
                <span className="text-sm font-medium hidden sm:inline">
                  <UsernameDisplay userId={profile.id} username={profile.username} />
                </span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full pb-20">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-2 h-16 flex items-center justify-around">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            const isPost = item.label === "Post";
            const isPro = item.label === "Pro";
            return (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-14 h-12 rounded-xl transition-all",
                  isPost && "bg-foreground text-background hover:opacity-90",
                  isPro && active && "text-accent",
                  isPro && !active && "text-muted-foreground hover:text-accent",
                  !isPost && !isPro && active && "text-foreground",
                  !isPost && !isPro && !active && "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isPost && "stroke-[2.5]", isPro && "fill-current stroke-[1.5]")} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <ScrollInstallPrompt />
    </div>
  );
};

export const Avatar = ({
  username,
  url,
  size = 32,
}: {
  username: string;
  url?: string | null;
  size?: number;
}) => {
  if (url) {
    return (
      <img
        src={url}
        alt={username}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
  const initial = username[0]?.toUpperCase() ?? "?";
  return (
    <div
      className="rounded-full bg-foreground text-background flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </div>
  );
};
