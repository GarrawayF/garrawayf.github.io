"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, CornerDownRight, GitBranch, Layers, Quote, X } from "lucide-react";
import { type EventRound } from "./event-round";
import { selectGalleryKeywords } from "./gallery-keywords";
import { WorksheetReadout } from "./worksheet-fields";
import { ReactionButtons } from "./reactions";
import { PostComments } from "./post-comments";
import { buildIdeaMap, defaultFocus, groupDiagram, groupLabel, kindLabel, locationLabel, mapGroups, relationsDiagram, type Diagram, type IdeaMap, type MapGroup, type MapIdea, type MapRecord, type MapTheme } from "./mind-map-model";
import "./mind-map.css";

type CitationProps = { onCite?: (idea: MapIdea) => void; citedIds?: readonly string[] };
type Props = CitationProps & { ideas: readonly MapIdea[]; themes?: readonly MapTheme[]; teamFilter: MapGroup | ""; roundFilter: EventRound | 5 | 0; hasLoaded: boolean; themesLoaded?: boolean; loadError?: boolean; presentation?: boolean; onWrite?: () => void; onReply?: (idea:MapIdea)=>void };
const initialThemes: MapTheme[] = [];
const pageSize = 6;
type View = "groups" | "links";
const orderByRound = (a:MapRecord,b:MapRecord) => a.row.round-b.row.round || a.row.createdAt.localeCompare(b.row.createdAt) || a.key.localeCompare(b.key);

function Detail({entry,graph,canBack,onBack,onOpen,onClose,onFocus,onReply,onCite,citedIds}:CitationProps & {
  entry:MapRecord; graph:IdeaMap; canBack:boolean; onBack:()=>void; onOpen:(key:string)=>void; onClose:()=>void; onFocus:()=>void; onReply?:Props["onReply"];
}) {
  const ref=useRef<HTMLDialogElement>(null), heading=useRef<HTMLHeadingElement>(null);
  const titleId=useId();
  const citationHintId = useId();
  const citing = useRef(false);
  const selected = new Set(citedIds?.filter(id => id.trim()));
  const alreadyCited = selected.has(entry.row.id);
  const isFull = selected.size >= 2;
  function citeCurrentIdea() {
    if (!onCite || entry.kind !== "idea" || alreadyCited || isFull || citing.current) return;
    citing.current = true;
    ref.current?.close();
    onClose();
    onCite(entry.row);
  }
  useEffect(()=>{
    const dialog=ref.current, opener=document.activeElement;
    if(!dialog) return;
    dialog.showModal();
    return ()=>{if(dialog.open)dialog.close(); if(opener instanceof HTMLElement && opener.isConnected) opener.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{ref.current?.scrollTo(0,0);heading.current?.focus({preventScroll:true});},[entry.key]);
  const raw=(entry.row.enteredText ?? entry.row.text).trim();
  const ctx=entry.kind==="idea"?entry.row.context.trim():"";
  const mode=entry.kind==="idea"?"personal":entry.row.team==="all"?"plenary":entry.row.round===5?"summary":"work";
  const links=(label:string,entries: MapRecord[] | undefined)=>entries?.length ? <section className="mm-detail-section"><h4>{label}（{entries.length}）</h4>{entries.map(item=><button key={item.key} className="mm-detail-link" type="button" onClick={()=>onOpen(item.key)}><small>{locationLabel(item)} · {kindLabel(item)}</small>{item.title}</button>)}</section>:null;
  return <dialog ref={ref} className="mm-detail" aria-labelledby={titleId} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{
    if(e.target!==ref.current) return; const rect=ref.current.getBoundingClientRect();
    if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)onClose();
  }}>
    <header className="mm-detail-head">{canBack&&<button type="button" onClick={onBack} aria-label="前の案に戻る"><ArrowLeft size={18}/></button>}<span>{locationLabel(entry)} · {kindLabel(entry)}</span><button className="mm-close" type="button" onClick={onClose} aria-label="詳細を閉じる"><X size={20}/></button></header>
    <h3 id={titleId} tabIndex={-1} ref={heading}>{entry.title}</h3>
    {onCite && entry.kind === "idea" && <div className="mm-cite">
      <button type="button" disabled={alreadyCited || isFull} aria-describedby={citationHintId}
        onClick={citeCurrentIdea}><Quote size={17} aria-hidden="true"/>
        {alreadyCited ? "この案は引用済み" : isFull ? "引用は2件まで" : "この案を引用"}
      </button>
      <span id={citationHintId}>{alreadyCited ? "班のまとめの引用欄に入っています。" :
        isFull ? "別の案を選ぶには、まとめの編集で引用を一つ外してください。" :
        "引用して、編集中の班のまとめに戻ります。"}</span>
    </div>}
    {entry.row.analysis?.summary?.trim()&&entry.row.analysis.summary.trim()!==raw&&entry.row.analysis.summary.trim()!==entry.title&&<section className="mm-detail-section"><h4>要約</h4><p>{entry.row.analysis.summary}</p></section>}
    {raw&&<section className="mm-detail-section"><h4>投稿の原文</h4><p>{raw}</p></section>}
    {entry.kind==="idea"&&entry.row.name&&<p className="mm-byline">{entry.row.name}</p>}
    {ctx&&<section className="mm-detail-section"><h4>きっかけ・共感した理由</h4><p>{ctx}</p></section>}
    <WorksheetReadout mode={mode} values={entry.row.worksheet || {}}/>
    <ReactionButtons targetType={entry.kind} targetId={entry.row.id}/>
    <PostComments key={entry.key} targetType={entry.kind} targetId={entry.row.id}/>
    {links("元になった個人案",graph.sources.get(entry.key))}
    {links("この案から広がった投稿・テーマ",graph.successors.get(entry.key))}
    <div className="mm-detail-actions"><button type="button" onClick={onFocus}><GitBranch size={16}/>この案を中心に見る</button>
      {onReply&&entry.kind==="idea"&&<button type="button" onClick={()=>{onClose();onReply(entry.row);}}><CornerDownRight size={16}/>この案から発想</button>}</div>
  </dialog>;
}

