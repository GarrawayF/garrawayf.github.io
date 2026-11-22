import type { z } from "zod";

// Each worksheet can contain fourteen 800-character fields, including JSON escapes.
const maxBytes = 96 * 1024;

export function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export const readCache = "private, no-cache, must-revalidate";

export type BoardRoom = "event" | "demo";

export function boardRoom(request: Request): BoardRoom {
  return new URL(request.url).searchParams.get("room") === "demo" ? "demo" : "event";
}

const pagesOrigin = "https://garrawayf.github.io";

// The published Pages client and downloaded HTML use the anonymous board API.
// A file has an opaque origin. Neither client needs cookies or credentials.
export async function serveAttendee(
  request: Request,
  handle: (request: Request) => Response | Promise<Response>
) {
  const origin = request.headers.get("Origin");
  const allowedExternal = origin === pagesOrigin || origin === "null";
  const crossSite = request.headers.get("Sec-Fetch-Site") === "cross-site";
  const denied = !allowedExternal && (crossSite || (origin !== null && origin !== new URL(request.url).origin));
  const response = denied ? error("このボードからアクセスしてください。", 403) : await handle(request);
  response.headers.append("Vary", "Origin");
  if (allowedExternal) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Expose-Headers", "ETag");
  }
  return response;
}

export function preflight(request: Request, methods: readonly string[], additionalHeaders: readonly string[] = []) {
  return serveAttendee(request, () => {
    const method = request.headers.get("Access-Control-Request-Method");
    const allowedHeaders = ["Content-Type", "If-None-Match", ...additionalHeaders];
    const lowerCaseHeaders = allowedHeaders.map((name) => name.toLowerCase());
    const headers = (request.headers.get("Access-Control-Request-Headers") ?? "")
      .toLowerCase().split(",").map((value) => value.trim()).filter(Boolean);
    if ((method && !methods.includes(method)) ||
      headers.some((name) => !lowerCaseHeaders.includes(name))) {
      return error("このリクエストは利用できません。", 403);
    }
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": [...methods, "OPTIONS"].join(", "),
        "Access-Control-Allow-Headers": allowedHeaders.join(", "),
        "Access-Control-Max-Age": "600",
        "Cache-Control": "no-store",
      },
    });
  });
}

// Limit the bytes actually read; streamed requests need not include a content length.
export async function readSubmission<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
  messages: Record<string, string>
): Promise<z.infer<S> | Response> {
  if (request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return error("JSON形式で送信してください。", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) return error("投稿内容を入力してください。", 400);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let json = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return error("入力内容が長すぎます。短くしてお試しください。", 413);
      }
      json += decoder.decode(value, { stream: true });
    }
    const result = schema.safeParse(JSON.parse(json + decoder.decode()));
    if (!result.success) {
      const field = result.error.issues[0]?.path[0];
      return error(messages[String(field)] ?? "投稿内容を確認してください。", 400);
    }
    return result.data;
  } catch {
    return error("投稿内容を読み取れませんでした。もう一度お試しください。", 400);
  } finally {
    reader.releaseLock();
  }
}

