import { useEffect, useRef } from "react";

interface Props {
  videoId: string;
  url: string;
  className?: string;
}

let scriptLoaded = false;
const loadScript = () => {
  if (scriptLoaded) return;
  if (document.querySelector('script[src*="tiktok.com/embed.js"]')) {
    scriptLoaded = true;
    return;
  }
  const s = document.createElement("script");
  s.src = "https://www.tiktok.com/embed.js";
  s.async = true;
  document.body.appendChild(s);
  scriptLoaded = true;
};

const reloadEmbeds = () => {
  // @ts-ignore
  if (window.tiktokEmbed?.lib?.render) {
    // @ts-ignore
    window.tiktokEmbed.lib.render(document.querySelectorAll(".tiktok-embed"));
  }
};

export const TikTokEmbed = ({ videoId, url, className }: Props) => {
  const ref = useRef<HTMLQuoteElement>(null);

  useEffect(() => {
    loadScript();
    const t = setTimeout(reloadEmbeds, 300);
    return () => clearTimeout(t);
  }, [videoId]);

  // Zoom in so the right-side TikTok action rail (like/comment/share) is cropped out.
  // The embed is roughly 9:16 video + ~80px right rail. Scaling 1.35x and shifting left hides it.
  return (
    <div
      className={className}
      style={{
        background: "#000",
        overflow: "hidden",
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: "scale(1.4) translateX(-9%)",
          transformOrigin: "center center",
          width: "100%",
          maxWidth: "605px",
        }}
      >
        <blockquote
          ref={ref}
          className="tiktok-embed"
          cite={url}
          data-video-id={videoId}
          style={{
            maxWidth: "605px",
            minWidth: "325px",
            margin: 0,
            background: "#000",
          }}
        >
          <section />
        </blockquote>
      </div>
    </div>
  );
};
