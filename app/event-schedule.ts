export type EventSchedule = {
  date?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
};

export type EventState = "upcoming" | "ended" | "unknown";

const DAY = 24 * 60 * 60 * 1000;
const JAPAN_OFFSET = 9 * 60 * 60 * 1000;

// Feed dates without a time zone describe the venue's local time in Japan.
// Reject malformed calendar dates instead of allowing Date to roll them over.
function parseEventDate(value?: string): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction, zone] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    Number.isNaN(calendar.getTime()) ||
    calendar.getUTCFullYear() !== Number(year) ||
    calendar.getUTCMonth() + 1 !== Number(month) ||
    calendar.getUTCDate() !== Number(day) ||
    Number(hour || 0) > 23 || Number(minute || 0) > 59 || Number(second || 0) > 59
  ) return null;
  const time = Date.parse(`${year}-${month}-${day}T${hour || "00"}:${minute || "00"}:${second || "00"}${fraction || ""}${zone || "+09:00"}`);
  return Number.isFinite(time) ? time : null;
}

export function eventStartsAt(event: EventSchedule): number | null {
  return parseEventDate(event.start_time) ?? parseEventDate(event.date);
}

export function eventEndsAt(event: EventSchedule): number | null {
  const start = eventStartsAt(event);
  const explicitEnd = parseEventDate(event.end_time);
  if (explicitEnd !== null && (start === null || explicitEnd >= start)) {
    return /^\d{4}-\d{2}-\d{2}$/.test((event.end_time ?? "").trim())
      ? explicitEnd + DAY
      : explicitEnd;
  }
  // With no usable end time, keep the event current through its whole Japan day.
  return start === null ? null : Math.floor((start + JAPAN_OFFSET) / DAY + 1) * DAY - JAPAN_OFFSET;
}

export function getEventState(event: EventSchedule, now: number): EventState {
  const end = eventEndsAt(event);
  if (end !== null) return now >= end ? "ended" : "upcoming";
  const status = event.status?.toUpperCase();
  return status === "ARCHIVE" || status === "ENDED" ? "ended" : "unknown";
}

export function sortEvents<T extends EventSchedule>(events: readonly T[], now: number): T[] {
  const rank = { upcoming: 0, unknown: 1, ended: 2 };
  return [...events].sort((a, b) => {
    const stateA = getEventState(a, now);
    const stateB = getEventState(b, now);
    if (stateA !== stateB) return rank[stateA] - rank[stateB];
    const dateA = eventStartsAt(a);
    const dateB = eventStartsAt(b);
    if (dateA === null) return dateB === null ? 0 : 1;
    if (dateB === null) return -1;
    return stateA === "ended" ? dateB - dateA : dateA - dateB;
  });
}

export function formatEventDate(event: EventSchedule): string {
  const time = eventStartsAt(event);
  if (time === null) return "日程確認中";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(time);
}
