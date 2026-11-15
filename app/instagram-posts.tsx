"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { withBasePath } from "./base-path";
import { SITE_LINKS } from "./site-links";
import styles from "./instagram-posts.module.css";

export type Feed = {
  built_at: string;
  last_fetch_succeeded_at: string;
  stale: boolean;
  posts: {
    id: string;
    caption: string;
    timestamp: string;
    date_label: string;
    permalink: string;
    image: string;
  }[];
};

const HOUR = 60 * 60 * 1000;
const STALE_AFTER = 12 * HOUR;
const EXPIRE_AFTER = 72 * HOUR;

export default function InstagramPosts({ feed }: { feed: Feed }) {
  const lastSuccess = Date.parse(feed.last_fetch_succeeded_at);
  const [now, setNow] = useState(() => Date.parse(feed.built_at));

  useEffect(() => {
    let timer: number;
    const refresh = () => {
      window.clearTimeout(timer);
      const currentTime = Date.now();
      setNow(currentTime);
      const boundaries = [lastSuccess + STALE_AFTER, lastSuccess + EXPIRE_AFTER];
      const nextChange = boundaries.find((time) => time > currentTime);
      if (nextChange) timer = window.setTimeout(refresh, nextChange - currentTime);
    };
    timer = window.setTimeout(refresh, 0);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [lastSuccess]);

  if (now - lastSuccess >= EXPIRE_AFTER) return null;

  return (
    <section className={styles.feed} id="instagram" aria-labelledby="instagram-heading">
      <div className={styles.header}>
        <h3 id="instagram-heading">Instagramの投稿</h3>
        <a href={SITE_LINKS.instagram}>@garrawayf_lounge <span aria-hidden="true">↗</span></a>
      </div>
      {(feed.stale || now - lastSuccess >= STALE_AFTER) && (
        <p className={styles.status}>保存済みの投稿を表示しています。新しい投稿はInstagramでご覧いただけます。</p>
      )}
      <ul className={styles.grid}>
        {feed.posts.map((post) => (
          <li key={post.id} className={styles.card} data-instagram-post={post.id}>
            <a href={post.permalink} className={styles.post}>
              <span className={styles.image}>
                <Image src={withBasePath(post.image)} alt="" fill
                  sizes="(max-width: 680px) 46vw, (max-width: 1750px) 23vw, 390px" />
              </span>
              <span className={styles.copy}>
                <time dateTime={post.timestamp}>{post.date_label}</time>
                {post.caption && <span className={styles.caption} data-instagram-caption>{post.caption}</span>}
                <span className={styles.open}>投稿を見る <span aria-hidden="true">↗</span></span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
