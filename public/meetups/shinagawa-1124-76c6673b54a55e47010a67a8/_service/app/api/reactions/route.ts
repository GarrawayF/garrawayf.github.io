import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import { ideas, reactions, teamThemes } from "../../../db/schema";
import { boardRoom, error, preflight, readSubmission, serveAttendee, type BoardRoom } from "../attendees";

export const dynamic = "force-dynamic";

const actorHeader = "X-Board-Actor";
const privateHeaders = { "Cache-Control": "private, no-store", Vary: actorHeader };
const submission = z.object({
  targetType: z.enum(["idea", "theme"]),
  targetId: z.string().uuid().transform(value => value.toLowerCase()),
  kind: z.enum(["like", "love"]),
  active: z.boolean(),
});

async function readActor(request: Request) {
  const token = request.headers.get(actorHeader);
  if (token === null) return null;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    return error("端末を確認できませんでした。ページを開き直してください。", 400);
  }
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

function counts(db: ReturnType<typeof getDb>, actorHash: string | null, room: BoardRoom, targetFilter?: SQL) {
  return db.select({
    targetType: sql<"idea" | "theme">`case when ${reactions.ideaId} is null then 'theme' else 'idea' end`,
    targetId: sql<string>`coalesce(${reactions.ideaId}, ${reactions.themeId})`,
    likes: sql<number>`count(*) filter (where ${reactions.kind} = 'like')`,
    loves: sql<number>`count(*) filter (where ${reactions.kind} = 'love')`,
    myLike: sql`count(*) filter (where ${reactions.kind} = 'like' and ${reactions.actorHash} = ${actorHash})`.mapWith(Boolean),
    myLove: sql`count(*) filter (where ${reactions.kind} = 'love' and ${reactions.actorHash} = ${actorHash})`.mapWith(Boolean),
  }).from(reactions)
    .leftJoin(ideas, eq(reactions.ideaId, ideas.id))
    .leftJoin(teamThemes, eq(reactions.themeId, teamThemes.id))
    .where(and(or(eq(ideas.room, room), eq(teamThemes.room, room)), targetFilter))
    .groupBy(reactions.ideaId, reactions.themeId);
}

export function OPTIONS(request: Request) {
  return preflight(request, ["GET", "POST"], [actorHeader]);
}

export function GET(request: Request) {
  return serveAttendee(request, async () => {
    const actorHash = await readActor(request);
    if (actorHash instanceof Response) return actorHash;
    try {
      const rows = await counts(getDb(), actorHash, boardRoom(request));
      return Response.json({ reactions: rows }, { headers: privateHeaders });
    } catch {
      return error("リアクションを読み込めませんでした。もう一度お試しください。", 503);
    }
  });
}

export function POST(request: Request) {
  return serveAttendee(request, async () => {
    const actorHash = await readActor(request);
    if (actorHash instanceof Response) return actorHash;
    if (actorHash === null) return error("端末を確認できませんでした。", 400);
    const value = await readSubmission(request, submission, {
      targetType: "対象の案またはテーマを確認してください。",
      targetId: "対象の案またはテーマを確認してください。",
      kind: "いいね、またはLOVEを選んでください。",
      active: "リアクションの状態を確認してください。",
    });
    if (value instanceof Response) return value;
    const { targetType, targetId, kind, active } = value;
    const idea = targetType === "idea";
    const target = idea ? ideas : teamThemes;
    const matchTarget = eq(idea ? reactions.ideaId : reactions.themeId, targetId);
    try {
      const db = getDb();
      const room = boardRoom(request);
      const [exists] = await db.select({ id: target.id }).from(target).where(and(eq(target.room, room), eq(target.id, targetId))).limit(1);
      if (!exists) return error("対象の案またはテーマが見つかりません。", 404);

      // Store active marks only. The unique indexes make repeated intents idempotent,
      // and the D1 batch returns totals at the same point as this device's change.
      const write = active
        ? db.insert(reactions).values({
            ideaId: idea ? targetId : null, themeId: idea ? null : targetId, actorHash, kind,
          }).onConflictDoNothing()
        : db.delete(reactions).where(and(matchTarget, eq(reactions.actorHash, actorHash), eq(reactions.kind, kind)));
      const [, rows] = await db.batch([write, counts(db, actorHash, room, matchTarget)]);
      const reaction = rows[0] ?? { targetType, targetId, likes: 0, loves: 0, myLike: false, myLove: false };
      return Response.json({ reaction }, { headers: privateHeaders });
    } catch {
      return error("リアクションを保存できませんでした。もう一度お試しください。", 503);
    }
  });
}
