export type Platform = "tiktok" | "youtube_shorts";

export interface ParsedVideo {
  platform: Platform;
  externalId: string;
  embedUrl: string;
  thumbnailUrl: string;
}

export function parseVideoUrl(raw: string): ParsedVideo | null {
  const url = raw.trim();

  // YouTube Shorts: https://www.youtube.com/shorts/VIDEO_ID or youtu.be/VIDEO_ID
  const ytMatch =
    url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/) ||
    url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/) ||
    url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/);
  if (ytMatch) {
    const id = ytMatch[1];
    return {
      platform: "youtube_shorts",
      externalId: id,
      embedUrl: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    };
  }

  // TikTok: https://www.tiktok.com/@user/video/VIDEO_ID
  const ttMatch = url.match(/tiktok\.com\/(?:@[\w.-]+\/video|v)\/(\d+)/);
  if (ttMatch) {
    const id = ttMatch[1];
    return {
      platform: "tiktok",
      externalId: id,
      embedUrl: `https://www.tiktok.com/embed/v2/${id}`,
      thumbnailUrl: "",
    };
  }

  return null;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
