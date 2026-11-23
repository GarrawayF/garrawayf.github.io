"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, CornerDownRight, Search } from "lucide-react";
import { classifyKeyword, keywordCategories } from "./keyword-categories";
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
  searchHref?: (keyword: string) => string;
  onSearchLink?: (event: MouseEvent<HTMLElement>,keyword: string) => void;
};

const standardVisibleLimit = 12;
const projectionVisibleLimit = 24;
const teamOrder = ["A","B","C","D","E"];
const participatingTeams = (sources: readonly Source[]) => teamOrder.filter(t => sources.some(s => s.team === t));

export default function KeywordsPanel<T extends Source>({ ideas, onReply, presentation = false, searchHref, onSearchLink }: Props<T>) {
  const groups = useMemo(() => collectIdeaKeywords(ideas), [ideas]);
  const [all, setAll] = useState(false);
  const [page,setPage] = useState(0);
  const [projectionViewport,setProjectionViewport] = useState(false);
  const [pageFocus,setPageFocus]=useState(false);
  useEffect(() => {
    if(!presentation || typeof window.matchMedia!=="function")return;
    const mq=window.matchMedia("(min-width: 1000px) and (min-aspect-ratio: 4/3)");
    const sync=()=>setProjectionViewport(mq.matches);
    sync();mq.addEventListener("change",sync);
    return ()=>mq.removeEventListener("change",sync);
  },[presentation]);
  const [selectedKey, setSelectedKey] = useState("");
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchIdeaSources(ideas, query), [ideas, query]);
  const searching = Boolean(query.trim());
  const selected = groups.find(group => group.key === selectedKey);
  const hasSelection = Boolean(selected);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const restore = useRef("");
  const visibleLimit = presentation ? projectionVisibleLimit : standardVisibleLimit;
  const paged=presentation&&projectionViewport;
  const pageCount=Math.max(1,Math.ceil(groups.length/visibleLimit));
  const currentPage=Math.min(page,pageCount-1);
  const displayed = paged ? groups.slice(currentPage*visibleLimit,(currentPage+1)*visibleLimit) : all ? groups : groups.slice(0,visibleLimit);
  useEffect(()=>{
    if(!pageFocus)return;
    list.current?.querySelector<HTMLElement>(".kw-term")?.focus({preventScroll:true});
    setPageFocus(false);
  },[currentPage,pageFocus]);

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
    {!selected && <div className="kw-entry">
      <header className="kw-head"><div><p>KEYWORDS</p><h3>投稿に出てきた言葉</h3></div><span><b>{groups.length}</b>語</span></header>
      <label className="kw-search"><span>投稿の言葉を探す</span><span className="kw-search-field"><Search size={17} aria-hidden="true"/>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="気になる言葉を入力" /></span>
      </label>
    </div>}
    {selected || searching ? <>
      {selected && <button className="kw-back" type="button" onClick={() => {
        restore.current = selected.key;
        setSelectedKey("");
      }}><ArrowLeft size={15} aria-hidden="true" />キーワード一覧</button>}
      <div className="kw-detail-head">
        <h3 ref={heading} tabIndex={-1}>{selected ? selected.label : "検索結果"}</h3>
        <span aria-live="polite">{(selected?.sources || matches).length}件の投稿</span>
      </div>
      <div className="kw-sources">{(selected?.sources || matches).map(idea => <article className="kw-source" data-team={idea.team} key={idea.id}>
        <div className="kw-meta"><span>{idea.team}班</span><span>{roundLabels[idea.round]}</span>{idea.name && <span>{idea.name}</span>}</div>
        {((idea.enteredText ?? idea.text) || !idea.context) && <p className="kw-source-text">{worksheetHeadline(idea.enteredText ?? idea.text, idea.worksheet)}</p>}
        {idea.context && <p className="kw-context"><b>きっかけ・共感した理由</b>{idea.context}</p>}
        <WorksheetReadout mode="personal" values={idea.worksheet || {}} />
        <ReactionButtons targetType="idea" targetId={idea.id} />
        <PostComments targetType="idea" targetId={idea.id} tone="light"/>
        {onReply && <button className="kw-reply" type="button" onClick={() => onReply(idea)}><CornerDownRight size={14} aria-hidden="true" />この案から発想</button>}
      </article>)}</div>
    </> : <>
      <p className="kw-hint" data-empty={!groups.length || undefined}>{groups.length ? "言葉を選ぶと、その言葉が出た投稿を読めます。" : "読みたい投稿に含まれる言葉を検索できます。"}</p>
      {presentation && displayed.length > 0 && <div className="kw-colour-legend" aria-label="言葉の種類">
        <strong>言葉の種類</strong><ul>{keywordCategories.map(category => <li key={category.id} data-category={category.id}><i aria-hidden="true"/>{category.label}</li>)}</ul>
      </div>}
      {paged&&pageCount>1&&<nav className="kw-projection-nav" aria-label="キーワード表示範囲">
        <button type="button" disabled={currentPage===0} onClick={()=>{setPage(currentPage-1);setPageFocus(true);}}>前のページ</button>
        <span aria-live="polite">{currentPage+1} / {pageCount} ページ · {currentPage*visibleLimit+1}–{currentPage*visibleLimit+displayed.length}語</span>
        <button type="button" disabled={currentPage>=pageCount-1} onClick={()=>{setPage(currentPage+1);setPageFocus(true);}}>次のページ</button>
      </nav>}
      <div className="kw-list" ref={list}>{displayed.map(group => {
        const teams = participatingTeams(group.sources);
        const category = presentation ? classifyKeyword(group.label) : undefined;
        const Control = searchHref ? "a" : "button";
        return <Control className="kw-term" href={searchHref?.(group.label)} type={searchHref ? undefined : "button"} key={group.key} data-term={group.key}
          data-category={category?.id} data-team={!presentation && teams.length === 1 ? teams[0] : undefined}
          aria-label={group.label + "、" + group.sources.length + "件の投稿を表示" + (category ? "、" + category.label : "") + (teams.length ? "、" + teams.map(t=>t+"班").join("・") : "")}
          onClick={event => searchHref ? onSearchLink?.(event,group.key) : setSelectedKey(group.key)}>
          <b>{group.label}</b><span className="kw-count">{group.sources.length}<small>件</small></span>
          {(category || teams.length > 0) && <span className="kw-teams" aria-hidden="true">
            {category && <span className="kw-category-tag">{category.short}</span>}
            {teams.map(t=><i key={t} data-team={t}>{t}</i>)}</span>}
        </Control>;
      })}</div>
      {!paged && groups.length > visibleLimit && <button className="kw-more" type="button" aria-expanded={all} onClick={() => setAll(!all)}>
        {all ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        {all ? "表示を減らす" : "すべての" + groups.length + "語を見る"}
      </button>}
    </>}
  </section>;
}
