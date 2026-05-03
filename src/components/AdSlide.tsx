import { useEffect, useRef } from "react";
import { ExternalLink, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TikTokEmbed } from "@/components/TikTokEmbed";

export interface AdItem {
  id: string;
  ad_type: "promoted_short" | "google";
  url: string | null;
  platform: string | null;
  external_id: string | null;
  title: string | null;
  thumbnail_url: string | null;
  google_slot: string | null;
}

interface Props {
  ad: AdItem;
  isActive: boolean;
}

export const AdSlide = ({ ad, isActive }: Props) => {
  const tracked = useRef(false);

  useEffect(() => {
    if (!isActive || tracked.current) return;
    tracked.current = true;
    supabase.rpc("record_ad_impression", { _ad_id: ad.id });
  }, [isActive, ad.id]);

  return (
    <section className="snap-start h-full w-full relative flex items-center justify-center bg-black">
      <div className="relative w-full h-full max-w-[500px] mx-auto">
        {/* Sponsored badge */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-400/90 text-black text-[10px] font-bold uppercase tracking-wider">
          <Sparkles className="w-3 h-3" />
          Sponsored
        </div>

        {ad.ad_type === "google" ? (
          <GoogleAdPlaceholder slot={ad.google_slot} />
        ) : ad.platform === "youtube_shorts" && ad.external_id ? (
          <iframe
            key={isActive ? `${ad.id}-active` : ad.id}
            src={`https://www.youtube.com/embed/${ad.external_id}?rel=0&modestbranding=1&playsinline=1&autoplay=${isActive ? 1 : 0}&mute=${isActive ? 0 : 1}`}
            title={ad.title ?? "Sponsored short"}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : ad.platform === "tiktok" && ad.external_id ? (
          <div className="w-full h-full overflow-y-auto bg-black flex items-start justify-center">
            <TikTokEmbed videoId={ad.external_id} url={ad.url ?? ""} className="w-full" />
          </div>
        ) : (
          <a
            href={ad.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-full flex flex-col items-center justify-center text-white gap-3 bg-gradient-to-br from-zinc-900 to-black"
          >
            {ad.thumbnail_url && (
              <img src={ad.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
            )}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <ExternalLink className="w-10 h-10" />
              <span className="text-sm font-medium">Open</span>
            </div>
          </a>
        )}

        {/* Bottom meta */}
        <div className="absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white pointer-events-none">
          <p className="text-xs uppercase tracking-wider text-white/70 mb-1">Sponsored</p>
          {ad.title && <p className="text-sm leading-snug line-clamp-2">{ad.title}</p>}
        </div>
      </div>
    </section>
  );
};

const GoogleAdPlaceholder = ({ slot }: { slot: string | null }) => (
  <div className="w-full h-full flex flex-col items-center justify-center text-white/70 bg-gradient-to-br from-zinc-900 to-black p-6 text-center">
    <div className="border-2 border-dashed border-white/30 rounded-2xl p-8 max-w-sm">
      <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Google Ad Slot</p>
      <p className="font-mono text-sm">{slot ?? "ad-slot-unset"}</p>
      <p className="text-xs text-white/50 mt-3">
        Wire AdSense here once the publisher ID is configured.
      </p>
    </div>
  </div>
);
