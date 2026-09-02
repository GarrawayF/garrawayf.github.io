"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SITE_LINKS } from "./site-links";
import { withBasePath } from "./base-path";
import { loadSocialData } from "./social-data";

type InstagramPost = {
  id?: string;
  caption?: string;
  media_type?: string;
  is_story?: boolean;
  image?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
};

type FacebookEvent = {
  id?: string;
  date?: string;
  title?: string;
  category?: string;
  status?: string;
  name?: string;
  start_time?: string;
  url?: string;
};

type SocialData = {
  instagram?: { posts?: InstagramPost[] };
  facebook?: { events?: FacebookEvent[] };
};

const socials = [
  ["FACEBOOK", SITE_LINKS.facebook, "FB"],
  ["INSTAGRAM", SITE_LINKS.instagram, "IG"],
  ["LIBRARY IG", SITE_LINKS.libraryInstagram, "LI"],
  ["X / TWITTER", SITE_LINKS.x, "X"],
  ["LINE", SITE_LINKS.line, "LN"],
  ["NOTE", SITE_LINKS.note, "NT"],
];

const formatDate = (value?: string) => {
  if (!value) return "NOW";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

function InstagramImage({ src, alt }: { src: string; alt: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed) {
    return (
      <span className="instagramImageFallback">
        <b>GARRAWAY F</b>
        <small>VIEW POST ↗</small>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setImageFailed(true)}
    />
  );
}

export default function SocialLive() {
  const [data, setData] = useState<SocialData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let controller = new AbortController();

    const refresh = () => {
      controller.abort();
      controller = new AbortController();
      loadSocialData(controller.signal)
        .then((nextData) => {
          setData(nextData);
          setFailed(false);
        })
        .catch((error) => {
          if (error?.name !== "AbortError") setFailed(true);
        });
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    const interval = window.setInterval(refresh, 10 * 60 * 1000);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const posts = (data?.instagram?.posts ?? []).slice(0, 4);
  const events = (data?.facebook?.events ?? []).slice(0, 4);

  return (
    <section className="socialLiveSection" id="news">
      <header className="socialLiveHead">
        <p className="sectionTag">06 / SOCIAL LIVE</p>
        <h2>ここで生まれる、<br />挑戦の熱量。</h2>
        <p className="socialLead">
          Garraway Fで起きていることを、InstagramとFacebookから直接お届けします。
        </p>
      </header>

      <div className="socialLiveGrid">
        <article className="socialPanel instagramPanel">
          <a className="socialPanelHead" href={SITE_LINKS.instagram} target="_blank" rel="noreferrer" aria-label="Garraway FのInstagramを開く">
            <div><span>LIVE FEED</span><h3>Instagram</h3></div>
            <b>↗</b>
          </a>
          <div className="socialPanelBody instagramPanelBody">
            <p className="socialSwipeHint" aria-hidden="true">投稿を横にスワイプ →</p>
            {!data && !failed ? (
              <div className="instagramLiveGrid" aria-label="Instagramを読み込み中">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="socialSkeleton" key={index} />
                ))}
              </div>
            ) : posts.length > 0 ? (
              <div className="instagramLiveGrid" role="region" aria-label="Instagramの投稿。横にスワイプして確認できます" tabIndex={0}>
                {posts.map((post, index) => {
                  const image = post.media_url || post.image || post.thumbnail_url;
                  const badge = post.is_story
                    ? "STORY"
                    : post.media_type === "VIDEO" || post.permalink?.includes("/reel/")
                      ? "REEL"
                      : "";
                  return (
                    <a
                      className="instagramPost"
                      href={post.permalink || SITE_LINKS.instagram}
                      target="_blank"
                      rel="noreferrer"
                      key={post.id || `${post.timestamp}-${index}`}
                    >
                      <div className="instagramMedia">
                        {image ? (
                          <InstagramImage
                            src={image}
                            alt={post.caption || "Garraway F Instagram投稿"}
                          />
                        ) : <span>GARRAWAY F</span>}
                        <i>{String(index + 1).padStart(2, "0")}</i>
                        {badge && <em>{badge}</em>}
                      </div>
                      <div className="instagramCopy">
                        <time>{formatDate(post.timestamp)}</time>
                        <p>{post.caption || "Garraway Fの最新情報を見る"}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <a className="socialFallback" href={SITE_LINKS.instagram} target="_blank" rel="noreferrer">
                Instagramで最新投稿を見る <span>↗</span>
              </a>
            )}
          </div>
          <a className="socialPanelFooter" href={SITE_LINKS.instagram} target="_blank" rel="noreferrer">
            @garrawayf_lounge <span>VIEW ON INSTAGRAM ↗</span>
          </a>
        </article>

        <article className="socialPanel facebookPanel">
          <a className="socialPanelHead" href={SITE_LINKS.facebook} target="_blank" rel="noreferrer" aria-label="Garraway FのFacebookを開く">
            <div><span>EVENTS &amp; UPDATES</span><h3>Facebook</h3></div>
            <b>f</b>
          </a>
          <div className="socialPanelBody facebookPanelBody">
            <a className="facebookPagePreview" href={SITE_LINKS.facebook} target="_blank" rel="noreferrer">
              <div className="facebookPreviewImage">
                <img src={withBasePath("/images/floor-living-lab.webp")} alt="" loading="lazy" />
                <span>OFFICIAL PAGE</span>
                <b aria-hidden="true">f</b>
              </div>
              <div className="facebookPreviewCopy">
                <small>@garrawayf</small>
                <h4>GARRAWAY F</h4>
                <p>イベントと共創の最新情報を発信しています。</p>
                <strong>FACEBOOKで見る <span>↗</span></strong>
              </div>
            </a>
            {!data && !failed ? (
              <div className="facebookEventsLoading" aria-label="Facebookイベントを読み込み中">
                {Array.from({ length: 3 }).map((_, index) => <div className="facebookEventSkeleton" key={index} />)}
              </div>
            ) : events.length > 0 ? (
              <div className="facebookEventsList">
                {events.map((event, index) => (
                  <a href={event.url || SITE_LINKS.facebookEvents} target="_blank" rel="noreferrer" className="facebookEvent" key={event.id || `${event.date}-${index}`}>
                    <time>{formatDate(event.date || event.start_time)}</time>
                    <div><h4>{event.title || event.name || "Garraway F Event"}</h4><p>{event.category || (event.status === "UPCOMING" ? "開催予定" : "開催終了")}</p></div>
                    <span>↗</span>
                  </a>
                ))}
              </div>
            ) : (
              <a className="facebookEventsFallback" href={SITE_LINKS.facebookEvents} target="_blank" rel="noreferrer">
                <span><small>EVENTS</small>最新のイベント情報を見る</span><b>↗</b>
              </a>
            )}
          </div>
          <a className="socialPanelFooter" href={SITE_LINKS.facebook} target="_blank" rel="noreferrer">
            GARRAWAY F FACEBOOK <span>VIEW PAGE ↗</span>
          </a>
        </article>
      </div>

      <Link className="socialEventsButton" href="/events">
        <span>イベント情報を一覧で見る</span><b>→</b>
      </Link>

      <nav className="socialDirectLinks" aria-label="Garraway F公式SNS">
        {socials.map(([name, href, code]) => (
          <a href={href} target="_blank" rel="noreferrer" key={name}><b>{code}</b><span>{name}</span><i>↗</i></a>
        ))}
      </nav>
    </section>
  );
}