function MapDrawing({diagram,onOpen,label,team,keywords}:{diagram:Diagram;onOpen:(key:string)=>void;label:string;team?:MapGroup;keywords:ReadonlyMap<string,string>}) {
  const arrow=useId().replaceAll(":","");
  return <div className="mm-canvas" aria-label={label} role="group" style={{height:diagram.height}}>
    <svg aria-hidden="true" className="mm-lines" width="100%" height="100%" viewBox={`0 0 ${diagram.width} ${diagram.height}`} preserveAspectRatio="none">
      <defs><marker id={arrow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L7 4L1 7" fill="none" stroke="var(--mm-active)" strokeWidth="1.5" strokeLinejoin="round"/></marker></defs>
      {diagram.wires.map((edge,i)=><path key={i} data-from={edge.from} data-to={edge.to} className={edge.classification?"mm-classification":"mm-attribution"} d={edge.path} markerEnd={edge.classification?undefined:`url(#${arrow})`}/>)}
    </svg>
    {diagram.boxes.map((b,i)=>{
      const style={left:(b.x/diagram.width*100)+"%",top:b.y,width:(b.width/diagram.width*100)+"%",height:b.height};
      const className="mm-box mm-box-"+b.style+(b.focus?" mm-box-focus":"");
      const shade=b.entry?.row.team || team;
      const word=b.entry ? (keywords.get(b.id) || b.label) : b.label;
      const contents=<>{b.meta&&<small>{b.meta}</small>}<span>{word}</span></>;
      return b.entry ? <button key={b.id+i} type="button" style={style} className={className} data-map-team={shade}
        aria-label={b.meta ? b.meta+"： "+b.label : b.label} title={b.label} onClick={()=>onOpen(b.id)}>{contents}</button>:
        <div key={b.id} style={style} className={className} data-map-team={shade}>{contents}</div>;
    })}
  </div>;
}

function Pages({start,total,change,label}:{start:number;total:number;change:(n:number)=>void;label:string}) {
  if(total<=pageSize) return null;
  return <div className="mm-pages"><span>{label} {start+1}〜{Math.min(total,start+pageSize)} / {total}件</span>
    <button type="button" disabled={!start} aria-label={label+"を前に戻す"} onClick={()=>change(start-pageSize)}><ChevronLeft size={18}/></button>
    <button type="button" disabled={start+pageSize>=total} aria-label={label+"の続きを見る"} onClick={()=>change(start+pageSize)}><ChevronRight size={18}/></button></div>;
}

export default function MindMap({ ideas, themes=initialThemes, teamFilter, roundFilter, hasLoaded, themesLoaded=true, loadError=false, presentation, onWrite, onReply, onCite, citedIds }:Props) {
  const graph=useMemo(()=>buildIdeaMap(ideas,themes),[ideas,themes]);
  const keywords=useMemo(()=>selectGalleryKeywords(graph.records),[graph]);
  const visible=useMemo(()=>graph.records.filter(e=>(!teamFilter||e.row.team===teamFilter)&&(!roundFilter||e.row.round===roundFilter)),[graph,teamFilter,roundFilter]);
  const groups=mapGroups.filter(g=>visible.some(e=>e.row.team===g));
  const [viewChoice,setView]=useState<View|null>(null);
  const [groupChoice,setGroup]=useState<MapGroup|null>(null);
  const [focusChoice,setFocus]=useState<{key:string;filter:string}|null>(null);
  const [history,setHistory]=useState<string[]>([]);
  const [pages,setPages]=useState<Record<string,number>>({});
  const resize=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(650);
  const headerId=useId();
  const hasItems=visible.length>0;
  useEffect(()=>{
    const host=resize.current;if(!host) return;
    const measure=()=>{const value=Math.floor(host.getBoundingClientRect().width);if(value>0)setWidth(value);};
    measure();
    if (typeof ResizeObserver !== "function") { window.addEventListener("resize",measure); return () => window.removeEventListener("resize",measure); }
    const observer=new ResizeObserver(measure);observer.observe(host);return ()=>observer.disconnect();
  },[hasItems]);
  const filterKey=teamFilter+"/"+roundFilter;
  const defaultEntry=defaultFocus(visible,graph);
  const entry=(focusChoice?.filter===filterKey&&graph.byKey.get(focusChoice.key)) || defaultEntry;
  const hasRealLinks=!!defaultEntry&&(graph.sources.has(defaultEntry.key)||graph.successors.has(defaultEntry.key));
  const view=viewChoice || (hasRealLinks?"links":"groups");
  const group=groupChoice&&groups.includes(groupChoice)?groupChoice:groups[0];
  const grouped=visible.filter(e=>e.row.team===group).sort(orderByRound);
  const successors=entry?graph.successors.get(entry.key)||[]:[];
  const pageKey=view==="groups"?"group:"+group+":"+roundFilter:"links:"+entry?.key;
  const total=view==="groups"?grouped.length:successors.length;
  const start=Math.min(pages[pageKey]||0,Math.max(0,Math.floor((total-1)/pageSize)*pageSize));
  const setPage=(next:number)=>setPages(prev=>({...prev,[pageKey]:next}));
  const compact=Boolean(presentation && width>=960);
  const diagram = entry && group
    ? view === "groups"
      ? groupDiagram(width, group, grouped.slice(start, start + pageSize), grouped.length, compact)
      : relationsDiagram(width, entry, graph.sources.get(entry.key) || [], successors.slice(start, start + pageSize), compact)
    : null;
  const current=graph.byKey.get(history[history.length-1]);
  const focusOn=(key:string)=>{setFocus({key,filter:filterKey});setView("links");setHistory([]);};
  const wait=!hasLoaded||!themesLoaded;
  if(!entry||!diagram) return <div className="mm-empty" role="status"><GitBranch size={30} aria-hidden="true"/>
    <strong>{loadError?"マップに接続できません":wait?"マップを読み込み中…":graph.records.length?"この条件にはまだ案がありません":"最初の投稿からマップが始まります"}</strong>
    <span>{loadError?"接続が戻ると、案とつながりを表示します。":wait?"個人案とテーマを集めています。":graph.records.length?"ほかの班や回を選ぶと、その案が見られます。":"個人案が一つ届くと、班と講演の枝に表示されます。返信や元の案を選んだテーマは矢印でつながります。"}</span>
    {!wait&&!loadError&&onWrite&&<button type="button" className="mm-action" onClick={onWrite}>個人の案を書く</button>}</div>;
  const options=visible.some(e=>e.key===entry.key)?visible:[entry,...visible];
  return <section className={"mind-map"+(presentation?" mm-project":"")} aria-labelledby={headerId} data-map-compact={compact || undefined}>
    <div className="mm-controls"><div className="mm-mode" role="group" aria-label="マップの表示"><button type="button" aria-pressed={view==="groups"} onClick={()=>setView("groups")}><Layers size={15} aria-hidden="true"/>班・講演から</button><button type="button" aria-pressed={view==="links"} onClick={()=>setView("links")}><GitBranch size={15} aria-hidden="true"/>案のつながり</button></div>
      {view==="groups"?<div className="mm-team-tabs" role="group" aria-label="表示する班">
        {groups.map(g=><button key={g} type="button" aria-pressed={g===group} data-map-team={g} onClick={()=>setGroup(g)}>
          {groupLabel(g)}<small>{visible.filter(n=>n.row.team===g).length}</small></button>)}
      </div>:
      <label className="mm-select">中心にする案<select value={entry.key} onChange={e=>focusOn(e.target.value)}>{options.map(n=><option key={n.key} value={n.key}>{groupLabel(n.row.team)} · {kindLabel(n)} · {Array.from(n.title).slice(0,36).join("")}</option>)}</select></label>}</div>
    <div className="mm-chart">
      <header className="mm-chart-head">
        <h3 id={headerId}>{view==="groups"?groupLabel(group)+"の案とテーマ":"発想のつながり"}</h3>
        <span className="mm-legend"><i data-wire={view==="groups"?"classification":"citation"} aria-hidden="true"/>{view==="groups"?"点線：班・講演の分類":"矢印：元の案から派生した案へ"}</span>
      </header>
      <div ref={resize} className="mm-space"><MapDrawing diagram={diagram} onOpen={key=>setHistory([key])}
        team={view==="groups"?group:undefined} keywords={keywords} label={view==="groups"?"班から講演、個人案・テーマへの分類図":"元の個人案と、そこから生まれた投稿・テーマの関係図"}/></div>
      {view==="links"&&!graph.sources.has(entry.key)&&!successors.length&&<p className="mm-unlinked">この案には、まだ元の案や派生した投稿が結び付いていません。</p>}
      <Pages start={start} total={total} change={setPage} label={view==="groups"?"案":"派生した投稿・テーマ"}/>
    </div>
    {(loadError||wait)&&<p className="mm-unlinked" role="status">{loadError?"一部のデータに接続できません。接続が戻ると更新します。":"残りのデータを読み込み中…"}</p>}
    {current&&<Detail entry={current} graph={graph} canBack={history.length>1} onBack={()=>setHistory(prev=>prev.slice(0,-1))} onClose={()=>setHistory([])} onOpen={key=>setHistory(prev=>[...prev,key])} onFocus={()=>focusOn(current.key)} onReply={onReply} onCite={onCite} citedIds={citedIds}/>}
  </section>;
}
