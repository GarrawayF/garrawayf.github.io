"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, CornerDownRight } from "lucide-react";
import { collectIdeaKeywords, searchIdeaSources } from "./idea-keywords";
import { WorksheetReadout } from "./worksheet-fields";
import { type Worksheet, worksheetHeadline } from "./worksheet";
import { PostComments } from "./post-comments";
import { ReactionButtons } from "./reactions";
import { roundLabels, type EventRound } from "./event-round";
import "./keywords-panel.css";

type Source = {
  id: string;
  text: string;
  enteredText?: string;
  context: string;
  team: string;
  round: EventRound;
  name: string;
  worksheet?: Worksheet;
};

type Props<T extends Source> = {
  ideas: readonly T[];
  onReply?: (idea: T) => void;
  presentation?: boolean;
};

const visibleLimit = 12;

export default function KeywordsPanel<T extends Source>({ ideas, onReply, presentation = false }: Props<T>) {
  const groups = useMemo(() => collectIdeaKeywords(ideas), [ideas]);
  const [all, setAll] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchIdeaSources(ideas, query), [ideas, query]);
  const searching = Boolean(query.trim());
  const selected = groups.find(group => group.key === selectedKey);
  const hasSelection = Boolean(selected);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const restore = useRef("");
  const displayed = all ? groups : groups.slice(0, visibleLimit);

  useEffect(() => {
    if (hasSelection) {
      heading.current?.focus({ preventScroll: true });
    } else if (restore.current) {
      const button = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        .find(el => el.dataset.term === restore.current);
      button?.focus({ preventScroll: true });
      restore.current = "";
    }
  }, [selectedKey, hasSelection]);

  if (!ideas.length) return <section className="kw-panel kw-empty">
    <h3>キーワードは投稿後に表示されます</h3>
    <p>案やきっかけ、記入した項目に出てきた言葉から、元の投稿を読めます。</p>
  </section>;

  return <section className={"kw-panel" + (presentation ? " kw-projection" : "")} aria-label="投稿のキーワード">
    {!selected && <label className="kw-search">投稿の言葉を探す
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="気になる言葉を入力" />
    </label>}
    {selected || searching ? <>
      {selected && <button className="kw-back" type="button" onClick={() => {
        restore.current = selected.key;
        setSelectedKey("");
      }}><ArrowLeft size={15} aria-hidden="true" />キーワード一覧</button>}
      <div className="kw-detail-head">
        <h3 ref={heading} tabIndex={-1}>{selected ? selected.label : "検索結果"}</h3>
        <span aria-live="polite">{(selected?.sources || matches).length}件の投稿</span>
      </div>
      <div className="kw-sources">{(selected?.sources || matches).map(idea => <article className="kw-source" key={idea.id}>
        <div className="kw-meta"><span>{idea.team}班</span><span>{roundLabels[idea.round]}</span>{idea.name && <span>{idea.name}</span>}</div>
        {((idea.enteredText ?? idea.text) || !idea.context) && <p className="kw-source-text">{worksheetHeadline(idea.enteredText ?? idea.text, idea.worksheet)}</p>}
        {idea.context && <p className="kw-context"><b>きっかけ・共感した理由</b>{idea.context}</p>}
        <WorksheetReadout mode="personal" values={idea.worksheet || {}} />
        <ReactionButtons targetType="idea" targetId={idea.id} />
        <PostComments targetType="idea" targetId={idea.id} tone={presentation ? "dark" : "light"}/>
        {onReply && <button className="kw-reply" type="button" onClick={() => onReply(idea)}><CornerDownRight size={14} aria-hidden="true" />この案から発想</button>}
      </article>)}</div>
    </> : <>
      <header className="kw-head"><h3>投稿に出てきた言葉</h3><span>{groups.length}語</span></header>
      <p className="kw-hint">{groups.length ? "言葉を選ぶと、その言葉が出た投稿を読めます。" : "読みたい投稿に含まれる言葉を検索できます。"}</p>
      <div className="kw-list" ref={list}>{displayed.map(group =>
        <button className="kw-term" type="button" key={group.key} data-term={group.key}
          aria-label={group.label + "、" + group.sources.length + "件の投稿を表示"}
          onClick={() => setSelectedKey(group.key)}>
          <b>{group.label}</b><span>{group.sources.length}<small>件</small></span>
        </button>)}</div>
      {groups.length > visibleLimit && <button className="kw-more" type="button" aria-expanded={all} onClick={() => setAll(!all)}>
        {all ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        {all ? "表示を減らす" : "すべての" + groups.length + "語を見る"}
      </button>}
    </>}
  </section>;
}
