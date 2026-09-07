"use client";

import { useEffect, useState } from "react";
import { eventEndsAt, type EventSchedule } from "./event-schedule";

export function useEventClock(events?: readonly EventSchedule[]): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    let timer: number;
    const update = () => {
      const current = Date.now();
      setNow(current);
      const nextEnd = Math.min(
        ...(events ?? []).map(eventEndsAt).filter((end): end is number => end !== null && end > current),
      );
      // Re-render at the next end time even when the feed hasn't changed.
      timer = window.setTimeout(update, Math.min(nextEnd - current + 50, 24 * 60 * 60 * 1000));
    };
    const updateWhenVisible = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        update();
      }
    };
    timer = window.setTimeout(update, 0);
    document.addEventListener("visibilitychange", updateWhenVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, [events]);

  return now;
}
