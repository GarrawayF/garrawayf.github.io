import { roomApi } from "./board-room";
import { cleanWorksheet, type Worksheet } from "./worksheet";
import type { MapGroup, MapTheme } from "./mind-map-model";

export type SavedTheme = MapTheme & { version: number; updatedAt: string };
export type ThemeDraft = {
  id: string; team: MapGroup | ""; round: MapTheme["round"]; text: string; worksheet: Worksheet;
  sourceIdeaId: string; sourceIdeaId2: string; version: number | null;
};

type SaveResult = { status: "saved" | "conflict"; theme: SavedTheme } | { status: "rejected"; message: string };
export function draftFromTheme(theme: SavedTheme): ThemeDraft {
  return {
    id: theme.id, team: theme.team, round: theme.round, text: theme.enteredText ?? theme.text,
    worksheet: cleanWorksheet(theme.worksheet), version: theme.version,
    sourceIdeaId: theme.sourceIdeaId || "", sourceIdeaId2: theme.sourceIdeaId2 || "",
  };
}

function sameFields(a: Worksheet, b: Worksheet) {
  const first = Object.entries(cleanWorksheet(a)), second = cleanWorksheet(b);
  return first.length === Object.keys(second).length && first.every(([key, value]) => value === second[key as keyof Worksheet]);
}

export async function saveTheme(draft: ThemeDraft): Promise<SaveResult> {
  const editing = draft.version !== null;
  const content = { id: draft.id, text: draft.text.trim(), worksheet: cleanWorksheet(draft.worksheet) };
  const payload = editing ? { ...content, version: draft.version } : {
    ...content, team: draft.team, round: draft.round,
    sourceIdeaId: draft.sourceIdeaId || null, sourceIdeaId2: draft.sourceIdeaId2 || null,
  };
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(roomApi("/api/themes"), {
      method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      credentials: "omit", body: JSON.stringify(payload), signal: controller.signal,
    });
    const result = await response.json() as { theme?: SavedTheme; error?: string };
    if (response.status === 409 && editing && result.theme?.id === draft.id) {
      const matches = (result.theme.enteredText ?? result.theme.text) === content.text && sameFields(result.theme.worksheet || {}, content.worksheet);
      return { status: matches ? "saved" : "conflict", theme: result.theme };
    }
    if (response.ok && result.theme?.id === draft.id) return { status: "saved", theme: result.theme };
    if (response.status >= 400 && response.status < 500) return { status: "rejected", message: result.error || "内容を確認して、もう一度保存してください。" };
    throw new Error("保存結果を確認できません。接続が戻ったらもう一度保存してください。");
  } finally { clearTimeout(timer); }
}
