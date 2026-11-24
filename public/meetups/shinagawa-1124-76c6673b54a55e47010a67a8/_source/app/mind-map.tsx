"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, CornerDownRight, GitBranch, Layers, Quote, Search, X } from "lucide-react";
import { type EventRound } from "./event-round";
import { selectGalleryKeywords } from "./gallery-keywords";
import { WorksheetReadout } from "./worksheet-fields";
import { ReactionButtons } from "./reactions";
import { PostComments } from "./post-comments";
import { buildContentMap, buildIdeaMap, defaultContentFocus, defaultFocus, groupDiagram, groupLabel, kindLabel, locationLabel, mapGroups, relatedPairs, groupIdeasByTopic, relationsDiagram, type Diagram, type IdeaMap, type MapGroup, type MapIdea, type MapRecord, type MapTheme, type PairLink, type RelatedIdea } from "./mind-map-model";
import "./mind-map.css";

type CitationProps = { onCite?: (idea: MapIdea) => void; citedIds?: readonly string[] };
type Props = CitationProps & { ideas: readonly MapIdea[]; themes?: readonly MapTheme[]; teamFilter: MapGroup | ""; roundFilter: EventRound | 5 | 0; hasLoaded: boolean; themesLoaded?: boolean; loadError?: boolean; presentation?: boolean; onWrite?: () => void; onOpenWorksheet?: (key:string) => void; onReply?: (idea:MapIdea)=>void };
const initialThemes: MapTheme[] = [];
const pageSize = 6;
type View = "topics" | "groups" | "links";
type LinkFilter = "all" | "recorded" | "suggested";
type MapTrail = {filter: string; keys: string[]; cursor: number};
const linkFilters: readonly [LinkFilter,string][] = [["all","すべて"],["recorded","引用・返信"],["suggested","共通点"]];
const normalized = (word:string) => word.normalize("NFKC").toLocaleLowerCase("ja").trim();
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

function Pages({start,total,change,label,size=pageSize}:{start:number;total:number;change:(n:number)=>void;label:string;size?:number}) {
  if(total<=size) return null;
  return <div className="mm-pages"><span>{label} {start+1}〜{Math.min(total,start+size)} / {total}件</span>
    <button type="button" disabled={!start} aria-label={label+"を前に戻す"} onClick={()=>change(start-size)}><ChevronLeft size={18}/></button>
    <button type="button" disabled={start+size>=total} aria-label={label+"の続きを見る"} onClick={()=>change(start+size)}><ChevronRight size={18}/></button></div>;
}

function ContentDrawing({entry,edges,keywords,onOpen,onFocus,emptyReason,onReset}:{entry:MapRecord;emptyReason:string;onReset?:()=>void;edges:readonly RelatedIdea[];keywords:ReadonlyMap<string,string>;onOpen:(key:string)=>void;onFocus:(key:string)=>void}) {
  const card=(item:MapRecord)=><><small>{groupLabel(item.row.team)} · {kindLabel(item)}</small><strong>{keywords.get(item.key)||item.title}</strong></>;
  return <div className="mm-related-map" role="group" aria-label="内容がつながるアイデア">
    <div className="mm-related-center"><span>中心の案</span><button type="button" className="mm-related-node" data-map-team={entry.row.team} data-center="true" title={entry.title} aria-label={"中心の案を読む："+entry.title} onClick={()=>onOpen(entry.key)}>{card(entry)}</button></div>
    {edges.length ? <ul className="mm-related-branches">{edges.map(link=>{
      const relation=link.kind==="in"?"この案が引用・返信した元の案":link.kind==="out"?"この案を引用・返信した投稿":"関連候補："+link.evidence.map(phrase=>"「"+phrase+"」").join(" ");
      return <li key={link.entry.key} data-edge={link.kind}>
        <span className="mm-edge-line" aria-hidden="true"/>
        <div className="mm-related-card">
          <span className="mm-edge-reason">{relation}</span>
          <div className="mm-related-card-actions"><button type="button" className="mm-related-node" data-map-team={link.entry.row.team} title={link.entry.title} aria-label={"案を読む："+link.entry.title} onClick={()=>onOpen(link.entry.key)}>{card(link.entry)}</button>
          <button className="mm-focus-link" type="button" aria-label={"この案を中心にする："+link.entry.title} title="この案を中心にする" onClick={()=>onFocus(link.entry.key)}><GitBranch size={16} aria-hidden="true"/><span>中心に</span></button></div>
        </div>
      </li>;
    })}</ul>:<div className="mm-unlinked"><p>{emptyReason}</p>{onReset&&<button className="mm-reset-links" type="button" onClick={onReset}>すべてのつながりを表示</button>}</div>}
  </div>;
}

