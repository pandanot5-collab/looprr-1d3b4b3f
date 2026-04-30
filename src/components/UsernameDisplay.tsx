import { Hammer, Youtube, Music2, Crown, Star, Gem } from "lucide-react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useCreatorBadges, type CreatorPlatform } from "@/hooks/useCreatorBadges";
import { useCustomStyles } from "@/hooks/useCustomStyles";
import { useTierStyles, type SubTier } from "@/hooks/useTierStyles";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

const TIER_ICONS = {
  starter: Star,
  pro: Gem,
  elite: Crown,
} as const;

const TIER_LABEL = {
  starter: "Starter member",
  pro: "Pro member",
  elite: "Elite member",
} as const;

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
  const { getTierInfo } = useTierStyles();
  const isAdmin = !!userId && admins.has(userId);
  const userBadges = (userId && badges.get(userId)) || [];
  const custom = (userId && customStyles.get(userId)) || null;
  const tierInfo = getTierInfo(userId);
  // Show icon for active paid tiers, OR a faded icon for expired ex-members
  const iconTier =
    tierInfo.tier !== "free"
      ? tierInfo.tier
      : tierInfo.expired && tierInfo.pastTier
        ? tierInfo.pastTier
        : null;
  const TierIcon = iconTier ? TIER_ICONS[iconTier] : null;
  const tierLabel = iconTier
    ? tierInfo.expired
      ? `Former ${TIER_LABEL[iconTier]}`
      : TIER_LABEL[iconTier]
    : "";

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
      {TierIcon && tierInfo.color && (
        <TierIcon
          className="shrink-0"
          style={{
            width: iconSize,
            height: iconSize,
            color: `hsl(${tierInfo.color})`,
            filter: tierInfo.expired
              ? `drop-shadow(0 0 2px hsl(${tierInfo.color} / 0.4)) grayscale(0.4)`
              : `drop-shadow(0 0 4px hsl(${tierInfo.color} / 0.6))`,
            opacity: tierInfo.expired ? 0.7 : 1,
          }}
          aria-label={tierLabel}
        />
      )}
    </span>
  );
};
