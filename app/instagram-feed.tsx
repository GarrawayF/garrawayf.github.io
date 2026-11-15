import { readFileSync } from "node:fs";
import { join } from "node:path";
import InstagramPosts, { type Feed } from "./instagram-posts";

export default function InstagramFeed() {
  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), "public", "instagram-feed", "feed.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }

  const feed: Feed = JSON.parse(raw);
  return <InstagramPosts feed={feed} />;
}