function RelationshipLinks({pairs,keywords,onFocus}:{pairs:readonly PairLink[];keywords:ReadonlyMap<string,string>;onFocus:(key:string)=>void}){
  if(!pairs.length) return null;
  const node=(entry:MapRecord)=><button type="button" className="mm-pair-node" data-map-team={entry.row.team}
    aria-label={"中心にする："+entry.title} title={entry.title} onClick={()=>onFocus(entry.key)}><small>{groupLabel(entry.row.team)}</small><strong>{keywords.get(entry.key)||entry.title}</strong></button>;
  const lines=(links:readonly PairLink[])=>links.map(({from,to,edge,extended})=>{
    const candidate=edge.kind==="suggested";
    const reason=candidate?edge.evidence.map(s=>"「"+s+"」").join(" "):"元の案からの引用・返信";
    return <li className="mm-pair" data-edge={candidate?"suggested":"recorded"} key={from.key+"|"+to.key}>
      <span className="mm-pair-why"><strong>{candidate?"関連候補":"引用・返信"}</strong>{reason}{extended&&<small>一つ先の案</small>}</span>
      <div className="mm-pair-track">{node(from)}<span className="mm-pair-wire" aria-hidden="true">{candidate?"":"→"}</span>{node(to)}</div>
    </li>;
  });
  return <section className="mm-pairs" aria-label="案どうしのつながり">
    <h4>案どうしのつながり <small>{pairs.length}件</small></h4>
    <ul>{lines(pairs.slice(0,1))}</ul>
    {pairs.length>1&&<details><summary>ほかのつながり（{pairs.length-1}件）</summary><ul>{lines(pairs.slice(1))}</ul></details>}
  </section>;
}

function TopicOverview({groups,content,onOpen,onFocus}:{
  groups:ReturnType<typeof groupIdeasByTopic>;
  content:ReadonlyMap<string,readonly RelatedIdea[]>;onOpen:(key:string)=>void;onFocus:(key:string)=>void;
}) {
  const cards=(entries:readonly MapRecord[])=>entries.map(entry=>{
    const title=entry.title;
    const count=content.get(entry.key)?.length??0;
    return <li key={entry.key}>
      <button type="button" className="mm-topic-title" title={title} aria-label={"案を読む："+title} onClick={()=>onOpen(entry.key)}>
        <small>{groupLabel(entry.row.team)} · {kindLabel(entry)}</small><span>{title}</span>
      </button>
      {count>0&&<button type="button" className="mm-topic-drill" title="この案のつながりを見る" aria-label={title+"のつながり"+count+"件を見る"} onClick={()=>onFocus(entry.key)}><GitBranch size={14} aria-hidden="true"/><span>{count}</span></button>}
    </li>;
  });
  return <div className="mm-topics" aria-label="大項目別のアイデア">
    {groups.map(g=><section key={g.key} className="mm-topic">
      <header><h4>{g.title}</h4><span>{g.items.length}件</span></header>
      <ul>{cards(g.items.slice(0,4))}</ul>
      {g.items.length>4&&<details><summary>ほかの案（{g.items.length-4}件）</summary><ul>{cards(g.items.slice(4))}</ul></details>}
    </section>)}
  </div>;
}

