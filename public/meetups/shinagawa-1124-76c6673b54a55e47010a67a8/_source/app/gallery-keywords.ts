import { extractIdeaKeywords } from "./idea-keywords";
import type { MapRecord } from "./mind-map-model";
import { WORKSHEET_KEYS } from "./worksheet";

type Choice = { label: string; key: string; score: number };
const keyOf = (text: string) => text.normalize("NFKC").toLocaleLowerCase("ja").replace(/\s+/gu, " ").trim();
const generic = /^(?:品川(?:区|駅)?|駅前|駅|まち|街|町|人|みんな|場所|店|案|アイデア|テーマ|提案|参加者|自分|時間|今回|理由|共感|賛成|反対|きっかけ|テスト|体験|意見|実験|仕組み|結果|利用|一緒|比較|確認|個人|試行|必要|方法|当番|大切|候補|賛成です|反対です)$/u;
const stance = /(?:反対(?!側|方向|車線|岸|票|色|か賛成)|賛成できな|賛成しない|賛成とは.{0,4}言えない|したくない|たくなかった|しないで|ないでほしい|不要|やめたい|やめて|やめる|禁止|増やさない|置かない|作らない|置きたくない)/u;
const dissent = /(?:反対(?!側|方向|車線|岸|票|色|か賛成)|賛成できない|賛成しない)/u;
const quantity = /[0-9０-９]+(?:[.．:：時][0-9０-９]+)?\s*(?:分|秒|時間|時|日|台|席|枚|人|円|か所|箇所|歩|メートル|[mkｍｋ]m?|％|%)/iu;
const awkwardEnd = /(?:って|のに|ので|なら|より|ように|例えば|けれど|けれども|ければ|たいけど|だけど|だったら|ながら|くらい|ぐらい|たとき|ために|を|には|では|にも|の|が|は|と|に|で|も|や|へ|し|かを|ても|たり|えて|めて|けて|られ|して|なく|ると|すれば|れば)$/u;
const awkwardStart = /^(?:の|を|に(?:よる|ある)|だから|しかし|けれど|そうした|こうした|そこで|それで|なく|なければ|られる|という|との|には|から|だけ|たまま|よい|よく|すると|など|そのうち|どうしても)/u;
const without = /(?:会話なし|なしで|[させらわま]ず|たくない|反対|不要|禁止)/u;
const nounSuffix = /^(?:所|者|名|口|会|券|版|図|街|屋|場|カード|ルート|マップ|体験|交流|紹介)$/u;
const cut = new Set(["は", "を", "に", "には", "で", "では", "が", "も", "から", "と", "にも", "へ", "なら"]);
const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("ja", { granularity: "word" }) : null;
const endings = /(?:案内|カード|マップ|通路|通り|目印|手紙|写真|地図|交換会|引換券|小皿|目線|入口|出口|出入口|席|場所|寄り道|休憩所|合図|時刻|時間|名前|案内板|紹介|一品|訪問|目安|行き方|実験|休憩|散歩|遠回り|背もたれ|歩幅|二択|札|券)$/u;
const wholeNoun = /^[\p{Script=Han}々\p{Script=Katakana}ーA-Za-z0-9０-９]+$/u;

function stripConjunction(label: string) {
  if (!label.startsWith("かつ") || /^かつ(?:お|て|ら|丼|重|カレー|サンド|煮|揚げ|鍋|定食|弁当)/u.test(label)) return label;
  const first = segmenter?.segment(label)[Symbol.iterator]().next().value?.segment;
  if (first === "かつ" || /^かつ[\s、，,\p{Script=Han}]/u.test(label)) return label.slice(2).replace(/^[\s、，,]+/u, "");
  return label;
}

function sources(record: MapRecord) {
  const row = record.row;
  const values: [string, number][] = [[row.enteredText ?? row.text, 10]];
  if (record.kind === "idea" && record.row.context) values.push([record.row.context, 4]);
  for (const field of WORKSHEET_KEYS) {
    if (field === "recorder") continue;
    const value = row.worksheet?.[field];
    if (value) values.push([value, field === "partners" || field === "gain" || field === "reflection" ? 5 : 2]);
  }
  return values.filter(([text]) => text?.trim());
}

