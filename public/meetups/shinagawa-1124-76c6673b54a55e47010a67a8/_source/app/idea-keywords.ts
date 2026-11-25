import { cleanWorksheet, type Worksheet } from "./worksheet";

export type KeywordSource = {
  id: string;
  text: string;
  context?: string;
  worksheet?: Worksheet;
};

export type IdeaKeyword<T extends KeywordSource> = {
  label: string;
  key: string;
  sources: T[];
};

const ignore = new Set((
  "こと もの ところ ため たち など などの こちら そこ ここ そう こう どう こういう これ それ " +
  "その この どの どんな いろいろ もっと ちょっと すごく たくさん よく すべて さらに " +
  "ます です まし でし たい たら たり ながら みたい したい しよう した して する なる なっ " +
  "ある あり いる いまし いて いく られる れる せる ませ ない って だっ ので ても でも から まで " +
  "として という について とき でき できる できれ できた やっ みる みんな わたし 私 " +
  "思い 思う 試し 試す 作り 作る 感じ 感じる 良い いい よい よう ほしい 欲しい 嬉しい " +
  "気軽 必要 活用 まず とても また ぜひ 例えば 一緒 自分 自分たち 何 誰 やすい やすく にくい " +
  "しく われ いっ せず では なん たまま しっかり ちゃんと なに そして けど けれど だけ " +
  "the a an and or at in on for to of is be this that with we i"
).split(/\s+/u));

const singleNouns = new Set(Array.from("人駅街店道町村庭橋川海空港坂雨雪風水光音森木花草山家本旅席声食絵歌夢車船猫犬島米茶宿棚靴傘窓床壁竹畑朝昼夕夜春夏秋冬体心輪球景"));
// Intl.Segmenter has no part-of-speech tags. Isolated kana fragments can span
// inflection boundaries (気づいたこと → いたこ), so only keep clear kana nouns.
const kanaNouns = new Set((
  "おすすめ まち ひと ひとり こども おとな みち つながり にぎわい きっかけ くらし すまい いこい " +
  "であい ふれあい わくわく ゆとり いばしょ たまりば やすみ おやすみ ひるやすみ あそび あそびば " +
  "しごと おしごと おしゃべり しゃべりば まなび みまもり まつり おまつり ひろば きっぷ きっさてん " +
  "ごはん おにぎり おやつ べんとう おべんとう やさい くだもの みず おみやげ ぬくもり " +
  "ねこ いぬ たぬき どうぶつ はな みどり のりもの しおり えほん みなと みらい ふるさと"
).split(/\s+/u));
const nominalEnding = new Set("出会い 触れ合い 助け合い 分かち合い 語り合い にぎわい 賑わい 憩い 願い 装い 住まい 商い 扱い".split(" "));
const suffixes = new Set("者 向け 街 駅 所 場 館 会 口 前 先 側 内 外 中 階 券 化 型 機 台 屋 店 づくり 作り つくり 乗り場 乗場".split(" "));

const segmenter = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("ja", { granularity: "word" })
  : null;