export default function MindMap({ ideas, themes=initialThemes, teamFilter, roundFilter, hasLoaded, themesLoaded=true, loadError=false, presentation, onWrite, onOpenWorksheet, onReply, onCite, citedIds }:Props) {
  const graph=useMemo(()=>buildIdeaMap(ideas,themes),[ideas,themes]);
  const keywords=useMemo(()=>selectGalleryKeywords(graph.records),[graph]);
  const visible=useMemo(()=>graph.records.filter(e=>(!teamFilter||e.row.team===teamFilter)&&(!roundFilter||e.row.round===roundFilter)),[graph,teamFilter,roundFilter]);
  const content=useMemo(()=>presentation?buildContentMap(graph,visible):new Map<string,RelatedIdea[]>(),[presentation,graph,visible]);
  const topicGroups=useMemo(()=>presentation?groupIdeasByTopic(visible):[],[presentation,visible]);
  const groups=mapGroups.filter(g=>visible.some(e=>e.row.team===g));
  const [viewChoice,setView]=useState<View|null>(null);
  const [groupChoice,setGroup]=useState<MapGroup|null>(null);
  const [focusChoice,setFocus]=useState<{key:string;filter:string}|null>(null);
  const [history,setHistory]=useState<string[]>([]);
  const [search,setSearch]=useState("");
  const [trail,setTrail]=useState<MapTrail|null>(null);
  const [linkFilter,setLinkFilter]=useState<LinkFilter>("all");
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
  const defaultEntry=presentation?defaultContentFocus(visible,content):defaultFocus(visible,graph);
  const currentTrail=trail?.filter===filterKey ? trail : null;
  const trailEntry=currentTrail ? graph.byKey.get(currentTrail.keys[currentTrail.cursor]) : undefined;
  const entry=(presentation?trailEntry:(focusChoice?.filter===filterKey&&graph.byKey.get(focusChoice.key))) || defaultEntry;
  const hasRealLinks=!!defaultEntry&&(graph.sources.has(defaultEntry.key)||graph.successors.has(defaultEntry.key));
  const view=viewChoice || (presentation?"topics":hasRealLinks?"links":"groups");
  const group=groupChoice&&groups.includes(groupChoice)?groupChoice:groups[0];
  const grouped=visible.filter(e=>e.row.team===group).sort(orderByRound);
  const successors=entry?graph.successors.get(entry.key)||[]:[];
  const pageKey=view==="groups"?"group:"+group+":"+roundFilter:"links:"+filterKey+":"+entry?.key+(presentation?":"+linkFilter:"");
  const related=entry?content.get(entry.key)||[]:[];
  const recordedCount=related.filter(edge=>edge.kind!=="suggested").length;
  const filteredRelated=linkFilter==="all"?related:related.filter(edge=>linkFilter==="suggested"?edge.kind==="suggested":edge.kind!=="suggested");
  const searchable=useMemo(()=>visible.map(n=>({entry:n, text:normalized([n.title,keywords.get(n.key),groupLabel(n.row.team),kindLabel(n),n.row.enteredText ?? n.row.text,...Object.values(n.row.worksheet || {})].filter(Boolean).join(" "))})),[visible,keywords]);
  const tokens=normalized(search).split(/\s+/).filter(Boolean);
  const matches=tokens.length?searchable.filter(n=>tokens.every(q=>n.text.includes(q))).map(n=>n.entry):visible;
  const contentView=Boolean(presentation&&view==="links");
  const contentPageSize=4;
  const size=contentView?contentPageSize:pageSize;
  const total=view==="groups"?grouped.length:contentView?filteredRelated.length:successors.length;
  const start=Math.min(pages[pageKey]||0,Math.max(0,Math.floor((total-1)/size)*size));
  const setPage=(next:number)=>setPages(prev=>({...prev,[pageKey]:next}));
  const visibleLinks=contentView?filteredRelated.slice(start,start+size):[];
  const crosslinks=entry&&contentView?relatedPairs(entry,visibleLinks,content,linkFilter):[];
  const compact=Boolean(presentation && width>=960);
  const diagram = entry && group
    ? view === "groups"
      ? groupDiagram(width, group, grouped.slice(start, start + pageSize), grouped.length, compact)
      : relationsDiagram(width, entry, graph.sources.get(entry.key) || [], successors.slice(start, start + pageSize), compact)
    : null;
  const focusSelector=useRef<HTMLSelectElement>(null);
  const current=graph.byKey.get(history[history.length-1]);
  const focusOn=(key:string)=>{
    if(presentation){
      setTrail(prev=>{
        const active=prev?.filter===filterKey ? prev : null;
        const keys=active ? active.keys.slice(0,active.cursor+1) : entry ? [entry.key] : [];
        if(keys.at(-1)===key)return prev;
        return {filter:filterKey,keys:[...keys,key],cursor:keys.length};
      });
    }else setFocus({key,filter:filterKey});
    setView("links");setHistory([]);
  };
  const moveTrail=(delta:number)=>setTrail(prev=>{
    if(!prev||prev.filter!==filterKey)return prev;
    const index=prev.cursor+delta;
    return index>=0&&index<prev.keys.length ? {...prev,cursor:index} : prev;
  });
  const openRecord=(key:string)=>{ if(presentation&&onOpenWorksheet) onOpenWorksheet(key); else setHistory([key]); };
  const wait=!hasLoaded||!themesLoaded;
  if(!entry||!diagram) return <div className="mm-empty" role="status"><GitBranch size={30} aria-hidden="true"/>
    <strong>{loadError?"マップに接続できません":wait?"マップを読み込み中…":graph.records.length?"この条件にはまだ案がありません":"最初の投稿からマップが始まります"}</strong>
    <span>{loadError?"接続が戻ると、案とつながりを表示します。":wait?"個人案とテーマを集めています。":graph.records.length?"ほかの班や回を選ぶと、その案が見られます。":"個人案が一つ届くと、班と講演の枝に表示されます。返信や元の案を選んだテーマは矢印でつながります。"}</span>
    {!wait&&!loadError&&onWrite&&<button type="button" className="mm-action" onClick={onWrite}>個人の案を書く</button>}</div>;
  const options=matches.some(e=>e.key===entry.key)?matches:[entry,...matches];
  const mode=(label:string,key:LinkFilter,count:number)=><button key={key} type="button" aria-pressed={linkFilter===key} onClick={()=>setLinkFilter(key)}>{label}<small>{count}</small></button>;
  return <section className={"mind-map"+(presentation?" mm-project":"")} aria-labelledby={headerId} data-map-compact={compact || undefined}>
    <div className="mm-controls"><div className="mm-mode" role="group" aria-label="マップの表示">{presentation&&<button type="button" aria-pressed={view==="topics"} onClick={()=>setView("topics")}><Layers size={15} aria-hidden="true"/>大項目別</button>}<button type="button" aria-pressed={view==="groups"} onClick={()=>setView("groups")}><Layers size={15} aria-hidden="true"/>班・講演から</button><button type="button" aria-pressed={view==="links"} onClick={()=>setView("links")}><GitBranch size={15} aria-hidden="true"/>{presentation?"内容がつながる案":"案のつながり"}</button></div>
      {view==="topics"?null:view==="groups"?<div className="mm-team-tabs" role="group" aria-label="表示する班">
        {groups.map(g=><button key={g} type="button" aria-pressed={g===group} data-map-team={g} onClick={()=>setGroup(g)}>
          {groupLabel(g)}<small>{visible.filter(n=>n.row.team===g).length}</small></button>)}
      </div>:
      presentation ? <form className="mm-explore" role="search" aria-label="マップの中心になる案を探す" onSubmit={e=>{e.preventDefault();if(tokens.length&&matches[0]){focusOn(matches[0].key);focusSelector.current?.focus({preventScroll:true});}}}>
        <label className="mm-search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="案を検索" placeholder="案・キーワードを検索" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <label className="mm-focus-select"><span className="mm-sr">中心にする案</span><select ref={focusSelector} value={entry.key} onChange={e=>focusOn(e.target.value)}>{options.map(n=><option key={n.key} value={n.key}>{groupLabel(n.row.team)} · {kindLabel(n)} · {n.title}</option>)}</select></label>
        <div className="mm-trail" role="group" aria-label="マップ探索履歴">
          <button type="button" disabled={!currentTrail?.cursor} aria-label="一つ前の中心に戻る" onClick={()=>moveTrail(-1)}><ChevronLeft size={18}/></button>
          <button type="button" disabled={!currentTrail||currentTrail.cursor>=currentTrail.keys.length-1} aria-label="一つ次の中心に進む" onClick={()=>moveTrail(1)}><ChevronRight size={18}/></button>
        </div>
        {tokens.length>0&&<output className="mm-search-result">{matches.length?matches.length+"件見つかりました":"該当する案なし"}</output>}
      </form>:<label className="mm-select">中心にする案<select ref={focusSelector} value={entry.key} onChange={e=>focusOn(e.target.value)}>{options.map(n=><option key={n.key} value={n.key}>{groupLabel(n.row.team)} · {kindLabel(n)} · {n.title}</option>)}</select></label>}</div>
    <div className="mm-chart">
      <header className="mm-chart-head">
        <h3 id={headerId}>{view==="topics"?"大項目別のアイデア":view==="groups"?groupLabel(group)+"の案とテーマ":contentView?"関係するアイデア":"発想のつながり"}</h3>
        {view==="topics"?<span className="mm-legend">{topicGroups.length}項目・{visible.length}件　投稿内容で分類</span>:contentView?<div className="mm-related-legend">
          <div className="mm-relation-filter" role="group" aria-label="つながりの種類">{linkFilters.map(([key,label])=>mode(label,key,key==="all"?related.length:key==="recorded"?recordedCount:related.length-recordedCount))}</div>
          <span className="mm-sr">共通点は投稿原文をもとにした参考表示です。</span>
        </div>:<span className="mm-legend"><i data-wire={view==="groups"?"classification":"citation"} aria-hidden="true"/>{view==="groups"?"点線：班・講演の分類":"矢印：元の案から派生した案へ"}</span>}
      </header>
      <div ref={resize} className="mm-space">{view==="topics"?<TopicOverview groups={topicGroups} content={content} onOpen={openRecord} onFocus={focusOn}/>:contentView?<ContentDrawing entry={entry} edges={visibleLinks} emptyReason={related.length?"この種類のつながりはありません。":"この案には、同じ班・回の絞り込み内で表示できるつながりはありません。ほかの案を検索して探せます。"} onReset={related.length&&linkFilter!=="all"?()=>setLinkFilter("all"):undefined} keywords={keywords} onOpen={openRecord} onFocus={key=>{focusOn(key);focusSelector.current?.focus({preventScroll:true});}}/>:<MapDrawing diagram={diagram} onOpen={openRecord}
        team={view==="groups"?group:undefined} keywords={keywords} label={view==="groups"?"班から講演、個人案・テーマへの分類図":"元の個人案と、そこから生まれた投稿・テーマの関係図"}/>}</div>
      {view==="links"&&!contentView&&!graph.sources.has(entry.key)&&!successors.length&&<p className="mm-unlinked">この案には、まだ元の案や派生した投稿が結び付いていません。</p>}
      {contentView&&<RelationshipLinks pairs={crosslinks} keywords={keywords} onFocus={key=>{focusOn(key);focusSelector.current?.focus({preventScroll:true});}}/>}
      {view!=="topics"&&<Pages start={start} total={total} size={size} change={setPage} label={view==="groups"?"案":contentView?"関連する案":"派生した投稿・テーマ"}/> }
    </div>
    {(loadError||wait)&&<p className="mm-unlinked" role="status">{loadError?"一部のデータに接続できません。接続が戻ると更新します。":"残りのデータを読み込み中…"}</p>}
    {current&&<Detail entry={current} graph={graph} canBack={history.length>1} onBack={()=>setHistory(prev=>prev.slice(0,-1))} onClose={()=>setHistory([])} onOpen={key=>setHistory(prev=>[...prev,key])} onFocus={()=>focusOn(current.key)} onReply={onReply} onCite={onCite} citedIds={citedIds}/>}
  </section>;
}
