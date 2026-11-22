import { extractIdeaKeywords } from "./idea-keywords";
import { buildIdeaMap, groupLabel, kindLabel, locationLabel, stageLabel, type MapIdea, type MapRecord, type MapTheme } from "./mind-map-model";
import { cleanWorksheet, WORKSHEET_KEYS, type WorksheetKey } from "./worksheet";

type BranchType = "person" | "scene" | "gain" | "action" | "perspective" | "origin" | "quote" | "words" | "location" | "sources";
export type VisualSource = { key: string; title: string; location: string };
export type VisualBranch = { type: BranchType; label: string; passages: string[]; emphasis: string[]; sources?: VisualSource[] };
export type VisualModel = {
  key: string; title: string; kind: string; location: string; emphasis: string;
  branches: VisualBranch[]; original: { label: string; text: string }[];
};
type VisualIndexEntry = { record: MapRecord; sources: MapRecord[]; signature: string };
export type VisualIndex = Map<string, VisualIndexEntry>;

const fieldGuide: ReadonlyArray<readonly [WorksheetKey, BranchType, string]> = [
  ["person", "person", "誰に"], ["scene", "scene", "どんな場面で"], ["gain", "gain", "うれしい体験"],
  ["partners", "action", "一緒に試したいこと"], ["perspective", "perspective", "別の視点"],
  ["reflection", "perspective", "3回を見渡して"], ["teamScene", "scene", "班で考えた場面"],
  ["audience", "perspective", "会場からの声"], ["origin", "origin", "発想のきっかけ"],
  ["voice", "origin", "元になった声"], ["round1", "quote", "牧村さんの回"],
  ["round2", "quote", "宮代さんの回"], ["round3", "quote", "南さんの回"],
];

function normalized(value: string) {
  return value.trim().replace(/[\s。．.!！?？、]/gu, "");
}

function keywords(text: string) {
  return extractIdeaKeywords(text).filter(word => text.includes(word)).map((word, order) => ({ word, order }))
    .sort((a, b) => Math.min(12, b.word.length) - Math.min(12, a.word.length) || a.order - b.order)
    .map(item => item.word);
}

function emphasis(text: string) {
  const quoted = text.match(/[「『]([^「」『』\n]{2,24})[」』]/u)?.[1];
  return quoted || keywords(text)[0] || "";
}

export function excerpt(text: string, limit: number) {
  const chars = Array.from(text.trim());
  if (chars.length <= limit) return chars.join("");
  const tail = Math.min(25, Math.floor(limit * .3));
  return chars.slice(0, limit - tail).join("") + "［中略］" + chars.slice(-tail).join("");
}

export function makeVisualIndex(ideas: readonly MapIdea[], themes: readonly MapTheme[]): VisualIndex {
  const graph = buildIdeaMap(ideas, themes);
  const signatures = new Map(graph.records.map(record => {
    const r = record.row;
    const fields = cleanWorksheet(r.worksheet);
    const values = WORKSHEET_KEYS.filter(key => key !== "recorder").map(key => fields[key] || "");
    return [record.key, JSON.stringify([r.team, r.round, record.title, r.enteredText ?? r.text,
      record.kind === "idea" ? record.row.context : "", values])];
  }));
  return new Map(graph.records.map(record => {
    const sources = graph.sources.get(record.key) || [];
    const signature = JSON.stringify([signatures.get(record.key), sources.map(source => [source.key, signatures.get(source.key)])]);
    return [record.key, { record, sources, signature }];
  }));
}

function newBranch(type: BranchType, label: string, passages: string[]): VisualBranch {
  return { type, label, passages, emphasis: passages.map(emphasis) };
}

