import { withBasePath } from "./base-path";

const INSTAGRAM_FEED = withBasePath("/data/instagram.json");
const FACEBOOK_FEED = withBasePath("/data/facebook-events.json");

const VERIFIED_EVENT_LINKS: Record<string, string> = {
  "2026-09-05": "https://fb.me/e/7m9jmHash",
  "2026-08-18": "https://fb.me/e/4a0XAGpOz",
  "2026-08-08": "https://fb.me/e/94pcUtb5A",
};

async function fetchJson(url: string, signal?: AbortSignal) {
  // GitHub Pages and intermediary CDNs can keep a previous JSON response even
  // after the feed workflow has committed newer data. A five-minute bucket
  // keeps requests cacheable while ensuring an open page catches up quickly.
  const separator = url.includes("?") ? "&" : "?";
  const cacheBucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const response = await fetch(`${url}${separator}feed=${cacheBucket}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Social feed responded ${response.status}`);
  return response.json();
}

function resolveMediaUrl(...candidates: unknown[]) {
  const value = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );

  if (!value || /^(?:https?:)?\/\//i.test(value) || value.startsWith("data:")) {
    return value || "";
  }

  return withBasePath(`/${value.replace(/^\.?\/+/, "")}`);
}

export async function loadSocialData(signal?: AbortSignal) {
  const [instagramResult, facebookResult] = await Promise.allSettled([
    fetchJson(INSTAGRAM_FEED, signal),
    fetchJson(FACEBOOK_FEED, signal),
  ]);

  const instagram =
    instagramResult.status === "fulfilled" ? instagramResult.value : { posts: [] };
  const facebook =
    facebookResult.status === "fulfilled" ? facebookResult.value : { events: [] };

  return {
    instagram: {
      ...instagram,
      posts: Array.isArray(instagram?.posts)
        ? instagram.posts
            .map((post: Record<string, unknown>) => ({
              ...post,
              media_url: resolveMediaUrl(
                post.media_url,
                post.image,
                post.thumbnail_url,
              ),
            }))
            .filter((post: Record<string, unknown>) => {
              if (post.is_story !== true) return true;
              const timestamp = Date.parse(
                typeof post.timestamp === "string" ? post.timestamp : "",
              );
              return !Number.isNaN(timestamp) && Date.now() - timestamp < 24 * 60 * 60 * 1000;
            })
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
              const timeA = Date.parse(typeof a.timestamp === "string" ? a.timestamp : "");
              const timeB = Date.parse(typeof b.timestamp === "string" ? b.timestamp : "");
              return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
            })
        : [],
    },
    facebook: {
      ...facebook,
      events: Array.isArray(facebook?.events)
        ? facebook.events.map((event: Record<string, unknown>) => {
            const date = typeof event.date === "string" ? event.date : "";
            return {
              ...event,
              url: VERIFIED_EVENT_LINKS[date] || event.url,
            };
          })
        : [],
    },
  };
}
