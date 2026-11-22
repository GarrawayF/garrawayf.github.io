import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { worksheetHeadline } from "../../worksheet";
import { analyzePost } from "../../post-analysis";
import { sameWorksheet, worksheetInput, worksheetMessages } from "../worksheet-input";
import { getDb } from "../../../db";
import { ideas, teamThemes } from "../../../db/schema";
import { boardRoom, error, preflight, readCache, readSubmission, serveAttendee, type BoardRoom } from "../attendees";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const text = z.string().max(800);
const optionalSource = uuid.nullish().transform(id => id ?? null);
const submission = z.object({
  id: uuid,
  team: z.enum(["A", "B", "C", "D", "E", "all"]),
  round: z.number().int().min(1).max(5),
  text: text.optional().default(""),
  worksheet: worksheetInput.optional().default({}),
  sourceIdeaId: optionalSource,
  sourceIdeaId2: optionalSource,
}).refine(value => value.team !== "all" || value.round === 4, { path: ["attribution"] })
  .refine(value => Boolean(worksheetHeadline(value.text, value.worksheet).trim()), { path: ["content"] })
  .refine(value => !value.sourceIdeaId || value.sourceIdeaId !== value.sourceIdeaId2, { path: ["duplicateSources"] })
  .transform(value => ({
    ...value,
    sourceIdeaId: value.sourceIdeaId ?? value.sourceIdeaId2,
    sourceIdeaId2: value.sourceIdeaId ? value.sourceIdeaId2 : null,
  }));
const revision = z.object({
  id: uuid, version: z.number().int().positive(), text: text.optional(), worksheet: worksheetInput.optional(),
}).refine(value => value.text !== undefined || value.worksheet !== undefined, { path: ["content"] });
const messages = {
  ...worksheetMessages,
  duplicateSources: "二つの元案には違う案を選んでください。",
  team: "班を選んでください。",
  round: "回を選んでください。",
  text: "挑戦テーマは800文字以内で入力してください。",
  version: "一覧を更新し、最新のテーマを開いてください。",
  attribution: "会場全体のテーマは「全体対話」に記録してください。",
};

function publicTheme({ sequence: _sequence, initialText: _initial, initialWorksheet: _initialSheet, ...row }: typeof teamThemes.$inferSelect) {
  const theme = { ...row, enteredText: row.text, text: worksheetHeadline(row.text, row.worksheet) };
  return { ...theme, analysis: analyzePost(theme, "theme") };
}

function tag(room: BoardRoom, totalVersion: number) {
  return `"themes-v4-${room}-${totalVersion}"`;
}

export function OPTIONS(request: Request) {
  return preflight(request, ["GET", "POST", "PATCH"]);
}

export function GET(request: Request) {
  return serveAttendee(request, async () => {
    try {
      const db = getDb();
      const room = boardRoom(request);
      const inRoom = eq(teamThemes.room, room);
      const previous = request.headers.get("If-None-Match");
      if (previous) {
        // The table is append-only and each edit increments exactly one version.
        const [latest] = await db.select({ sum: sql<number>`coalesce(sum(${teamThemes.version}), 0)` }).from(teamThemes).where(inRoom);
        const etag = tag(room, latest.sum);
        if (previous === etag) {
          return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": readCache } });
        }
      }
      const rows = await db.select().from(teamThemes).where(inRoom).orderBy(desc(teamThemes.sequence));
      const version = rows.reduce((sum, row) => sum + row.version, 0);
      return Response.json({ themes: rows.map(publicTheme) }, { headers: { ETag: tag(room, version), "Cache-Control": readCache } });
    } catch (err) {
      console.error("Reading team themes failed", err);
      return error("班の挑戦テーマを読み込めませんでした。もう一度お試しください。", 503);
    }
  });
}

