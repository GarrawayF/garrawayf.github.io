export const WORKSHEET_FIELD_LIMIT = 800;
export const HEADLINE_LIMIT = 80;

export const WORKSHEET_KEYS = [
  "person", "scene", "gain", "perspective", "voice", "partners", "round1", "round2", "round3",
  "reflection", "teamScene", "audience", "origin", "recorder",
] as const;

export type WorksheetKey = (typeof WORKSHEET_KEYS)[number];
export type Worksheet = Partial<Record<WorksheetKey, string>> & { headline?: string };
export type WorksheetMode = "personal" | "work" | "summary" | "plenary";

type Field = { label: string; hint?: string };
const fields: Record<WorksheetKey, Field> = {
  person: { label: "誰のことを考える？", hint: "品川で過ごす人を一人、思い浮かべて。" },
  scene: { label: "いつ、どんな場面？" },
  gain: { label: "その人にとって、うれしい変化は？", hint: "何が楽になる？　どんな体験ができるとうれしい？　どちらからでも。" },
  perspective: { label: "ほかの立場から見ると？" },
  voice: { label: "きっかけになった声・体験・共感した理由" },
  partners: { label: "品川で、誰とどんなことを試してみたい？" },
  round1: { label: "牧村さんの回で出たテーマと、きっかけになった声" },
  round2: { label: "宮代さんの回で出たテーマと、きっかけになった声" },
  round3: { label: "南さんの回で出たテーマと、きっかけになった声" },
  reflection: { label: "3回分を見渡して気づいたこと", hint: "違う立場から出た言葉や、一人だけの視点も。" },
  teamScene: { label: "班の挑戦テーマ・思い浮かべた場面", hint: "どの班の話かも一緒に書けます。" },
  audience: { label: "会場から返ってきた言葉・問い" },
  origin: { label: "きっかけになったテーマや言葉" },
  recorder: { label: "記録担当" },
};

export const worksheetGroups: Record<WorksheetMode, readonly WorksheetKey[]> = {
  personal: ["person", "scene", "gain", "perspective"],
  work: ["person", "scene", "gain", "perspective", "partners", "voice", "recorder"],
  summary: ["round1", "round2", "round3", "reflection", "origin", "recorder"],
  plenary: ["teamScene", "audience", "origin", "recorder"],
};

export function worksheetField(key: WorksheetKey, mode: WorksheetMode): Field {
  if (mode === "plenary" && key === "recorder") return { label: "全体記録担当" };
  return fields[key];
}

export function cleanWorksheet(input: unknown): Worksheet {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const data = input as Record<string, unknown>;
  const result: Worksheet = {};
  for (const key of WORKSHEET_KEYS) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) result[key] = value.trim();
  }
  if (typeof data.headline === "string" && data.headline.trim()) result.headline = data.headline.trim().slice(0, HEADLINE_LIMIT);
  return result;
}

export function hasWorksheetContent(worksheet?: Worksheet): boolean {
  return WORKSHEET_KEYS.some(key => key !== "recorder" && Boolean(worksheet?.[key]?.trim()));
}

export function worksheetHeadline(text: string, worksheet?: Worksheet, context = ""): string {
  if (text?.trim()) return text.trim();
  for (const key of WORKSHEET_KEYS) {
    const value = worksheet?.[key]?.trim();
    if (key !== "recorder" && value) return value;
  }
  return context?.trim() || "";
}