const collator = new Intl.Collator("ja", { sensitivity: "base", numeric: true });
const han = /\p{Script=Han}/u;
const kana = /^[\p{Script=Katakana}ー]+$/u;
const hiragana = /^\p{Script=Hiragana}+$/u;
const roman = /^[A-Za-z0-9]+(?:[-’'][A-Za-z0-9]+)*$/u;

type Piece = { text: string; start: number; end: number; word: boolean };

function pieces(input: string): Piece[] {
  // Keep the original spelling for presentation. Older engines still retain
  // contiguous script runs, including long katakana and hyphenated words.
  if (!segmenter) {
    return Array.from(input.matchAll(/[A-Za-z0-9]+(?:[-’'][A-Za-z0-9]+)*|[\p{Script=Katakana}ー]+|\p{Script=Han}+|\p{Script=Hiragana}+|[^\s]/gu), m => ({
      text: m[0], start: m.index!, end: m.index! + m[0].length, word: /[\p{L}\p{N}]/u.test(m[0]),
    }));
  }
  const parts = Array.from(segmenter.segment(input), x => ({
    text: x.segment, start: x.index, end: x.index + x.segment.length, word: Boolean(x.isWordLike),
  }));
  const grouped: Piece[] = [];
  for (let i = 0; i < parts.length; i++) {
    const piece = { ...parts[i] };
    if (kana.test(piece.text)) {
      while (i + 1 < parts.length && kana.test(parts[i + 1].text)) {
        piece.end = parts[++i].end;
      }
    } else if (roman.test(piece.text)) {
      while (i + 2 < parts.length && /^[-’']$/u.test(parts[i + 1].text) && roman.test(parts[i + 2].text)) {
        i += 2;
        piece.end = parts[i].end;
      }
    }
    piece.text = input.slice(piece.start, piece.end);
    grouped.push(piece);
  }
  return grouped;
}

function isLexical(piece: Piece, next: string): boolean {
  const word = piece.text;
  if (!piece.word || ignore.has(word.toLowerCase()) || /^[\p{N}]+$/u.test(word)) return false;
  if (kana.test(word)) return Array.from(word).length > 1;
  if (roman.test(word)) return word.length > 1;
  if (han.test(word)) {
    if (word === "車いす" || nominalEnding.has(word)) return true;
    if (Array.from(word).length === 1) return singleNouns.has(word);
    // Japanese dictionaries split off auxiliaries from inflected verbs.
    if (/^(?:たい|ます|まし|ながら|られ|やすい|にくい|たら)$/u.test(next)) return false;
    if (/[るうくぐすつぬぶむい]$/u.test(word) || /[をにへ]$/u.test(word)) return false;
    return true;
  }
  if (hiragana.test(word)) {
    return kanaNouns.has(word);
  }
  return false;
}

function compoundPart(term: string) {
  return /^[\p{Script=Han}々]+$/u.test(term) || kana.test(term) || roman.test(term) ||
    /^(?:まち|ひと|ひとり|やすみ|子育て|空き|手作り|帰り|乗り換え|乗換え)$/u.test(term);
}

export function extractIdeaKeywords(input: string): string[] {
  const value = input.replace(/https?:\/\/[^\s]+/giu, " ");
  const words = pieces(value);
  const found = new Map<string, string>();
  let current = "";
  let canJoin = false;
  let end = -1;
  function flush() {
    if (current) {
      const key = current.normalize("NFKC").toLowerCase();
      if (!found.has(key)) found.set(key, current);
    }
    current = "";
    canJoin = false;
  }
  for (let i = 0; i < words.length; i++) {
    let { text } = words[i];
    const start = words[i].start;
    if (words[i + 1]?.text === "の" && words[i + 2]?.text === "日" && isLexical(words[i], "の")) {
      i += 2;
      text = value.slice(start, words[i].end);
      flush();
      current = text;
      flush();
      continue;
    }
    const adjacent = Boolean(current) && start === end;
    const suffix = adjacent && suffixes.has(text);
    if (!suffix && !isLexical(words[i], words[i + 1]?.text ?? "")) {
      flush();
      continue;
    }
    const joinable = compoundPart(text);
    if (!adjacent || !(suffix || (canJoin && joinable)) || current.length + text.length > 24) flush();
    current += text;
    end = words[i].end;
    canJoin = joinable || suffix;
  }
  flush();
  return [...found.values()];
}

function getSourceText(idea: KeywordSource) {
  const content = Object.entries(cleanWorksheet(idea.worksheet))
    .filter(([key]) => key !== "recorder" && key !== "headline")
    .map(([, value]) => value);
  return [idea.text, idea.context, ...content].filter(Boolean).join("\n");
}

export function searchIdeaSources<T extends KeywordSource>(ideas: readonly T[], query: string): T[] {
  const terms = query.trim().normalize("NFKC").toLowerCase().split(/\s+/u).filter(Boolean);
  if (!terms.length) return [];
  return ideas.filter(idea => {
    const text = getSourceText(idea).normalize("NFKC").toLowerCase();
    return terms.every(term => text.includes(term));
  });
}

const extracted = new WeakMap<KeywordSource, { source: string; labels: string[] }>();

export function collectIdeaKeywords<T extends KeywordSource>(ideas: readonly T[]): IdeaKeyword<T>[] {
  const groups = new Map<string, IdeaKeyword<T>>();
  const documents = new Map<string, { idea: T; terms: string[] }>();
  for (const idea of ideas) {
    if (documents.has(idea.id)) continue;
    const source = getSourceText(idea);
    let memo = extracted.get(idea);
    if (!memo || memo.source !== source) {
      memo = { source, labels: extractIdeaKeywords(source) };
      extracted.set(idea, memo);
    }
    const terms: string[] = [];
    for (const label of memo.labels) {
      const key = label.normalize("NFKC").toLowerCase();
      terms.push(key);
      if (!groups.has(key)) groups.set(key, { key, label, sources: [] });
    }
    documents.set(idea.id, { idea, terms });
  }
  for (const { idea, terms } of documents.values()) {
    const matched = new Set(terms);
    // A word used on its own can also occur inside another idea's compound,
    // e.g. ベンチ in 木製ベンチ. Avoid treating AI as a word inside "train".
    for (const term of terms) {
      for (let start = 0; start < term.length - 1; start++) {
        if (start && /[a-z0-9]/.test(term[start - 1]) && /[a-z0-9]/.test(term[start])) continue;
        for (let end = start + 2; end <= Math.min(term.length, start + 24); end++) {
          const candidate = term.slice(start, end);
          if (end < term.length && /[a-z0-9]/.test(term[end - 1]) && /[a-z0-9]/.test(term[end])) continue;
          if (groups.has(candidate)) matched.add(candidate);
        }
      }
    }
    for (const key of matched) groups.get(key)!.sources.push(idea);
  }
  return [...groups.values()].sort((a,b) =>
    b.sources.length - a.sources.length || collator.compare(a.label, b.label));
}
