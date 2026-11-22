"use client";

import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CornerDownRight, Pencil, Search, X } from "lucide-react";
import { pageLink } from "./board-room";
import { selectGalleryKeywords } from "./gallery-keywords";
import { IdeaVisualButton } from "./idea-visual";
import { groupLabel, kindLabel, stageLabel, type MapIdea, type MapRecord, type MapTheme } from "./mind-map-model";
import { analyzePost } from "./post-analysis";
import { PostComments } from "./post-comments";
import PostReading from "./post-reading";
import { ReactionButtons, useReactions } from "./reactions";
import { selectScenePhoto } from "./scene-photo";
import "./presentation-gallery.css";

type KindFilter = "all" | "idea" | "team" | "plenary";
type Target = { kind: "idea" | "theme"; id: string };
type RouteTarget = { kind?: Target["kind"]; id: string };
type GalleryProps = {
  ideas: readonly MapIdea[]; themes: readonly MapTheme[]; allIdeas?: readonly MapIdea[]; allThemes?: readonly MapTheme[];
  loaded: boolean; loadError?: boolean; source?: string; onSelect?: (target: Target | null) => void;
};
type Row = MapRecord & { category: Exclude<KindFilter, "all">; haystack: string };
const choices: [KindFilter, string][] = [["all","すべて"], ["idea","個人案"], ["team","班のまとめ"], ["plenary","全体の案"]];
const teamColors: Record<string, string> = { A:"#a8c481", B:"#edba76", C:"#93c6d7", D:"#f1a6bd", E:"#bea9e0", all:"#f9dfeb" };
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja-JP");
const wording = (value: string) => normalize(value).replace(/[\s\p{P}]/gu, "");

function routeTarget(url: URL): RouteTarget | null {
  const id = url.searchParams.get("idea");
  if (id) return { kind:"idea", id };
  if (url.hash.startsWith("#theme-") && url.hash.length > 7) return { kind:"theme", id:url.hash.slice(7) };
  const thread = url.searchParams.get("thread");
  return thread ? { id:thread } : null;
}

function updateAddress(item?: Row) {
  const url = new URL(window.location.href);
  url.searchParams.delete("idea"); url.searchParams.delete("thread");
  if (url.hash.startsWith("#theme-")) url.hash = "";
  if (item) {
    url.searchParams.set("view", "screen");
    if (item.kind === "theme") url.hash = "theme-" + item.row.id;
    else url.searchParams.set("idea", item.row.id);
  }
  if (url.href !== window.location.href) {
    try { window.history.replaceState(window.history.state, "", url.href); } catch { /* Local-file history may be restricted. */ }
  }
}

function makeRows(ideas: readonly MapIdea[], themes: readonly MapTheme[]): Row[] {
  const entries = [...ideas.map(row => ({ kind:"idea" as const, row })), ...themes.map(row => ({ kind:"theme" as const, row }))];
  return entries.map(item => {
    const { row, kind } = item;
    const title = row.analysis?.title?.trim() || analyzePost(row, kind).title;
    const terms = [title, row.analysis?.summary, row.text, ...Object.values(row.worksheet || {}), groupLabel(row.team), stageLabel(row.round), kindLabel(item), kind === "idea" ? item.row.name + " " + item.row.context : ""];
    return { ...item, key:kind + ":" + row.id, title, category:kind === "idea" ? "idea" : row.team === "all" ? "plenary" : "team", haystack:normalize(terms.filter(Boolean).join(" ")) };
  });
}