function choices(parts: ReturnType<typeof sources>): Choice[] {
  const found = new Map<string, Choice>();
  for (const [source, weight] of parts) {
    // Repeated meaningful nouns can connect a proposal to an example named later in the same entry.
    const repeated = new Set<string>();
    for (const noun of extractIdeaKeywords(source)) {
      if (noun.length >= 3 && !generic.test(noun) && source.indexOf(noun, source.indexOf(noun) + noun.length) !== -1) repeated.add(noun);
    }
    const add = (raw: string, rank: number) => {
      const unwrapped = raw.trim().replace(/^(?:「(.+)」|『(.+)』|（(.+)）|\((.+)\))$/u, (_, a, b, c, d) => a ?? b ?? c ?? d).trim();
      const label = stripConjunction(unwrapped);
      const len = Array.from(label).length;
      if (!source.includes(label) || !len || len > 36 || /[\n\r。]/u.test(label) || awkwardEnd.test(label) || awkwardStart.test(label)) return;
      if (/^[々\s\p{P}\p{S}]+$/u.test(label) || /(?:は|が)[\p{Script=Han}々\p{Script=Katakana}ー]{1,6}$/u.test(label)) return;
      const key = keyOf(label);
      const score = rank + weight - Math.max(0, len - 10) * 2.2 - Math.max(0, 4 - len) * 4 -
        (generic.test(label) ? 36 : 0) + (quantity.test(label) ? 10 : 0) + (without.test(label) ? 10 : 0) +
        ([...repeated].some(noun => label.includes(noun)) ? 4 : 0);
      if ((found.get(key)?.score ?? -Infinity) < score) found.set(key, { label, key, score });
    };
    const clean = source.replace(/https?:\/\/[^\s]+/giu, " ").trim();
    if (!clean) continue;
    // Japanese often joins an acronym directly to a loanword to name a service or tool.
    for (const match of clean.matchAll(/(?<![A-Za-zＡ-Ｚａ-ｚ0-9０-９])[A-ZＡ-Ｚ][A-ZＡ-Ｚ0-9０-９]{1,7}[ァ-ヶー]{2,24}/gu)) {
      add(match[0], weight >= 10 ? 58 : 45);
    }
    for (const match of clean.matchAll(/[「『]([^「」『』\n]{2,32})[」』]/gu)) {
      const after = clean.slice(match.index + match[0].length);
      if (!/^(?:に|とは?|には|するのは)?(?:反対|賛成できない|不要)/u.test(after)) {
        add(match[1], /^(?:に加えて|だけでなく)/u.test(after) ? 38 : (weight >= 10 ? 54 : 43));
      }
    }
    const paragraphs = clean.match(/[^。！？!?\n]+[！？!?]?/gu) || [];
    for (const [sentenceNo, span] of paragraphs.entries()) {
      const parts = span.split(/[、，,；;]/u);
      for (const [partNo, raw] of parts.entries()) {
        const part = raw.trim();
        if (!part) continue;
        const early = sentenceNo === 0 && partNo === 0 ? 3 : 0;
        // A qualifier belongs to the original clause. A quotation alone can reverse the speaker's stance.
        if (stance.test(part)) {
          add(part, 70 + early);
          const qualified = part.match(/(?:案に(?:は|も)?|試みには|計画には|提案には|これには)?(?:反対(?!側|方向|車線|岸|票|色|か賛成)(?:では(?:ない|ありません)|じゃない)?|賛成できない|賛成しない|不要)(?:です)?/u);
          if (qualified && !generic.test(qualified[0])) add(qualified[0], 58);
          const withoutLead = part.replace(/^(?:という|そこで|しかし|ただし)/u, "");
          if (withoutLead !== part) add(withoutLead, 70);
        }
        const standalone = partNo === parts.length - 1;
        if (!/[「」『』]/u.test(part)) {
          add(part, (standalone ? 38 : 25) + early + (part.length <= 13 ? 4 : 0));
        }
        const terms = new Set(extractIdeaKeywords(part));
        const longestTerms = [...terms].sort((a,b) => b.length - a.length);
        const tokens = segmenter ? [...segmenter.segment(part)].map(s => ({ word:s.segment, at:s.index })) :
          [...part.matchAll(/[\p{Script=Han}々]+|[\p{Script=Katakana}ー]+|[A-Za-z0-9]+|[\p{Script=Hiragana}]+|./gu)]
            .map(m => ({ word:m[0], at:m.index }));
        let start = 0;
        for (let i = 0; i < tokens.length; i++) {
          const { word, at } = tokens[i];
          const prior = part.slice(start, at);
          if (cut.has(word) || /^[「」『』]$/u.test(word)) {
            if (quantity.test(prior)) add(prior, 42);
            if ((word === "を" || word === "も") && prior.length <= 18 && endings.test(prior)) add(prior, 44);
            start = at + word.length;
            continue;
          }
          const previous = tokens[i-1];
          if (nounSuffix.test(word) && previous && terms.has(previous.word)) {
            add(part.slice(previous.at, at + word.length), 43 + early);
          }
          if (!terms.has(word) && !endings.test(word)) continue;
          if (tokens[i+1] && nounSuffix.test(tokens[i+1].word)) continue;
          if (word.length >= 2) add(word, wholeNoun.test(word) ? 19 : 17);
          const leading = part.slice(0, at + word.length);
          if (leading.length <= 17 && endings.test(word) && /(?:が|なしで|さず|せず)[^「」]*(?:る|た|い|す|く)[\p{Script=Han}々]+$/u.test(leading)) {
            add(leading, 47);
          }
          const prefix = part.slice(start, at + word.length);
          if (prefix.length <= 19 && prefix.length > word.length && !/[「」『』]/u.test(prefix)) {
            add(prefix, (endings.test(word) ? 34 : 27) + early + (start === 0 ? 2 : 0));
          }
          // Adjacent nouns can cross a script boundary, e.g. 寄り道 + カード.
          if (previous && terms.has(previous.word) && previous.at + previous.word.length === at) {
            add(part.slice(previous.at, at + word.length), 38 + early);
          }
        }
        // Recover complete nominal phrases split by the dictionary, e.g. 小皿の引換券.
        for (const left of terms) {
          const offset = part.indexOf(left);
          if (offset < 0) continue;
          add(left, (endings.test(left) ? 24 : 19) + early);
          const tail = part.slice(offset + left.length);
          for (const join of ["の", "だけの", "への", "からの", ""]) {
            if (!tail.startsWith(join)) continue;
            const rest = tail.slice(join.length);
            const right = longestTerms.find(term => rest.startsWith(term));
            if (!right || (left.length === 1 && right.length === 1)) continue;
            add(left + join + right, 39 + (endings.test(right) ? 4 : 0));
          }
        }
      }
    }
    if (!found.size) {
      // Keep the participant's actual spelling even for a one-word or unusual-language post.
      const words = clean.split(/[\s、。！？!?]/u).filter(Boolean);
      const fallback = words.find(word => word.length <= 20) || words[0] || clean;
      const label = Array.from(fallback).slice(0, 28).join("");
      found.set(keyOf(label), { label, key: keyOf(label), score: -60 });
    }
  }
  const options = [...found.values()];
  // If the author explicitly dissents, a positive quote from that text is unsafe as a headline.
  const explicit = parts.find(([, weight]) => weight === 10)?.[0];
  if (explicit && dissent.test(explicit)) {
    // Multiple voices can disagree in the same post; prefer the author's own explicit sentence.
    const personal = explicit.match(/(?:私は|僕は|わたしは|自分は)[^。！？!?\n、]{1,32}(?=[。！？!?\n、]|$)/u)?.[0];
    if (personal && /賛成|反対/u.test(personal)) return [{ label: personal, key: keyOf(personal), score: 100 }];
    const qualified = options.filter(choice => dissent.test(choice.label) && !generic.test(choice.label) && explicit.includes(choice.label));
    if (qualified.length) return qualified;
  }
  return options;
}

