interface Props {
  videoId: string;
  url: string;
  className?: string;
}

/**
 * TikTok's official iframe player. Unlike the blockquote+embed.js approach,
 * this loads the video directly and supports autoplay/muted playback, with
 * no username/description footer or side action rail.
 */
export const TikTokEmbed = ({ videoId, className }: Props) => {
  const src = `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&loop=1&music_info=0&description=0&rel=0&controls=1`;

  return (
    <div
      className={className}
      style={{
        background: "#000",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <iframe
        src={src}
        title="TikTok video"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: 0,
        }}
      />
    </div>
  );
};