type DetailProps = {
  item: Row; source: string; previous?: Row; next?: Row; position: string;
  all: ReadonlyMap<string, Row>; onOpen: (item: Row) => void; onClose: () => void;
};
function Detail({ item, source, previous, next, position, all, onOpen, onClose }: DetailProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const dialogLabel = useId();
  const { row, kind } = item;
  const photo = selectScenePhoto(row);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const trigger = document.activeElement;
    element.showModal();
    return () => {
      if (element.open) element.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll:true });
    };
  }, []);
  useEffect(() => { if (body.current) body.current.scrollTop = 0; }, [item.key]);
  const keys = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof Element) || event.target.closest("input,textarea,select,[contenteditable=true],[role=textbox]") || event.target.closest("dialog") !== dialog.current) return;
    const destination = event.key === "ArrowLeft" ? previous : event.key === "ArrowRight" ? next : undefined;
    if (destination) { event.preventDefault(); onOpen(destination); }
  };
  const citations = item.kind === "idea" ? [item.row.parentId] : [item.row.sourceIdeaId, item.row.sourceIdeaId2];
  const bodyLabel = item.kind === "idea" ? item.row.parentId ? "共感した理由・付け足したいこと" : "品川で試してみたいこと" : row.team === "all" ? "会場で加えたい挑戦テーマ" : row.round === 5 ? "発表で紹介したい挑戦テーマ" : "品川で試してみたいこと";
  const mode = kind === "idea" ? "personal" : row.team === "all" ? "plenary" : row.round === 5 ? "summary" : "work";
  return <dialog className="pg-detail" ref={dialog} aria-labelledby={dialogLabel} onKeyDown={keys}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
      if (event.target !== dialog.current) return;
      const b = dialog.current.getBoundingClientRect();
      if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) onClose();
    }}>
    <header className="pg-detail-bar">
      <button type="button" className="pg-back" onClick={onClose}><ArrowLeft size={16}/>一覧に戻る</button>
      <span className="pg-where">{position}</span>
      <div className="pg-page-buttons">
        <button type="button" disabled={!previous} aria-label="前の案" title="前の案（←）" onClick={() => previous && onOpen(previous)}><ChevronLeft size={19}/></button>
        <button type="button" disabled={!next} aria-label="次の案" title="次の案（→）" onClick={() => next && onOpen(next)}><ChevronRight size={19}/></button>
      </div>
    </header>
    <div className="pg-detail-body" ref={body} id={kind+"-"+row.id} tabIndex={-1}>
      <h2 id={dialogLabel} className="pg-sr">{item.title}</h2>
      <div className="pg-full-meta"><i style={{background:teamColors[row.team]}}/>{groupLabel(row.team)}<span>／</span>{kindLabel(item)}<span>／</span>{stageLabel(row.round)}
        {item.kind === "idea" && item.row.name && <strong>{item.row.name}</strong>}</div>
      <div className="pg-detail-story">
        <div className="pg-reading"><PostReading entry={row} kind={kind} mode={mode} bodyLabel={bodyLabel}/>
          <div className="pg-diagram"><IdeaVisualButton targetType={kind} targetId={row.id}/></div>
        </div>
        <figure className="pg-photo"><img src={photo.src} alt={photo.alt}/><figcaption>{photo.caption}</figcaption></figure>
      </div>
      <div className="pg-detail-bottom">
        {citations.filter((id): id is string => Boolean(id)).map(id => {
          const parent = all.get("idea:" + id);
          return parent ? <button type="button" className="pg-parent" key={id} onClick={() => onOpen(parent)}><CornerDownRight size={15}/>
            <span><small>元の個人案 · {groupLabel(parent.row.team)}</small>{parent.title}</span><ArrowRight size={15}/></button> :
            <a className="pg-parent" key={id} href={pageLink(source, { view:"screen", idea:id })}><CornerDownRight size={15}/>元の個人案を開く</a>;
        })}
        <div className="pg-actions"><ReactionButtons targetType={kind} targetId={row.id}/>
          {kind === "idea" ? <a href={pageLink(source, {reply:row.id})}><CornerDownRight size={15}/>この案に共感・ひと言</a> :
            <a href={pageLink(source,{view:"summary",write:"edit",themeId:row.id,team:row.team==="all"?"":row.team})}><Pencil size={15}/>まとめを編集</a>}
        </div>
        <PostComments key={item.key} targetType={kind} targetId={row.id}/>
      </div>
    </div>
  </dialog>;
}