function buildVisual({ record, sources }: VisualIndexEntry): VisualModel {
  const { row } = record;
  const raw = (row.enteredText ?? row.text)?.trim() || "";
  const fields = cleanWorksheet(row.worksheet);
  const context = record.kind === "idea" ? record.row.context.trim() : "";
  const title = record.title.trim() || raw || context || kindLabel(record);
  const branches: VisualBranch[] = [];
  const seen = new Set([normalized(title)]);
  function add(type: BranchType, label: string, ...passages: (string | undefined)[]) {
    const fresh = passages.map(str => str?.trim() || "").filter(str => {
      const key = normalized(str);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length) branches.push(newBranch(type, label, fresh));
  }

  for (const [key, type, label] of fieldGuide) add(type, label, fields[key]);
  add("origin", "きっかけ・共感した理由", context);

  // Pair two related worksheet answers on one branch so there is room for other perspectives.
  const who = branches.find(branch => branch.type === "person");
  const when = branches.find(branch => branch.type === "scene");
  if (who && when) {
    who.label = "誰の、どんな場面";
    who.passages.push(...when.passages);
    who.emphasis.push(...when.emphasis);
    branches.splice(branches.indexOf(when), 1);
  }

  // A brief free-text submission has no reliable field labels. Keep its own words together.
  if (raw && !seen.has(normalized(raw))) {
    add("quote", record.kind === "theme" ? "挑戦テーマの原文" : "本人のことば", raw);
  }
  const room = sources.length ? 3 : 4;
  const chosen = branches.slice(0, room);
  // Preserve a different viewpoint when a long worksheet has filled every other slot.
  const perspective = branches.find(b => b.type === "perspective");
  if (perspective && !chosen.includes(perspective) && chosen.length === room) chosen[room - 1] = perspective;
  if (sources.length) {
    chosen.push({ type: "sources", label: sources.length > 1 ? "かけ合わせた元の案" : "元になった個人の案", passages: [], emphasis: [],
      sources: sources.map(source => ({ key: source.key, title: source.title, location: locationLabel(source) })) });
  }
  if (chosen.length < 2) {
    const words = keywords([raw, context, ...WORKSHEET_KEYS.filter(key => key !== "recorder").map(key => fields[key])].filter(Boolean).join("\n"))
      .filter(word => normalized(word) !== normalized(title)).slice(0, 3);
    if (words.length) chosen.push({ type: "words", label: "原文に出てくる言葉", passages: words, emphasis: words });
  }
  if (!chosen.length) {
    chosen.push({ type: "location", label: "この声が出た場", passages: [groupLabel(row.team)], emphasis: [] });
    chosen.push({ type: "origin", label: "議論した回", passages: [stageLabel(row.round)], emphasis: [] });
  } else if (chosen.length < 2) {
    chosen.push({ type: "location", label: "この案が出た場", passages: [groupLabel(row.team), stageLabel(row.round)], emphasis: [] });
  }
  const original: { label: string; text: string }[] = [];
  if (raw) original.push({ label: record.kind === "idea" ? "本人のことば" : "挑戦テーマ", text: raw });
  for (const [key, , label] of fieldGuide) if (fields[key]) original.push({ label, text: fields[key]! });
  if (context) original.push({ label: "きっかけ・共感した理由", text: context });
  return { original, key: record.key, kind: kindLabel(record), location: locationLabel(record), title, emphasis: emphasis(title), branches: chosen };
}

export class VisualCache {
  private values = new Map<string, { signature: string; model: VisualModel }>();
  fresh(key: string, entry: VisualIndexEntry) {
    return this.values.get(key)?.signature === entry.signature;
  }
  resolve(key: string, index: VisualIndex): VisualModel | undefined {
    const entry = index.get(key);
    if (!entry) return;
    const saved = this.values.get(key);
    if (saved?.signature === entry.signature) return saved.model;
    const model = buildVisual(entry);
    this.values.set(key, { signature: entry.signature, model });
    return model;
  }
  removeMissing(index: VisualIndex) {
    for (const key of this.values.keys()) if (!index.has(key)) this.values.delete(key);
  }
}
