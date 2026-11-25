import { HEADLINE_LIMIT, type Worksheet, type WorksheetKey } from "./worksheet";

export type AnalysisInput = {
  text: string;
  enteredText?: string;
  context?: string;
  worksheet?: Worksheet;
  round?: number;
  team?: string;
};
export type PostAnalysis = { title: string; summary: string };

type Field = Exclude<WorksheetKey, "recorder" | "headline"> | "text" | "context";
type Passage = { field: Field; text: string; key: string; index: number; weight: number };
type PostKind = "idea" | "theme";

const priorities: Record<Field, number> = {
  text: 12, partners: 11, reflection: 10, gain: 8, audience: 7, perspective: 7,
  teamScene: 7, scene: 5, person: 4, context: 5, voice: 5, origin: 4,
  round1: 4, round2: 4, round3: 4,
};
const fieldNames: Partial<Record<Field, string>> = {
  person: "対象", scene: "場面", gain: "望む変化", perspective: "別の視点", voice: "きっかけ",
  context: "きっかけ", audience: "会場の声", origin: "きっかけ", partners: "試したいこと",
  round1: "第1回", round2: "第2回", round3: "第3回", reflection: "気づき", teamScene: "班で出た場面・テーマ",
};
const closing: Record<string, string> = { "「": "」", "『": "』", "“": "”", "（": "）", "(": ")", "【": "】", "［": "］", "[": "]" };
const terminal = /[。！？!?]/u;
const question = /(?:[？?][」』”]?|だろうか|でしょうか|なのか|できるか|できないか|べきか|という問い)[。\s]*$/u;
const action = /(?:試し|試せ|つくり|作り|設け|設置|実験|実証|提案|連携|検証|実施|開催|取り組|したい|てみたい|てほしい|してはどう|にしたい|できたら|てみる|を開く|をつなぐ|を繋ぐ)/u;
const qualifying = /(?:ない|なかった|なくて|なくても|ません|ずに|すべきでなく|反対|慎重|未定|未確定|未検証|未確認|検討中|保留|見送|断念|とは限ら|かもしれ|限る|限り|条件|ただし|一方|しかし|けれど|とはいえ|むしろ|懸念|異論|場合にのみ|という問い|[？?])/u;
const explicitCaveat = /(?:ただし|しかし|一方|とはいえ|条件|反対|慎重|検討中|未定|未確認|保留|断念|見送|懸念|賛成できない|まだ.{0,14}(?:ない|ません)|わけでは|とは限ら|に限[るり]|場合にのみ)/u;
const dependsOnPrevious = /^(?:どちら(?:か|を|も)|これら|こうした|という(?:案|意見|点|声)|ただ[、し]|しかし|けれど|でも[、，]|一方|とはいえ|もっとも[、，]|その(?:案|点|ため|理由)|それ(?:には|について|を|は)|だから|そこで|この(?:案|考え|方法|場合)|むしろ)/u;
const filler = /^(?:どうも)?(?:ありがとう(?:ございます|ございました)?|よろしく(?:お願いします)?|なるほど|私(?:自身)?の(?:案|感想|意見)です|以上です|そう思います|いろいろ考えました|いろいろな意見が出ました|面白かったです)[。！!\s]*$/u;
const generic = /^(?:私[はも][、，]?\s*)?(?:賛成|反対|同感|共感)(?:です|しました|します|だ|ですか)?[。！!\s]*$/u;
const omit = "［中略］";
const japaneseWords = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("ja", { granularity: "word" }) : null;

