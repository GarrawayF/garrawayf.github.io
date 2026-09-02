"use client";

import { useEffect, useState } from "react";
import { SITE_LINKS } from "../site-links";
import { loadSocialData } from "../social-data";

type EventItem = {
  id?: string;
  date?: string;
  start_time?: string;
  title?: string;
  name?: string;
  category?: string;
  status?: string;
  url?: string;
};

type InstagramPost = {
  id?: string;
  caption?: string;
  is_story?: boolean;
  image?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
};

type SocialData = {
  instagram?: { posts?: InstagramPost[] };
  facebook?: { events?: EventItem[]; updated_at?: string };
};

const formatDate = (value?: string) => {
  if (!value) return "DATE TBA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replaceAll("-", ".");
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const isUpcoming = (event: EventItem) => {
  if (event.status) return event.status.toUpperCase() === "UPCOMING";
  const value = event.date || event.start_time;
  return value ? new Date(value).getTime() >= Date.now() : true;
};

function EventRow({ event, index }: { event: EventItem; index: number }) {
  const upcoming = isUpcoming(event);
  const eventTitle = event.title || event.name || "Garraway F Event";
  const destination = event.url || SITE_LINKS.facebookEvents;
  const isDirectLink = destination.replace(/\/$/, "") !== SITE_LINKS.facebookEvents.replace(/\/$/, "");
  return (
    <article
      className={`eventIndexRow ${upcoming ? "isUpcoming" : "isArchive"}`}
    >
      <span className="eventIndexNo">{String(index + 1).padStart(2, "0")}</span>
      <time>{formatDate(event.date || event.start_time)}</time>
      <div className="eventIndexCopy">
        <span>{upcoming ? "UPCOMING / 開催予定" : "ARCHIVE / 開催終了"}</span>
        <h3>{eventTitle}</h3>
        <p>{event.category || "COMMUNITY / CO-CREATION"}</p>
      </div>
      <a
        className="eventIndexLink"
        href={destination}
        target="_blank"
        rel="noreferrer"
        aria-label={`${eventTitle}の情報をFacebookで確認`}
      >
        {isDirectLink ? "DETAIL" : "FB一覧"} <b aria-hidden="true">↗</b>
      </a>
    </article>
  );
}

export default function EventsLive() {
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

  const events = [...(data?.facebook?.events ?? [])].sort((a, b) => {
    const upcomingDifference = Number(isUpcoming(b)) - Number(isUpcoming(a));
    if (upcomingDifference !== 0) return upcomingDifference;
    const dateA = new Date(a.date || a.start_time || 0).getTime();
    const dateB = new Date(b.date || b.start_time || 0).getTime();
    return isUpcoming(a) ? dateA - dateB : dateB - dateA;
  });
  const posts = (data?.instagram?.posts ?? []).slice(0, 4);

  return (
    <>
      <section className="eventIndexSection" aria-labelledby="event-index-title">
        <header className="eventIndexHead">
          <p className="sectionTag">EVENT INFORMATION</p>
          <h2 id="event-index-title">次の出会いを、<br />見つける。</h2>
          <p>
            まず日付とタイトルを確認。気になる企画は「DETAIL」から公式情報へ進めます。
          </p>
        </header>

        <div className="eventIndexLayout">
          <div className="eventIndexBoard">
            {!data && !failed ? (
              Array.from({ length: 3 }).map((_, index) => <div className="eventIndexSkeleton" key={index} />)
            ) : events.length > 0 ? (
              events.map((event, index) => <EventRow event={event} index={index} key={event.id || `${event.date}-${index}`} />)
            ) : (
              <a className="eventEmpty" href={SITE_LINKS.facebookEvents} target="_blank" rel="noreferrer">
                最新イベントをFacebookで確認する <span>↗</span>
              </a>
            )}
          </div>

          <aside className="eventFacebookPanel" aria-label="Facebookイベント">
            <div>
              <span>DIRECT FROM</span>
              <h2>Facebook</h2>
              <p>詳細・変更・申込みは、Facebookの公式イベント一覧でご確認ください。</p>
            </div>
            <iframe
              title="Garraway F Facebook Events"
              src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fgarrawayf%2F&tabs=events&width=500&height=500&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true"
              width="500"
              height="360"
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            />
            <a href={SITE_LINKS.facebookEvents} target="_blank" rel="noreferrer">FACEBOOK EVENTS <b>↗</b></a>
          </aside>
        </div>
      </section>

      <section className="eventInstagramSection" aria-labelledby="event-instagram-title">
        <header>
          <p className="sectionTag">LIVE FROM THE LAB</p>
          <h2 id="event-instagram-title">現場の熱量は、<br />Instagramから。</h2>
          <a href={SITE_LINKS.instagram} target="_blank" rel="noreferrer">@garrawayf_lounge ↗</a>
        </header>
        <div className="eventInstagramGrid" role="region" aria-label="Instagramの投稿。横にスワイプして確認できます" tabIndex={0}>
          {posts.length > 0 ? posts.map((post, index) => (
            <a
              href={post.permalink || SITE_LINKS.instagram}
              target="_blank"
              rel="noreferrer"
              className="eventInstagramCard"
              key={post.id || index}
            >
              <div>
                {(post.media_url || post.image || post.thumbnail_url) ? (
                  <img src={post.media_url || post.image || post.thumbnail_url} alt={post.caption || "Garraway F Instagram投稿"} loading={index < 2 ? "eager" : "lazy"} referrerPolicy="no-referrer" />
                ) : <span>GARRAWAY F</span>}
                <b>{String(index + 1).padStart(2, "0")}</b>
              </div>
              <time>{formatDate(post.timestamp)}</time>
              <p>{post.caption || "Garraway Fの最新情報を見る"}</p>
            </a>
          )) : (
            <a className="eventInstagramFallback" href={SITE_LINKS.instagram} target="_blank" rel="noreferrer">
              Instagramで最新の様子を見る <span>↗</span>
            </a>
          )}
        </div>
      </section>
    </>
  );
}
