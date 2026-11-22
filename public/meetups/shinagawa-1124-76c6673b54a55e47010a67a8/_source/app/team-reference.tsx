"use client";

import { useId, useMemo, useState } from "react";
import { BookOpen, Check, ChevronDown, Quote } from "lucide-react";
import { collectIdeaKeywords } from "./idea-keywords";
import MindMap from "./mind-map";
import { groupLabel, stageLabel, type MapGroup, type MapIdea, type MapTheme } from "./mind-map-model";
import { PostComments } from "./post-comments";
import { OriginalWording } from "./post-reading";
import { worksheetHeadline } from "./worksheet";
import "./team-reference.css";

const teams = ["A", "B", "C", "D", "E"] as const;
const tabs = { posts: "投稿・まとめ", words: "キーワード", map: "マインドマップ" } as const;
type Tab = keyof typeof tabs;
const tabKeys = Object.keys(tabs) as Tab[];
type Team = MapGroup | "";
type Round = MapTheme["round"];
type QuoteProps = {
  quotedIds: readonly string[];
  onToggleQuote: (id: string) => void;
  quotesLocked?: boolean;
};
export type TeamReferenceProps = QuoteProps & {
  team: Team;
  round?: Round;
  ideas: readonly MapIdea[];
  themes: readonly MapTheme[];
  ideasLoaded: boolean;
  themesLoaded: boolean;
  loadError?: boolean;
};

function byRoundAndTime(round?: Round) {
  return (left: MapIdea | MapTheme, right: MapIdea | MapTheme) =>
    Number(right.round === round) - Number(left.round === round) ||
    right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id);
}

function scopeLabel(scope: Team) {
  return scope === "" ? "全5班・会場全体" : groupLabel(scope);
}

function originalLine(row: MapIdea | MapTheme) {
  return worksheetHeadline(row.enteredText ?? row.text, row.worksheet, "context" in row ? row.context : "");
}

function ReferenceEntry({ row, quotedIds, onToggleQuote, quotesLocked }: QuoteProps & { row: MapIdea | MapTheme }) {
  const isIdea = "parentId" in row;
  const chosen = isIdea && quotedIds.includes(row.id);
  const locked = quotedIds.length >= 2 && !chosen;
  const text = originalLine(row);
  const mode = isIdea ? "personal" : row.team === "all" ? "plenary" : row.round === 5 ? "summary" : "work";
  const label = isIdea ? "自分の案" : row.team === "all" ? "会場全体の案" : "班の挑戦テーマ";
  return <article className={"tr-entry" + (chosen ? " tr-chosen" : "")}>
    <div className="tr-meta"><b>{groupLabel(row.team)}</b><span>{stageLabel(row.round)}</span>
      {isIdea && <span>{row.name || "匿名"}</span>}
    </div>
    <p className="tr-excerpt">{text}</p>
    <div className="tr-entry-actions">
      {isIdea && !quotesLocked && <button type="button" className="tr-quote" disabled={locked}
        aria-pressed={chosen} title={locked ? "すでに2件を引用中です" : undefined} onClick={() => onToggleQuote(row.id)}>
        {chosen ? <Check size={14} aria-hidden="true"/> : <Quote size={14} aria-hidden="true"/>}
        {chosen ? "引用中・外す" : "この案を引用"}
      </button>}
      {chosen && quotesLocked && <span className="tr-quoted"><Check size={14} aria-hidden="true"/>引用中</span>}
    </div>
    <details className="tr-original"><summary><ChevronDown size={14} aria-hidden="true"/>原文をすべて読む</summary>
      <OriginalWording entry={row} mode={mode} bodyLabel={label}/>
    </details>
    <PostComments targetType={isIdea ? "idea" : "theme"} targetId={row.id} tone="light"/>
  </article>;
}

function EntryList({ rows, ...quote }: QuoteProps & { rows: readonly (MapIdea | MapTheme)[] }) {
  const [count, setCount] = useState(6);
  return <div className="tr-list">
    {rows.slice(0, count).map(row => <ReferenceEntry key={row.id} row={row} {...quote}/>)}
    {rows.length > count && <button className="tr-more" type="button" onClick={() => setCount(value => value + 6)}>
      続きを見る（残り{rows.length - count}件）
    </button>}
  </div>;
}

function Empty({ loaded, error, text }: { loaded: boolean; error?: boolean; text: string }) {
  return <p className="tr-empty" role="status">{loaded ? text : error ? "読み込めませんでした。接続が戻ると更新します。" : "読み込み中…"}</p>;
}

function ReferenceWords({ rows, loaded, loadError, ...quote }: QuoteProps & {
  rows: readonly (MapIdea | MapTheme)[]; loaded: boolean; loadError?: boolean;
}) {
  const groups = useMemo(() => collectIdeaKeywords(rows), [rows]);
  const [key, setKey] = useState("");
  const [more, setMore] = useState(false);
  const selected = groups.find(group => group.key === key);
  if (!groups.length) return <Empty loaded={loaded} error={loadError}
    text={rows.length ? "この範囲の投稿やまとめからキーワードはまだ抽出されていません。" : "投稿やまとめが集まると、ここにキーワードが表示されます。"}/>;
  return <div className="tr-words">
    <div className="tr-word-list" role="group" aria-label="元の投稿に出てきた言葉">
      {(more ? groups : groups.slice(0, 12)).map(word =>
        <button key={word.key} aria-pressed={selected?.key === word.key} type="button" onClick={() => setKey(word.key === selected?.key ? "" : word.key)}>
          {word.label}<small>{word.sources.length}件</small>
        </button>)}
    </div>
    {groups.length > 12 && <button className="tr-more" type="button" aria-expanded={more}
      onClick={() => setMore(value => !value)}>{more ? "表示する言葉を減らす" : "すべての言葉を見る（" + groups.length + "語）"}</button>}
    {selected && <div className="tr-word-results"><h3>「{selected.label}」を含む投稿・まとめ <span>{selected.sources.length}件</span></h3>
      <EntryList key={selected.key} rows={selected.sources} {...quote}/>
    </div>}
  </div>;
}

