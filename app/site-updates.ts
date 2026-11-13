import { z } from "zod";
import content from "../content/site-updates.json";
import { eventEndsAt, eventStartsAt, formatEventDate } from "./event-schedule";

const publicUrl = z.string().refine((value) => {
  if (/^\/(?!\/)[^\\\s]*$/.test(value)) return true;
  if (!value.startsWith("https://")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "同じサイト内のパス、またはHTTPSのURLを指定してください");

const entry = {
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  date: z.iso.date(),
  title: z.string().trim().min(1),
  url: publicUrl.optional(),
};

const noticeSchema = z.strictObject({
  ...entry,
  description: z.string().trim().min(1),
  expires_on: z.iso.date().optional(),
}).refine((notice) => !notice.expires_on || notice.expires_on >= notice.date, {
  path: ["expires_on"],
  message: "掲載終了日は掲載日以降にしてください",
});

const eventSchema = z.strictObject({
  ...entry,
  start_time: z.iso.datetime({ offset: true }).optional(),
  end_time: z.iso.datetime({ offset: true }).optional(),
  category: z.string().optional(),
  organizer: z.string().optional(),
  venue: z.string().optional(),
  description: z.string().optional(),
  status: z.literal("cancelled").optional(),
}).refine((event) => !event.start_time || formatEventDate(event) === formatEventDate({ date: event.date }), {
  path: ["start_time"],
  message: "開催日と開始時刻の日本時間の日付を一致させてください",
}).refine((event) => {
  if (!event.end_time) return true;
  const end = eventStartsAt({ start_time: event.end_time });
  return Boolean(event.start_time && end !== null && end === eventEndsAt(event));
}, {
  path: ["end_time"],
  message: "終了時刻を使う場合は開始時刻も入力し、終了は開始以降にしてください",
});

const siteUpdatesSchema = z.strictObject({ notices: z.array(noticeSchema), events: z.array(eventSchema) })
  .refine(({ notices, events }) => {
    const entries = [...notices, ...events];
    return new Set(entries.map(({ id }) => id)).size === entries.length;
  }, "idはお知らせとイベント全体で重複させないでください");

export type SiteNotice = z.infer<typeof noticeSchema>;
export type SiteEvent = z.infer<typeof eventSchema>;

export const siteUpdates = siteUpdatesSchema.parse(content);
export const listingBuildTime = Date.now();
