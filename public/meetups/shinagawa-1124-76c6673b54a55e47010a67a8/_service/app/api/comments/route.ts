import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import { comments, ideas, teamThemes } from "../../../db/schema";
import { boardRoom, error, preflight, readCache, readSubmission, serveAttendee, type BoardRoom } from "../attendees";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const submission = z.object({
  id: uuid,
  targetType: z.enum(["idea", "theme"]),
  targetId: uuid,
  text: z.string().trim().min(1).max(400),
  name: z.string().trim().max(40).optional().default(""),
});

function publicComment(row: typeof comments.$inferSelect) {
  return {
    id: row.id,
    targetType: row.ideaId === null ? "theme" as const : "idea" as const,
    targetId: row.ideaId ?? row.themeId!,
    text: row.text, name: row.name, createdAt: row.createdAt,
  };
}

function tag(room: BoardRoom, sequence: number) {
  return `"comments-v1-${room}-${sequence}"`;
}

export function OPTIONS(request: Request) {
  return preflight(request, ["GET", "POST"]);
}

export function GET(request: Request) {
  return serveAttendee(request, async () => {
    try {
      const db = getDb();
      const room = boardRoom(request);
      // Belonging to a room follows the immutable parent, including for legacy
      // posts. The client can count all threads with this one read per room.
      const inRoom = or(
        inArray(comments.ideaId, db.select({ id: ideas.id }).from(ideas).where(eq(ideas.room, room))),
        inArray(comments.themeId, db.select({ id: teamThemes.id }).from(teamThemes).where(eq(teamThemes.room, room))),
      );
      if (request.headers.has("If-None-Match")) {
        const [last] = await db.select({ sequence: comments.sequence }).from(comments)
          .where(inRoom).orderBy(desc(comments.sequence)).limit(1);
        const etag = tag(room, last?.sequence ?? 0);
        if (request.headers.get("If-None-Match") === etag) {
          return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": readCache } });
        }
      }
      const rows = await db.select().from(comments).where(inRoom).orderBy(comments.sequence);
      return Response.json({ comments: rows.map(publicComment) }, {
        headers: { ETag: tag(room, rows.at(-1)?.sequence ?? 0), "Cache-Control": readCache },
      });
    } catch (err) {
      console.error("Reading board comments failed", err);
      return error("コメントを読み込めませんでした。もう一度お試しください。", 503);
    }
  });
}

export function POST(request: Request) {
  return serveAttendee(request, async () => {
    const value = await readSubmission(request, submission, {
      id: "もう一度コメントを送信してください。",
      targetType: "コメントする案またはテーマを確認してください。",
      targetId: "コメントする案またはテーマを確認してください。",
      text: "コメントを1〜400文字で入力してください。",
      name: "名前は40文字以内で入力してください。",
    });
    if (value instanceof Response) return value;
    const isIdea = value.targetType === "idea";
    const target = isIdea ? ideas : teamThemes;
    const targetColumn = isIdea ? comments.ideaId : comments.themeId;
    try {
      const db = getDb();
      const room = boardRoom(request);
      const [parent] = await db.select({ id: target.id }).from(target)
        .where(and(eq(target.room, room), eq(target.id, value.targetId))).limit(1);
      if (!parent) return error("コメントする案またはテーマが見つかりません。", 404);

      const [inserted, matches] = await db.batch([
        db.insert(comments).values({
          id: value.id, ideaId: isIdea ? value.targetId : null, themeId: isIdea ? null : value.targetId,
          text: value.text, name: value.name, createdAt: new Date().toISOString(),
        }).onConflictDoNothing({ target: comments.id }).returning({ id: comments.id }),
        db.select().from(comments).where(and(eq(comments.id, value.id), eq(targetColumn, value.targetId))).limit(1),
      ]);
      const row = matches[0];
      if (!row || row.text !== value.text || row.name !== value.name) {
        return error("この送信IDはすでに使われています。一覧を確認してください。", 409);
      }
      return Response.json({ comment: publicComment(row) }, {
        status: inserted.length ? 201 : 200, headers: { "Cache-Control": "no-store" },
      });
    } catch (err) {
      console.error("Saving a board comment failed", err);
      return error("コメントを送信できませんでした。もう一度お試しください。", 503);
    }
  });
}