export default function PresentationGallery({ ideas, themes, allIdeas = ideas, allThemes = themes, source = "", loaded, loadError = false, onSelect }: GalleryProps) {
  const { order, setOrder, score, values, ready } = useReactions();
  const [category, setCategory] = useState<KindFilter>("all");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<RouteTarget | null>(null);
  const [lastKey, setLastKey] = useState("");
  const composing = useRef(false);
  const deferredSearch = useDeferredValue(search);
  const queryId = useId();
  const full = useMemo(() => makeRows(allIdeas, allThemes), [allIdeas, allThemes]);
  const focusLabels = useMemo(() => {
    const keywords = selectGalleryKeywords(full);
    const counts = new Map<string, number>();
    const labels = full.map(item => {
      const word = keywords.get(item.key)?.trim() || item.title;
      const key = wording(word);
      counts.set(key, (counts.get(key) || 0) + 1);
      // Half-width Latin, numerals and kana need less space than full-width Japanese glyphs.
      const units = Array.from(word).reduce((total, glyph) => total + (/^[\u0020-\u007e\uff61-\uff9f]$/u.test(glyph) ? .58 : 1), 0);
      return { item, word, key, units };
    });
    return new Map(labels.map(({ item, word, key, units }) => {
      const same = key === wording(item.title);
      const wrap = units > 12 && (same || counts.get(key) === 1);
      const showTitle = !same && !wrap;
      return [item.key, { word, wrap, showTitle, same, search:normalize(word), perLine:Math.max(1, wrap ? Math.ceil(units / 2) : units) }];
    }));
  }, [full]);
  const pool = useMemo(() => new Map(full.map(item => [item.key,item])), [full]);
  const scoped = useMemo(() => {
    const ids = new Set([...ideas.map(i => "idea:"+i.id), ...themes.map(i=>"theme:"+i.id)]);
    return full.filter(item=>ids.has(item.key));
  },[ideas,themes,full]);
  const counts = useMemo(() => {
    const stats = {all:scoped.length,idea:0,team:0,plenary:0};
    for (const item of scoped) stats[item.category]++;
    return stats;
  },[scoped]);
  const rows = useMemo(() => {
    const terms = normalize(deferredSearch).trim().split(/\s+/u).filter(Boolean);
    return scoped.filter(item => {
      if (category !== "all" && category !== item.category) return false;
      if (!terms.length) return true;
      const stats = values.get(item.key), likes = stats?.likes || 0, loves = stats?.loves || 0;
      const sourceText = item.haystack + " " + (focusLabels.get(item.key)?.search || "") + (ready ? " "+(likes+loves)+"票 いいね"+likes+" love"+loves : "");
      return terms.every(term => sourceText.includes(term));
    }).sort((left,right) => {
      const priority = order === "popular" ? score(right.kind,right.row.id) - score(left.kind,left.row.id) : 0;
      return priority || right.row.createdAt.localeCompare(left.row.createdAt) || right.row.id.localeCompare(left.row.id);
    });
  },[scoped,category,deferredSearch,focusLabels,order,score,values,ready]);
  const current = target ? target.kind ? pool.get(target.kind+":"+target.id) : pool.get("idea:"+target.id) || pool.get("theme:"+target.id) : undefined;
  const index = current ? rows.findIndex(item => item.key === current.key) : -1;
  useEffect(() => {
    const read = () => setTarget(routeTarget(new URL(window.location.href)));
    read();
    window.addEventListener("popstate",read);window.addEventListener("hashchange",read);
    return () => { window.removeEventListener("popstate",read);window.removeEventListener("hashchange",read); };
  },[]);
  const open = useCallback((item: Row) => {
    const next = {kind:item.kind,id:item.row.id};
    setTarget(next);setLastKey(item.key);updateAddress(item);onSelect?.(next);
  },[onSelect]);
  const close = useCallback(() => {
    setTarget(null);updateAddress();onSelect?.(null);
  },[onSelect]);
  const inputChanged = (event: ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
    if (!composing.current) setSearch(event.target.value);
  };
  function moveInGrid(event: KeyboardEvent<HTMLUListElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
    const key = event.key;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)) return;
    const from = event.target instanceof Element ? event.target.closest("button") : null;
    if (!from) return;
    const selector = from.classList.contains("pg-quick-visual") ? ".pg-quick-visual" : ".pg-choice";
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(selector));
    const index = buttons.indexOf(from as HTMLButtonElement);
    if (index < 0) return;
    const columns = window.getComputedStyle(event.currentTarget).gridTemplateColumns.split(/\s+/).filter(Boolean).length || 1;
    const delta = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : key === "ArrowUp" ? -columns : columns;
    const target = key === "Home" ? 0 : key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + delta));
    event.preventDefault(); buttons[target]?.focus();
  }
  return <section className="presentation-gallery" aria-label="発表する案を選ぶ">
    <div className="pg-tools">
      <div className="pg-kinds" role="group" aria-label="投稿の種類">
        {choices.map(([value,label]) => <button type="button" key={value} aria-pressed={category===value} onClick={()=>setCategory(value)}>
          {label}<span>{loaded || counts[value] ? counts[value] : "—"}</span></button>)}
      </div>
      <div className="pg-search">
        <Search size={16} aria-hidden="true"/><label className="pg-sr" htmlFor={queryId}>タイトル・言葉・班・名前で検索</label>
        <input id={queryId} type="search" value={input} placeholder="タイトル・言葉・班・名前で検索" onChange={inputChanged}
          onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={event=>{composing.current=false;setSearch(event.currentTarget.value);}}/>
        {input && <button type="button" aria-label="検索を消す" onClick={()=>{setInput("");setSearch("");}}><X size={14}/></button>}
      </div>
      <label className="pg-order" title="人気順は、いいねとLOVEの合計順">
        <span className="pg-sr">投稿の並び順</span>
        <select value={order} onChange={event=>setOrder(event.target.value === "popular" ? "popular" : "recent")}>
          <option value="recent">新着順</option><option value="popular">人気順</option>
        </select>
      </label>
    </div>
    <p className="pg-search-status" role="status">{[deferredSearch.trim() ? rows.length + "件の検索結果" : "", order === "popular" ? "いいね＋LOVEの合計順" : ""].filter(Boolean).join(" ・ ")}</p>
    {target && !current && loaded && <div className="pg-unavailable" role="status">指定された投稿が見つかりませんでした。<button type="button" onClick={close}>一覧に戻る</button></div>}
    {rows.length ? <ul className="pg-grid" onKeyDown={moveInGrid}>
      {rows.map(item => {
        const label = focusLabels.get(item.key)!;
        const accessibleTitle = label.same ? item.title : label.word + " ／ " + item.title;
        return <li key={item.key}>
        <button type="button" className="pg-choice" aria-haspopup="dialog" title={item.title} aria-label={groupLabel(item.row.team) + "・" + kindLabel(item) + "「" + accessibleTitle + "」を開く"}
          aria-pressed={current?.key===item.key} data-last={lastKey===item.key || undefined} onClick={()=>open(item)}>
          <span className="pg-meta"><i style={{background:teamColors[item.row.team]}}/><b>{groupLabel(item.row.team)}</b>
            <span>{kindLabel(item)}</span><small aria-label={"リアクション" + (ready ? score(item.kind,item.row.id) : "取得中")}>{ready ? score(item.kind,item.row.id)+"票" : "—"}</small></span>
          <strong className="pg-focus-word" data-wrap={label.wrap || undefined} style={{"--pg-word-units":label.perLine} as CSSProperties}>{label.word}</strong>
          {label.showTitle && <span className="pg-choice-title">{item.title}</span>}
        </button>
        <IdeaVisualButton className="pg-quick-visual" targetType={item.kind} targetId={item.row.id}/>
      </li>;
      })}
    </ul> : <div className="pg-empty">{!loaded ? loadError ? "接続が戻ると、発表する案を再度読み込みます。" : "発表する案を読み込み中…" :
      category !== "all" || deferredSearch.trim() ? "この条件に一致する投稿はありません。" : "この範囲の投稿はまだありません。"}
      {(category !== "all" || input) && <button type="button" onClick={()=>{setCategory("all");setSearch("");setInput("");}}>種類・検索をリセット</button>}</div>}
    {current && <Detail item={current} source={source} previous={index>0 ? rows[index-1] : undefined}
      next={index>=0 && index+1<rows.length ? rows[index+1] : undefined} position={index>=0 ? (index+1)+" / "+rows.length : "元の投稿"}
      all={pool} onOpen={open} onClose={close}/>}
  </section>;
}
