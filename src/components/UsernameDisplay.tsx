import { Hammer, Youtube, Music2 } from "lucide-react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useCreatorBadges, type CreatorPlatform } from "@/hooks/useCreatorBadges";
import { useCustomStyles } from "@/hooks/useCustomStyles";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

interface Props {
  userId: string | null | undefined;
  username: string | null | undefined;
  className?: string;
  iconSize?: number;
  showAt?: boolean;
}

// Each gradient is a comma-separated color list (slotted into linear-gradient)
const GRADIENTS = {
  admin: "hsl(348 100% 60%), hsl(280 90% 60%), hsl(220 100% 60%)",
  youtube: "hsl(0 100% 50%), hsl(20 100% 55%)",   // red → orange
  tiktok: "hsl(0 0% 8%), hsl(330 100% 55%)",       // black → hot pink
} as const;

export const UsernameDisplay = ({
  userId,
  username,
  className,
  iconSize = 14,
  showAt = true,
}: Props) => {
  const admins = useAdminUsers();
  const badges = useCreatorBadges();
  const customStyles = useCustomStyles();
  const isAdmin = !!userId && admins.has(userId);
  const userBadges = (userId && badges.get(userId)) || [];
  const custom = (userId && customStyles.get(userId)) || null;

  const platforms = new Set<CreatorPlatform>(userBadges.map((b) => b.platform));
  const hasYoutube = platforms.has("youtube");
  const hasTiktok = platforms.has("tiktok");

  // Custom gradient (set by admin) overrides all earned gradients.
  // Otherwise, stack every gradient the user has earned.
  const stops: string[] = [];
  if (custom?.gradient) {
    stops.push(custom.gradient);
  } else {
    if (isAdmin) stops.push(GRADIENTS.admin);
    if (hasYoutube) stops.push(GRADIENTS.youtube);
    if (hasTiktok) stops.push(GRADIENTS.tiktok);
  }

  const hasGradient = stops.length > 0;
  const style: CSSProperties | undefined = hasGradient
    ? ({ "--grad": stops.join(", ") } as CSSProperties)
    : undefined;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span
        className={cn(hasGradient && "text-gradient-stack font-semibold")}
        style={style}
      >
        {showAt ? "@" : ""}{username ?? "?"}
      </span>
      {isAdmin && (
        <Hammer
          className="text-accent shrink-0"
          style={{ width: iconSize, height: iconSize }}
          aria-label="Admin"
        />
      )}
      {hasYoutube && (
        <Youtube
          className="shrink-0"
          style={{ width: iconSize, height: iconSize, color: "hsl(0 100% 50%)" }}
          aria-label="Verified YouTube creator"
        />
      )}
      {hasTiktok && (
        <Music2
          className="shrink-0"
          style={{ width: iconSize, height: iconSize, color: "hsl(330 100% 55%)" }}
          aria-label="Verified TikTok creator"
        />
      )}
      {custom?.iconUrl && (
        <img
          src={custom.iconUrl}
          alt=""
          className="shrink-0 object-contain"
          style={{ width: iconSize, height: iconSize }}
        />
      )}
    </span>
  );
};