function ReferencePanel({ team, round, ideas, themes, ideasLoaded, themesLoaded, loadError, ...quote }: TeamReferenceProps) {
  const [scope, setScope] = useState<Team>(team === "all" ? "" : team);
  const [tab, setTab] = useState<Tab>("posts");
  const heading = useId();
  const panel = useId();
  const orderedIdeas = useMemo(() => ideas.filter(idea => !scope || idea.team === scope).sort(byRoundAndTime(round)), [ideas, scope, round]);
  const orderedThemes = useMemo(() => themes.filter(theme => !scope || theme.team === scope).sort(byRoundAndTime(round)), [themes, scope, round]);
  const wordSources = useMemo(() => tab === "words" ? [...orderedIdeas, ...orderedThemes].sort(byRoundAndTime(round)) : [], [orderedIdeas, orderedThemes, round, tab]);
  const listKey = (scope || "all-groups") + "/" + round;
  return <section className="team-reference" aria-labelledby={heading}>
    <header className="tr-header">
      <h2 id={heading}><BookOpen size={20} aria-hidden="true"/>議論を振り返る</h2>
      <label className="tr-scope">参考にする範囲
        <select value={scope} onChange={event => setScope(event.target.value as Team)}>
          <option value="">全5班・会場全体</option>
          {teams.map(group => <option key={group} value={group}>{group}班</option>)}
          <option value="all">会場全体の案のみ</option>
        </select>
      </label>
    </header>
    <div className="tr-tabs" role="tablist" aria-label="参考資料の見方">
      {tabKeys.map((item, index) => <button key={item} type="button" role="tab" id={panel + "-" + item}
        tabIndex={tab === item ? 0 : -1} aria-selected={tab === item} aria-controls={panel} onClick={() => setTab(item)}
        onKeyDown={event => {
          const target = { ArrowRight: (index + 1) % tabKeys.length, ArrowLeft: (index + tabKeys.length - 1) % tabKeys.length, Home: 0, End: tabKeys.length - 1 }[event.key];
          if (target === undefined) return;
          event.preventDefault();
          setTab(tabKeys[target]);
          document.getElementById(panel + "-" + tabKeys[target])?.focus();
        }}>{tabs[item]}</button>)}
    </div>
    <div className="tr-content" id={panel} role="tabpanel" aria-labelledby={panel + "-" + tab}>
      {loadError && (ideasLoaded || themesLoaded) && <p className="tr-sync" role="status">接続を確認中です。取得済みの内容を表示しています。</p>}
      {tab === "posts" && <>
        <div className="tr-reading-meta"><span>{scopeLabel(scope)}{round ? " · " + stageLabel(round) + "を先に表示" : ""}</span>
          {!quote.quotesLocked && <span aria-live="polite">引用 {quote.quotedIds.length}/2件</span>}
        </div>
        <details className="tr-summaries" key={listKey} open={scope === "all" || (ideasLoaded && !orderedIdeas.length) || undefined}>
          <summary><ChevronDown size={15} aria-hidden="true"/>{scope === "all" ? "会場全体の案" : scope === "" ? "班のまとめ・会場全体の案" : "これまでの班のまとめ"}
            {themesLoaded && <span>{orderedThemes.length}件</span>}</summary>
          {orderedThemes.length ? <EntryList rows={orderedThemes} {...quote}/> : <Empty loaded={themesLoaded} error={loadError} text="この範囲にはまだまとめや案がありません。"/>}
        </details>
        {scope !== "all" && <div className="tr-posts"><h3>個人の投稿 {ideasLoaded && <span>{orderedIdeas.length}件</span>}</h3>
          {orderedIdeas.length ? <EntryList key={listKey} rows={orderedIdeas} {...quote}/> :
            <Empty loaded={ideasLoaded} error={loadError} text="この範囲にはまだ個人の投稿がありません。"/>}
        </div>}
      </>}
      {tab === "words" && <ReferenceWords key={listKey} rows={wordSources} loaded={ideasLoaded && themesLoaded} loadError={loadError} {...quote}/>}
      {tab === "map" && <MindMap key={scope} ideas={ideas} themes={themes}
        teamFilter={scope} roundFilter={0} hasLoaded={ideasLoaded} themesLoaded={themesLoaded} loadError={loadError}
        onCite={quote.quotesLocked ? undefined : idea => quote.onToggleQuote(idea.id)} citedIds={quote.quotedIds}/>}
    </div>
  </section>;
}

export default function TeamReference(props: TeamReferenceProps) {
  return <ReferencePanel key={props.team} {...props}/>;
}