// Split outside quoted speech and parentheses. An in-quote question can be the
// premise of someone's objection, so its punctuation is not a sentence break.
function segments(text: string, clauses = false): string[] {
  const parts: string[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (closing[ch]) stack.push(closing[ch]);
    else if (stack.length && ch === stack[stack.length - 1]) stack.pop();
    if (stack.length) continue;
    const period = ch === "." && (i === text.length - 1 || /\s/u.test(text[i + 1]));
    if (!(terminal.test(ch) || ch === "\n" || period || (clauses && /[、，,]/u.test(ch)))) continue;
    while (i + 1 < text.length && terminal.test(text[i + 1])) i++;
    const part = text.slice(start, i + 1).trim();
    if (part) parts.push(part);
    start = i + 1;
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function clean(text: string): string {
  return text.replace(/^[\s•●◯○・]+/u, "").replace(/^(?:[-*]|\d+[.)）])\s+/u, "")
    .replace(/[\t\n\r ]+/gu, " ").trim();
}
function keyOf(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[\s、。！？，!?,「」『』]/gu, "");
}
function terse(text: string): string {
  return text.replace(/^(?:私の(?:アイデア|案|意見)(?:として)?は?[、，]\s*|個人的には[、，]|私としては[、，]|まずはじめに[、，]|結論として[、，]|具体的には[、，])\s*/u, "")
    .replace(/(したい|てみたい|ほしい|欲しい)(?:と思っています|と思います)(?=[。！!]*$)/u, "$1")
    .replace(/[。．.]+$/u, "").trim() || text;
}
function fieldWeight(field: Field, entry: AnalysisInput, kind: PostKind): number {
  if (kind === "theme" && entry.round === 5 && field === "reflection") return 12;
  if (kind === "theme" && entry.round === 4 && field === "audience") return 10;
  return priorities[field];
}
function passages(entry: AnalysisInput, kind: PostKind): Passage[] {
  const result: Passage[] = [];
  const seen = new Set<string>();
  for (const field of Object.keys(priorities) as Field[]) {
    const value = field === "text" ? entry.enteredText ?? entry.text
      : field === "context" ? entry.context : entry.worksheet?.[field];
    if (!value?.trim()) continue;
    for (const [index, raw] of segments(value).entries()) {
      const text = clean(raw);
      const key = keyOf(text);
      const identity = key + (question.test(text) ? "?" : "");
      if (!key || seen.has(identity)) continue;
      seen.add(identity);
      let weight = fieldWeight(field, entry, kind);
      if (action.test(text) || question.test(text)) weight += 5;
      if (qualifying.test(text)) weight += 2;
      if (/\d/u.test(text) || /「[^」]+」/u.test(text)) weight++;
      if (text.length < 5 || generic.test(text)) weight -= 4;
      if (filler.test(text)) weight -= 30;
      if (dependsOnPrevious.test(text)) weight -= 4;
      result.push({ field, text, key, index, weight });
    }
  }
  return result;
}

function words(text: string): string[] {
  if (japaneseWords) return Array.from(japaneseWords.segment(text), part => part.segment);
  return Array.from(text);
}

// Retain the conclusion of long unpunctuated contributions. Omitted text is
// marked explicitly, with boundaries between words and no invented paraphrase.
function middleExcerpt(text: string, budget: number): string {
  // Quoted comments and numeric ranges are whole units. For longer comments the
  // opening and closing marks stay on opposite sides of an explicit omission.
  const pieces = text.split(/(「[^」]{1,34}」|『[^』]{1,34}』|[0-9０-９]+(?:[.,:：．，〜～–-][0-9０-９]+)*(?:万円|万|円|分|日間|日|時|人|回|席|台|％|%|m|km)?)/gu)
    .flatMap((part, index) => index % 2 ? [part] : words(part));
  function head(limit: number): string {
    let result = "";
    for (const piece of pieces) {
      if (result.length + piece.length > limit) break;
      result += piece;
    }
    return result.trimEnd();
  }
  function tail(limit: number): string {
    let result = "";
    for (let i = pieces.length - 1; i >= 0; i--) {
      if (result.length + pieces[i].length > limit) break;
      result = pieces[i] + result;
    }
    return result.trimStart();
  }
  const left = head(Math.floor((budget - omit.length) * .42));
  const right = tail(budget - left.length - omit.length);
  const gapStart = left.length, gapEnd = text.length - right.length;
  const gap = text.slice(gapStart, gapEnd);
  const reservation = /(?:したくない|できない|断念|反対|検討中|未定|見送|賛成できない|まだ.{0,10}(?:ない|ません)|わけでは(?:ない|ありません)|に限[るり]|という問い)/u.exec(gap);
  if (reservation && budget >= 68) {
    const target = gapStart + reservation.index;
    let pos = 0;
    let selected = "";
    for (const piece of pieces) {
      const end = pos + piece.length;
      if (end > target - 15 && pos < target + reservation[0].length + 5) selected += piece;
      pos = end;
    }
    const remaining = budget - selected.length - omit.length * 2;
    if (remaining >= 30) return head(Math.floor(remaining * .4)) + omit + selected + omit + tail(Math.floor(remaining * .6));
  }
  if (!left && !right) {
    const chars = Array.from(text);
    const start = Math.floor((budget - omit.length) * .42);
    return chars.slice(0, start).join("") + omit + chars.slice(-(budget - start - omit.length)).join("");
  }
  return left + omit + right;
}

