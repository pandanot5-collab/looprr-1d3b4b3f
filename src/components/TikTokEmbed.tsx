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

  return (
    <div className={className} style={{ background: "#000" }}>
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
  );
};
