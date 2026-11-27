"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEventDate, formatEventHours, getEventState, sortEvents } from "./event-schedule";
import { siteUpdatesSchema, type SiteEvent, type SiteNotice, type SiteUpdates } from "./site-updates-schema";
import { useEventClock } from "./use-event-clock";
import styles from "./official-updates.module.css";

type Props = {
  notices: readonly SiteNotice[];
  events: readonly SiteEvent[];
  initialNow: number;
  compact?: boolean;
};

function EventRow({ event, ended }: { event: SiteEvent; ended: boolean }) {
  const cancelled = event.status === "cancelled";
  const time = formatEventHours(event);
  return (
    <article id={event.id} className={`eventIndexRow ${styles.eventRow} ${ended || cancelled ? "isArchive" : "isUpcoming"}`}>
      {(cancelled || ended) && <strong className="eventEndedSticker">{cancelled ? "中止" : "終了"}</strong>}
      <div className={styles.eventDate}>
        <time dateTime={event.start_time || event.date}>{formatEventDate(event)}</time>
        {time && <span>{time}</span>}
      </div>
      <div className="eventIndexCopy">
        <h4>{event.title}</h4>
        {event.venue && <p>{event.venue}</p>}
        {(event.organizer || event.category) && <p>{event.organizer ? `主催 ${event.organizer}` : event.category}</p>}
        {event.description && <p className="eventDescription">{event.description}</p>}
      </div>
      {event.url && !cancelled && (
        <a
          className={styles.detailLink}
          href={event.url}
          aria-label={`${event.title}の詳細を見る`}
        >
          詳細 <b aria-hidden="true">↗</b>
        </a>
      )}
    </article>
  );
}

const LIVE_LISTINGS = "https://garrawayf.github.io/events/feed.json";

export default function OfficialListings({ notices: builtNotices, events: builtEvents, initialNow, compact = false }: Props) {
  const [live, setLive] = useState<SiteUpdates | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    void fetch(LIVE_LISTINGS, { signal: controller.signal, credentials: "omit", redirect: "error" })
      .then((response) => response.ok ? response.json() : null)
      .then((raw: unknown) => {
        const parsed = siteUpdatesSchema.safeParse(raw);
        if (parsed.success && !controller.signal.aborted) setLive(parsed.data);
      })
      .catch(() => { /* Keep the last bundled, validated public catalogue. */ })
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);
  const notices = live?.notices ?? builtNotices;
  const events = live?.events ?? builtEvents;
  const schedule = useMemo(() => [
    ...events,
    ...notices.filter((notice) => notice.expires_on).map((notice) => ({ date: notice.expires_on })),
  ], [events, notices]);
  const now = useEventClock(schedule, initialNow);
  const displayedNotices = notices
    .filter((notice) => !notice.expires_on || getEventState({ date: notice.expires_on }, now) === "upcoming")
    .sort((a, b) => b.date.localeCompare(a.date));
  const orderedEvents = sortEvents(events, now);
  const current = orderedEvents.filter((event) => getEventState(event, now) === "upcoming");
  const upcoming = current.filter((event) => event.status !== "cancelled");
  const cancelled = current.filter((event) => event.status === "cancelled");
  const archive = orderedEvents.filter((event) => getEventState(event, now) === "ended");

  return (
    <div className={styles.listings}>
      {displayedNotices.length > 0 && (
        <section aria-labelledby="site-notices">
          <h3 className={styles.listTitle} id="site-notices">お知らせ</h3>
          <div className="eventIndexBoard">
            {displayedNotices.map((notice) => (
              <article className={styles.notice} id={notice.id} key={notice.id}>
                <time dateTime={notice.date}>{formatEventDate(notice)}</time>
                <h4>{notice.title}</h4>
                <p>{notice.description}</p>
                {notice.url && (
                  <a className={styles.detailLink} href={notice.url} aria-label={`${notice.title}の詳細を見る`}>詳細 <b aria-hidden="true">↗</b></a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {cancelled.length > 0 && (
        <section aria-labelledby="cancelled-events">
          <h3 className={styles.listTitle} id="cancelled-events">開催中止</h3>
          <div className="eventIndexBoard">
            {cancelled.map((event) => <EventRow event={event} ended={false} key={event.id} />)}
          </div>
        </section>
      )}
      <section aria-labelledby="upcoming-events">
        <h3 className={styles.listTitle} id="upcoming-events">開催予定</h3>
        <div className="eventIndexBoard">
          {upcoming.length > 0 ? (compact ? upcoming.slice(0, 3) : upcoming).map((event) => (
            <EventRow event={event} ended={false} key={event.id} />
          )) : <p className={styles.empty}>このサイトでご案内している開催予定はありません。</p>}
        </div>
      </section>
      {!compact && (
        <section aria-labelledby="past-events">
          <h3 className={styles.listTitle} id="past-events">開催アーカイブ</h3>
          <div className="eventIndexBoard">
            {archive.length ? archive.map((event) => <EventRow event={event} ended key={event.id} />) : <p className={styles.empty}>掲載中のアーカイブはありません。</p>}
          </div>
        </section>
      )}
    </div>
  );
}
