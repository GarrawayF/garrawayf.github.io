import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { boardRoom, error, preflight, readCache, readSubmission, serveAttendee, type BoardRoom } from "../attendees";
import { analyzePost } from "../../post-analysis";
import { worksheetHeadline } from "../../worksheet";
import { sameWorksheet, worksheetInput, worksheetMessages } from "../worksheet-input";
import { getDb } from "../../../db";
import { ideas } from "../../../db/schema";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid().transform((value) => value.toLowerCase());
const submission = z.object({
  id: uuid,
  team: z.enum(["A", "B", "C", "D", "E"]),
  round: z.number().int().min(1).max(4),
  text: z.string().max(800).optional().default(""),
  worksheet: worksheetInput.optional().default({}),
  context: z.string().max(400).optional().default(""),
  name: z.string().trim().max(40).optional().default(""),
  parentId: uuid.nullish().transform((id) => id ?? null),
}).refine(value => Boolean(worksheetHeadline(value.text, value.worksheet, value.context).trim()), { path: ["content"] });

function publicIdea({ sequence: _sequence, ...row }: typeof ideas.$inferSelect) {
  const idea = { ...row, enteredText: row.text, text: worksheetHeadline(row.text, row.worksheet, row.context) };
  return { ...idea, analysis: analyzePost(idea, "idea") };
}

function tag(room: BoardRoom, sequence: number) {
  return `"board-v3-${room}-${sequence}"`;
}

export function OPTIONS(request: Request) {
  return preflight(request, ["GET", "POST"]);
}

export function GET(request: Request) {
  return serveAttendee(request, listIdeas);
}

async function listIdeas(request: Request) {
  try {
    const db = getDb();
    const room = boardRoom(request);
    const inRoom = eq(ideas.room, room);
    const previous = request.headers.get("If-None-Match");
    if (previous) {
      const latest = await db.select({ seq: ideas.sequence }).from(ideas).where(inRoom).orderBy(desc(ideas.sequence)).limit(1);
      const etag = tag(room, latest[0]?.seq ?? 0);
      if (previous === etag) {
        return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": readCache } });
      }
    }

    const rows = await db.select().from(ideas).where(inRoom).orderBy(desc(ideas.sequence));
    return Response.json(
      { ideas: rows.map(publicIdea) },
      { headers: { ETag: tag(room, rows[0]?.sequence ?? 0), "Cache-Control": readCache } }
    );
  } catch (err) {
    console.error("Reading the discussion board failed", err);
    return error("一覧を読み込めませんでした。少し待ってから、もう一度お試しください。", 503);
  }
}

export function POST(request: Request) {
  return serveAttendee(request, saveIdea);
}

async function saveIdea(request: Request) {
  const value = await readSubmission(request, submission, {
    ...worksheetMessages,
    team: "班を選んでください。",
    round: "回を選んでください。",
    text: "案は800文字以内で入力してください。",
    context: "きっかけは400文字以内で入力してください。",
    name: "名前は40文字以内で入力してください。",
  });
  if (value instanceof Response) return value;

  try {
    const db = getDb();
    const room = boardRoom(request);
    const inRoom = eq(ideas.room, room);
    if (value.parentId) {
      const parent = await db.select({ id: ideas.id }).from(ideas).where(and(inRoom, eq(ideas.id, value.parentId))).limit(1);
      if (parent.length === 0) return error("元の案が見つかりません。一覧を更新してください。", 400);
    }

    // The write and lookup share one D1 transaction, including when a device retries.
    const [inserted, matches] = await db.batch([
      db.insert(ideas).values({ ...value, room, createdAt: new Date().toISOString() })
        .onConflictDoNothing({ target: ideas.id })
        .returning({ id: ideas.id }),
      db.select().from(ideas).where(and(inRoom, eq(ideas.id, value.id))).limit(1),
    ]);
    const record = matches[0];
    if (!record) return error("この投稿IDは使用できません。新しい案として送信してください。", 409);
    // Older clients trimmed the surrounding whitespace before storing these fields.
    if (!inserted.length && (record.text.trim() !== value.text.trim() || record.team !== value.team ||
        record.round !== value.round || record.name !== value.name ||
        record.context.trim() !== value.context.trim() || record.parentId !== value.parentId || !sameWorksheet(record.worksheet, value.worksheet))) {
      return error("送信済みの内容と異なります。一覧を更新し、新しい案として投稿してください。", 409);
    }
    return Response.json({ idea: publicIdea(record) }, { status: inserted.length ? 201 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Saving an idea failed", err);
    return error("投稿できませんでした。入力した内容のまま、もう一度お試しください。", 503);
  }
}
