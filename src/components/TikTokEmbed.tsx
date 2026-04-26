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

  // Scale the embed up and shift it up so TikTok's bottom username/description
  // area is cropped out of view by the parent's overflow-hidden.
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
          transform: "scale(1.35) translateY(-12%)",
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