/** Excerpts stay verbatim and stable across sort/filter changes. Call with the full room. */
export function selectGalleryKeywords(records: readonly MapRecord[]): ReadonlyMap<string, string> {
  const docs = records.map(record => {
    const parts = sources(record);
    return { key: record.key, content: JSON.stringify(parts), options: choices(parts) };
  });
  const frequency = new Map<string, number>();
  for (const { options } of docs) for (const option of options) frequency.set(option.key, (frequency.get(option.key) || 0) + 1);
  const count = docs.length;
  const compare = (a: Choice, b: Choice) => b.score - a.score || a.key.localeCompare(b.key, "ja");
  for (const doc of docs) {
    for (const option of doc.options) option.score += 2.6 * Math.log2((count + 1) / (1 + frequency.get(option.key)!));
    doc.options.sort(compare);
  }
  // Give a scarce, clear choice to its strongest match, independent of server ordering.
  const confidence = (options: Choice[]) => options.length ? options[0].score - (options[1]?.score ?? -100) : -Infinity;
  docs.sort((a,b) => confidence(b.options) - confidence(a.options) || a.key.localeCompare(b.key));
  const labels = new Map<string,string>();
  const used = new Map<string,number>();
  const identical = new Map<string,string>();
  for (const { key, content, options } of docs) {
    const existing = identical.get(content);
    if (existing) { labels.set(key, existing); continue; }
    let best: Choice | undefined, bestScore = -Infinity;
    for (const option of options) {
      const score = option.score - 8 * (used.get(option.key) || 0);
      if (score > bestScore) { best = option; bestScore = score; }
    }
    if (best) {
      labels.set(key, best.label);
      identical.set(content, best.label);
      used.set(best.key, (used.get(best.key) || 0) + 1);
    }
  }
  return labels;
}