function fit(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const parts = segments(text, true);
  if (parts.length <= 1) return middleExcerpt(text, budget);
  const last = parts.length - 1;
  const keep = new Set([0, last]);
  const render = () => {
    let previous = -1, result = "";
    for (const i of [...keep].sort((a, b) => a - b)) {
      if (i - previous > 1) result += omit;
      result += parts[i];
      previous = i;
    }
    return result;
  };
  if (render().length > budget) return middleExcerpt(text, budget);
  // Qualification before a comma matters more than a descriptive aside.
  const candidates = parts.map((part, i) => ({ i, priority: qualifying.test(part) || /[「『\d]/u.test(part) ? 1 : 0 }))
    .slice(1, -1).sort((a, b) => b.priority - a.priority || a.i - b.i);
  for (const { i } of candidates) {
    keep.add(i);
    if (render().length > budget) keep.delete(i);
  }
  return render();
}
function finish(text: string): string {
  return /[。！？!?．.]$|[。！？!?][」』”]$/u.test(text) ? text : text + "。";
}

function duplicate(a: Passage, b: Passage): boolean {
  if (question.test(a.text) !== question.test(b.text) || qualifying.test(a.text) !== qualifying.test(b.text)) return false;
  if (a.text.match(/[\d０-９]+/gu)?.join("|") !== b.text.match(/[\d０-９]+/gu)?.join("|")) return false;
  const [short, long] = a.key.length <= b.key.length ? [a.key, b.key] : [b.key, a.key];
  return short === long || (short.length >= 6 && short.length / long.length >= .76 && long.includes(short));
}

function supportRank(item: Passage, main: Passage): number {
  let score = item.weight;
  if (item.field === main.field && Math.abs(main.index - item.index) === 1) score += 2;
  if (item.field !== main.field) score += 2;
  if (item.field === "context" || item.field === "voice" || item.field === "gain") score += 6;
  if ((item.field === "context" || item.field === "voice") && /(?:から|ため|ので|た経験|たこと)[。！!]*$/u.test(item.text)) score += 5;
  if (item.field === "perspective" || item.field === "audience") score += 3;
  if (item.field === main.field && item.index === main.index + 1 && dependsOnPrevious.test(item.text)) score += 18;
  if (item.field === main.field && item.index === main.index - 1 && dependsOnPrevious.test(main.text)) score += 18;
  if (qualifying.test(item.text)) score += 3;
  if (explicitCaveat.test(item.text)) score += 12;
  return score;
}

function supportText(item: Passage): string {
  if (item.field === "person" || (item.field === "scene" && item.text.length < 24 && !terminal.test(item.text))) return fieldNames[item.field] + "は「" + item.text.replace(/[。]+$/u, "") + "」";
  if (item.field === "audience") return "会場の声として「" + item.text.replace(/[。]+$/u, "") + "」";
  if (item.field === "perspective") return "別の視点として「" + item.text.replace(/[。]+$/u, "") + "」";
  return item.text;
}