export function POST(request: Request) {
  return serveAttendee(request, async () => {
    const value = await readSubmission(request, submission, messages);
    if (value instanceof Response) return value;
    try {
      const db = getDb();
      const room = boardRoom(request);
      const sourceIds = [value.sourceIdeaId, value.sourceIdeaId2].filter((id): id is string => id !== null);
      if (sourceIds.length) {
        const sources = await db.select({ id: ideas.id }).from(ideas).where(and(eq(ideas.room, room), inArray(ideas.id, sourceIds)));
        if (sources.length !== sourceIds.length) return error("元の個人案が見つかりません。一覧を更新してください。", 400);
      }
      const time = new Date().toISOString();
      const [inserted, rows] = await db.batch([
        db.insert(teamThemes).values({ ...value, room, initialText: value.text, initialWorksheet: value.worksheet, createdAt: time, updatedAt: time })
          .onConflictDoNothing({ target: teamThemes.id }).returning({ id: teamThemes.id }),
        db.select().from(teamThemes).where(and(eq(teamThemes.room, room), eq(teamThemes.id, value.id))).limit(1),
      ]);
      const row = rows[0];
      if (!row) return error("この投稿IDは使用できません。新しいテーマとして送信してください。", 409);
      // An original POST remains retryable after later PATCHes.
      if (!inserted.length && (row.initialText.trim() !== value.text.trim() || row.team !== value.team ||
          row.round !== value.round || row.sourceIdeaId !== value.sourceIdeaId || row.sourceIdeaId2 !== value.sourceIdeaId2 ||
          !sameWorksheet(row.initialWorksheet, value.worksheet))) {
        return error("送信済みの内容と異なります。新しいテーマとして投稿してください。", 409);
      }
      return Response.json({ theme: publicTheme(row) }, {
        status: inserted.length ? 201 : 200, headers: { "Cache-Control": "no-store" },
      });
    } catch (err) {
      console.error("Saving a team theme failed", err);
      return error("テーマを保存できませんでした。もう一度お試しください。", 503);
    }
  });
}

export function PATCH(request: Request) {
  return serveAttendee(request, async () => {
    const value = await readSubmission(request, revision, messages);
    if (value instanceof Response) return value;
    try {
      const db = getDb();
      const match = and(eq(teamThemes.room, boardRoom(request)), eq(teamThemes.id, value.id));
      const [before] = await db.select().from(teamThemes).where(match).limit(1);
      if (!before) return error("このテーマが見つかりません。", 404);

      // Preserve any field omitted by an older editor. The version predicate
      // guarantees these merged values are never written onto a newer revision.
      const nextText = value.text ?? before.text;
      const nextWorksheet = value.worksheet ?? before.worksheet;
      if (before.version === value.version && !worksheetHeadline(nextText, nextWorksheet).trim()) {
        return error(worksheetMessages.content, 400);
      }
      const [written, rows] = await db.batch([
        db.update(teamThemes).set({
          text: nextText, worksheet: nextWorksheet,
          version: sql`${teamThemes.version} + 1`,
          updatedAt: new Date().toISOString(),
        }).where(and(match, eq(teamThemes.version, value.version)))
          .returning({ id: teamThemes.id }),
        db.select().from(teamThemes).where(match).limit(1),
      ]);
      const row = rows[0];
      if (!row) return error("このテーマが見つかりません。", 404);
      const theme = publicTheme(row);
      // An exact repeat of a completed update can acknowledge its saved result.
      if (!written.length && (row.version !== value.version + 1 ||
          (value.text !== undefined && row.text !== value.text) ||
          (value.worksheet !== undefined && !sameWorksheet(row.worksheet, value.worksheet)))) {
        return Response.json({ error: "ほかの人が先に更新しました。最新の本文を確認してください。", theme },
          { status: 409, headers: { "Cache-Control": "no-store" } });
      }
      return Response.json({ theme }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      console.error("Editing a team theme failed", err);
      return error("更新できませんでした。もう一度お試しください。", 503);
    }
  });
}
