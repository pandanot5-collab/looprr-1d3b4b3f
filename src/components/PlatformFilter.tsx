import { cn } from "@/lib/utils";
import { Youtube, Music2, Layers } from "lucide-react";

export type PlatformFilterValue = "all" | "youtube_shorts" | "tiktok";

const OPTIONS: Array<{ value: PlatformFilterValue; label: string; icon: any }> = [
  { value: "all", label: "All", icon: Layers },
  { value: "youtube_shorts", label: "YT Shorts", icon: Youtube },
  { value: "tiktok", label: "TikTok", icon: Music2 },
];

export const PlatformFilter = ({
  value,
  onChange,
}: {
  value: PlatformFilterValue;
  onChange: (v: PlatformFilterValue) => void;
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
              active
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
            )}
          >
            <o.icon className="w-3.5 h-3.5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
};