function shortDetail(item: Passage): boolean {
  return Boolean(fieldNames[item.field]) && item.text.length <= 26 && !/[？?「『]/u.test(item.text) && !explicitCaveat.test(item.text);
}

function makeTitle(text: string): string {
  if (text.length <= 52) return text;
  const chunks = segments(text, true);
  const last = terse(chunks[chunks.length - 1]);
  if (chunks.length > 1 && last.length >= 8 && last.length <= 48 &&
      !chunks.slice(0, -1).some(part => qualifying.test(part) || /(?:もし|なら|場合|あれば|ときだけ|[「『])/u.test(part)) &&
      !dependsOnPrevious.test(last) && (action.test(last) || question.test(last))) return last;
  // Use a complete topical phrase for a long title, without turning a question,
  // denial or tentative idea into a promise. The summary keeps the claims.
  const tokens = words(text);
  const nounParticles = /^(?:は|が|を|で|へ|から|まで|では|とは|にも|には|に|について|に関して|については|として|なら|ならば|という)$/u;
  let phrase = "", complete = false;
  for (const token of tokens) {
    if (nounParticles.test(token) || /[、，,。.!！?？「」『』：:［］]/u.test(token)) { complete = true; break; }
    if (phrase.length + token.length > 30) break;
    phrase += token;
  }
  phrase = phrase.trim().replace(/(?:について(?:は)?|に関して(?:は)?|として(?:は)?|をめぐって|をめぐる)$/u, "");
  if (complete && phrase.length >= 2 && phrase !== text && !/^(?:私|それ|このこと|自分|まず|もし|ただ|これ|一方|今日|今回)(?:$|[、，])/u.test(phrase.trim()) &&
      /[\p{L}\p{N}]/u.test(phrase)) {
    const ending = question.test(text) ? "をめぐる問い" : explicitCaveat.test(text) ? "をめぐる論点" : "についての考え";
    return phrase.trim() + ending;
  }
  return fit(text, 52);
}

export function analyzePost(entry: AnalysisInput, kind: PostKind): PostAnalysis {
  const headline = kind === "idea" ? entry.worksheet?.headline?.trim().slice(0, HEADLINE_LIMIT) : undefined;
  const items = passages(entry, kind);
  if (!items.length) return { title: headline || "", summary: "" };
  const ranked = [...items].sort((a, b) => b.weight - a.weight);
  const main = ranked[0];
  const options = items.filter(item => item !== main && !duplicate(item, main) && !filler.test(item.text))
    .sort((a, b) => supportRank(b, main) - supportRank(a, main));
  const support = options[0];
  const lead = main.field === "audience" || main.field === "perspective" ? supportText(main) : main.text;
  // A dependent reaction ("ただし…") shares its subject with the preceding
  // sentence. Keep their original order, including when the reaction ranks first.
  const together = support && main.field === support.field && support.index < main.index;
  const first = together ? supportText(support) : lead;
  const second = together ? lead : support && supportText(support);
  let summary = finish(fit(first, second ? 115 : 145));
  if (second && support) {
    const extra = options.find(item => item !== support && item.field !== support.field && !duplicate(item, support) && shortDetail(item));
    if (support.field !== main.field && extra && shortDetail(support) && first.length + support.text.length + extra.text.length < 108) {
      const describe = (item: Passage) => fieldNames[item.field] + "は「" + item.text.replace(/[。]+$/u, "") + "」";
      summary += finish(describe(support) + "、" + describe(extra));
    } else {
      summary += finish(fit(second, Math.max(58, 160 - summary.length)));
    }
  }
  const neighbor = support && support.field === main.field && Math.abs(support.index - main.index) === 1;
  let titleSource = terse(lead);
  if (neighbor && dependsOnPrevious.test(main.text) && together) {
    titleSource = finish(terse(support.text)) + terse(main.text);
  } else if (neighbor && !together && dependsOnPrevious.test(support.text) && explicitCaveat.test(support.text)) {
    titleSource = finish(terse(lead)) + terse(support.text);
  }
  return { title: headline || makeTitle(titleSource), summary };
}
