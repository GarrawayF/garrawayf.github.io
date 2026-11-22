"use client";

import { useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, Compass, CornerDownRight, Eye, GitBranch, HandHeart, Lightbulb, MapPin, MessageCircle, Pencil, Quote, Search, Users, X } from "lucide-react";
import { isDemoRoom, pageLink } from "./board-room";
import demoWorksheetExamples from "./demo-worksheet-examples.json";
import GraphicRecording from "./graphic-recording";
import { selectGalleryKeywords, selectWorksheetKeyword } from "./gallery-keywords";
import { galleryEntry, galleryHistoryState, galleryLocation } from "./gallery-navigation";
import { IdeaVisualButton } from "./idea-visual";
import FullscreenToggle from "./fullscreen-toggle";
import { excerpt, makeVisualIndex, VisualCache } from "./idea-visual-model";
import { groupLabel, kindLabel, stageLabel, type MapIdea, type MapRecord, type MapTheme } from "./mind-map-model";
import { analyzePost } from "./post-analysis";
import { PostComments } from "./post-comments";
import { WORKSHEET_KEYS, worksheetField, worksheetGroups } from "./worksheet";
import { ReactionButtons, useReactions } from "./reactions";
import "./presentation-gallery.css";

type KindFilter = "all" | "idea" | "team" | "plenary";
type Target = { kind: "idea" | "theme"; id: string };
type RouteTarget = { kind?: Target["kind"]; id: string };
type GalleryProps = {
  ideas: readonly MapIdea[]; themes: readonly MapTheme[]; allIdeas?: readonly MapIdea[]; allThemes?: readonly MapTheme[];
  detailOnly?:boolean; externalOpen?:{key:string}|null; onExternalOpenConsumed?:()=>void;
  loaded: boolean; loadError?: boolean; source?: string; projectorGroups?: boolean; onSelect?: (target: Target | null) => void;
};
type Row = MapRecord & { category: Exclude<KindFilter, "all">; haystack: string };
const choices: [KindFilter, string][] = [["all","すべて"], ["idea","個人案"], ["team","班のまとめ"], ["plenary","全体の案"]];
const teamColors: Record<string, string> = { A:"#a8c481", B:"#edba76", C:"#93c6d7", D:"#f1a6bd", E:"#bea9e0", all:"#f9dfeb" };
const projectionChunk = 20;
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja-JP");
const wording = (value: string) => normalize(value).replace(/[\s\p{P}]/gu, "");

function routeTarget(url: URL): RouteTarget | null {
  const id = url.searchParams.get("idea");
  if (id) return { kind:"idea", id };
  if (url.hash.startsWith("#theme-") && url.hash.length > 7) return { kind:"theme", id:url.hash.slice(7) };
  const thread = url.searchParams.get("thread");
  return thread ? { id:thread } : null;
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

const illustrationIcons = { person: Users, scene: MapPin, gain: HandHeart, action: Compass, perspective: Eye,
  origin: MessageCircle, quote: Quote, words: Pencil, location: MapPin, sources: GitBranch };

function Illustration({ item, all }: { item: Row; all: ReadonlyMap<string, Row> }) {
  const { row, kind } = item;
  const model = useMemo(() => {
    const ids = kind === "idea" ? [item.row.parentId] : [item.row.sourceIdeaId, item.row.sourceIdeaId2];
    const originals = ids.flatMap(id => {
      const source = id ? all.get("idea:" + id) : undefined;
      return source?.kind === "idea" && source.key !== item.key ? [source.row] : [];
    });
    return new VisualCache().resolve(item.key, makeVisualIndex(kind === "idea" ? [item.row, ...originals] : originals, kind === "theme" ? [item.row] : []));
  }, [item, all, kind]);
  const analysis = useMemo(() => row.analysis?.summary?.trim() || analyzePost(row, kind).summary, [row, kind]);
  if (!model) return null;
  return <section className="pg-explainer" aria-label="図解と解説">
    <h3><GitBranch aria-hidden="true" size={22}/>図解と解説</h3>
    {analysis && <div className="pg-explainer-note"><span>入力内容の要約</span><p>{excerpt(analysis, 170)}</p></div>}
    <div className="pg-explainer-map">
      <div className="pg-explainer-hub"><Lightbulb aria-hidden="true" strokeWidth={1.6} size={26}/><strong>{excerpt(model.title, 72)}</strong></div>
      <ul className="pg-explainer-branches">{model.branches.map((branch, i) => {
        const Icon = illustrationIcons[branch.type];
        return <li key={branch.type + i} data-branch={branch.type}>
          <svg className="pg-explainer-wire" viewBox="0 0 30 34" width="30" height="34" fill="none" aria-hidden="true"><path d="M1 1v16q0 9 9 9h18"/><circle cx="28" cy="26" r="2"/></svg>
          <div className="pg-explainer-node">
            <h4><Icon size={17} strokeWidth={1.8} aria-hidden="true"/>{branch.label}</h4>
            {branch.type === "sources" ? branch.sources?.map((source, j) => <p key={source.key + j}>{excerpt(source.title, 75)}<span>{source.location}</span></p>)
              : branch.passages.map((text, j) => <p key={j}>{excerpt(text, 115)}</p>)}
          </div>
        </li>;
      })}</ul>
    </div>
  </section>;
}

const demoFields = ["person", "scene", "gain", "partners"] as const;
type DemoField = (typeof demoFields)[number];
type DemoExamples = Record<string, Partial<Record<DemoField, string>>>;
const demoExamples: DemoExamples = demoWorksheetExamples;

function examplesFor(rowId: string, all: ReadonlyMap<string, Row>) {
  if (Object.hasOwn(demoExamples, rowId)) return demoExamples[rowId];
  const prefix = rowId.slice(0, 8).toLowerCase();
  if (!/^[0-9a-f]{8}$/u.test(prefix) || !Object.hasOwn(demoExamples, prefix)) return;
  // New demo rows must not accidentally inherit a sample through an ambiguous prefix.
  const matches = [...all.values()].filter(entry => entry.row.id.slice(0, 8).toLowerCase() === prefix);
  return matches.length === 1 && matches[0].row.id === rowId ? demoExamples[prefix] : undefined;
}

type ProjectorFit = { key: string; available: number; overflow: boolean };
const projectorQuery = "(min-width: 981px)";
const projectorDensities = ["normal","compact","tight"] as const;

function useProjectorFit(key: string, body: RefObject<HTMLDivElement | null>, sheet: RefObject<HTMLElement | null>) {
  const [fit, setFit] = useState<ProjectorFit | null>(null);
  useLayoutEffect(() => {
    const canvas = body.current, original = sheet.current;
    if (!canvas || !original) return;
    const desktop = window.matchMedia(projectorQuery);
    let frame = 0, alive = true;
    const measure = () => {
      if (!desktop.matches || !canvas.clientHeight || !original.offsetHeight) {
        delete original.dataset.projectorDensity;
        setFit(old => old === null ? old : null);
        return;
      }
      const css = window.getComputedStyle(canvas);
      const available = Math.max(1, Math.floor(canvas.clientHeight - (parseFloat(css.paddingTop) || 0) - (parseFloat(css.paddingBottom) || 0) - 4));
      // Pick the roomiest layout that fits; each tier reflows at the full measured width
      // without transforming the text or its interactive targets.
      let overflow = true;
      for (const density of projectorDensities) {
        original.dataset.projectorDensity=density;
        if (original.offsetHeight <= available) { overflow=false;break; }
      }
      const next = { key, available, overflow };
      setFit(old => old?.key === key && old.available === available && old.overflow === overflow ? old : next);
    };
    const schedule = () => {
      if (!alive) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    observer?.observe(canvas); observer?.observe(original);
    window.addEventListener("resize",schedule);
    desktop.addEventListener?.("change",schedule);
    void document.fonts?.ready.then(schedule);
    schedule();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize",schedule);
      desktop.removeEventListener?.("change",schedule);
    };
  }, [key, body, sheet]);
  return fit?.key === key ? fit : null;
}

type DetailProps = {
  item: Row; source: string; keyword?: string; previous?: Row; next?: Row; position: string;
  all: ReadonlyMap<string, Row>; onOpen: (item: Row, move?: "related" | "carousel", scrollTop?: number) => void; onClose: () => void;
  previousIsDetail: boolean; restoreScroll: number; returnToMap?:boolean;
};
function Detail({ item, source, keyword, previous, next, position, all, onOpen, onClose, previousIsDetail, restoreScroll, returnToMap }: DetailProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const originalSheet = useRef<HTMLElement>(null);
  const diagram = useRef<HTMLDivElement>(null);
  const fit = useProjectorFit(item.key, body, originalSheet);
  const dialogLabel = useId();
  const { row, kind } = item;
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
  useEffect(() => { if (body.current) body.current.scrollTop = restoreScroll; }, [item.key, restoreScroll]);
  const keys = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof Element) || event.target.closest("input,textarea,select,[contenteditable=true],[role=textbox]") || event.target.closest("dialog") !== dialog.current) return;
    const destination = event.key === "ArrowLeft" ? previous : event.key === "ArrowRight" ? next : undefined;
    if (destination) { event.preventDefault(); onOpen(destination, "carousel"); }
  };
  const citations = item.kind === "idea" ? [item.row.parentId] : [item.row.sourceIdeaId, item.row.sourceIdeaId2];
  const worksheet = row.worksheet || {};
  const raw = row.enteredText ?? row.text;
  const mode = kind === "idea" ? "personal" : row.team === "all" ? "plenary" : row.round === 5 ? "summary" : "work";
  // This opt-in display treatment is never used to write data or fill a production record.
  const demoSheet = Boolean(source) && typeof window !== "undefined" && isDemoRoom(source) && isDemoRoom(window.location.href);
  const example = demoSheet ? examplesFor(row.id, all) : undefined;
  const supplement = (field: DemoField) => {
    const original = worksheet[field];
    const sample = example?.[field];
    return original?.trim() || typeof sample !== "string" || !sample.trim()
      ? { value: original, example: false }
      : { value: sample, example: true };
  };
  const cells = [
    { id: "person" as const, lead: "誰", label: "誰が使う？", hint: "どんな人か。どんな一日を過ごしているか。", ...supplement("person") },
    { id: "scene" as const, lead: "何", label: "今、何に困っている？", hint: "駅前や移動のどんな場面で困っているか。", ...supplement("scene") },
    { id: "gain" as const, lead: "どうなる", label: "どうなったら嬉しい？", hint: "その人の一日がどう変わるか。", ...supplement("gain") },
    { id: "proposal" as const, lead: "どうやって", label: "駅前に何があったらいい？", hint: "どんな機能・サービス・場があると嬉しいか。", value: raw, example: false },
    { id: "partners" as const, lead: "誰と", label: "誰と一緒に挑戦したい？", hint: "この未来に共感し、一緒に考え続けたい人や組織は誰か。", ...supplement("partners") },
  ];
  const sheetKeys = new Set(cells.map(cell => cell.id));
  const currentKeys = worksheetGroups[mode];
  const extras = [...currentKeys, ...WORKSHEET_KEYS.filter(key => !currentKeys.includes(key))]
    .filter(key => !sheetKeys.has(key) && worksheet[key]?.trim())
    .map(key => ({ key, label: worksheetField(key, mode).label, value: worksheet[key]! }));
  const footer = [...extras,
    ...(kind === "idea" && item.row.context?.trim() ? [{ key: "context", label: "きっかけ・共感した理由", value: item.row.context }] : []),
  ];
  const calledName = kind === "idea" ? item.row.name?.trim() : "";
  const showKeyword = keyword && wording(keyword) !== wording(item.title);
  const workLabel = row.round === 5 ? "FINAL" : row.round === 4 ? "全体対話" : "WORK 0" + row.round;
  return <dialog className="pg-detail" data-demo-detail={demoSheet || undefined} ref={dialog} aria-labelledby={dialogLabel} onKeyDown={keys}
    onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
      if (event.target !== dialog.current) return;
      const b = dialog.current.getBoundingClientRect();
      if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) onClose();
    }}>
    <header className="pg-detail-bar">
      <button type="button" className="pg-back" onClick={onClose}><ArrowLeft size={16}/>{previousIsDetail ? "ひとつ前に戻る" : returnToMap ? "マップに戻る" : "一覧に戻る"}</button>
      {fit?.overflow && <span className="pg-fit-warning">原文を省かず表示しています。続きはスクロール</span>}
      <span className="pg-where">{position}</span>
      <button type="button" className="pg-diagram-jump" onClick={() => {
        const target = diagram.current;
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "start" });
      }} aria-label="図解と解説へ移動"><ArrowDown size={15} aria-hidden="true"/>図解へ</button>
      <FullscreenToggle where="detail"/>
      <div className="pg-page-buttons">
        <button type="button" disabled={!previous} aria-label="前の案" title="前の案（←）" onClick={() => previous && onOpen(previous, "carousel")}><ChevronLeft size={19}/></button>
        <button type="button" disabled={!next} aria-label="次の案" title="次の案（→）" onClick={() => next && onOpen(next, "carousel")}><ChevronRight size={19}/></button>
      </div>
    </header>
    <div className="pg-detail-body" ref={body} id={kind+"-"+row.id} tabIndex={-1}>
      <div className="pg-projector-frame" data-fit={fit && !fit.overflow ? true : undefined}
        style={fit && !fit.overflow ? { "--pg-fit-height":fit.available + "px" } as CSSProperties : undefined}>
      <section className="pg-original-sheet" ref={originalSheet} aria-label={kind === "idea" ? "個人で書いたシート" : "班・全体で書いたシート"} style={{"--pg-sheet-team":teamColors[row.team]} as CSSProperties}>
        <header className="pg-original-heading">
          <div className="pg-sheet-heading-line">
            <p className="pg-sheet-work">{workLabel}</p>
            <div className="pg-sheet-attribution">
              <p className="pg-original-meta"><i style={{background:teamColors[row.team]}}/>{groupLabel(row.team)}<span>／</span>{stageLabel(row.round)}</p>
              {calledName && <p className="pg-sheet-called-name"><span>呼ばれたい名前</span><strong>{calledName}</strong></p>}
            </div>
          </div>
          <h2 id={dialogLabel} className="pg-sheet-title" data-keyword-is-title={!showKeyword || undefined}>{item.title}</h2>
          {showKeyword && <p className="pg-sheet-keyword">{keyword}</p>}
          <div className="pg-sheet-heading-line pg-sheet-caption">
            <h3>{kind === "idea" ? "個人で書いたシート" : row.team === "all" ? "全体で書いたシート" : "班で書いたシート"}</h3>
            <p>困りごと ／ したい体験　どちらか一方でOK</p>
          </div>
        </header>
        <dl className="reading-original pg-sheet-grid">
          {cells.map(cell => {
            const cue = selectWorksheetKeyword(cell.value, cell.id);
            const same = Boolean(cue && cell.value && wording(cue) === wording(cell.value));
            return <div key={cell.id} data-sheet-field={cell.id}>
              <dt><span className="pg-sheet-prompt" aria-hidden="true">{cell.lead}</span>{cell.label}<small>（{cell.hint}）</small></dt>
              <dd data-empty={!cell.value?.trim() || undefined} data-demo-fill={cell.example || undefined}>
                {cue && !same && <b className="pg-sheet-cell-keyword" aria-hidden="true">{cue}</b>}
                <span className={same ? "pg-sheet-cell-keyword pg-sheet-cell-answer" : "pg-sheet-cell-answer"}>{cell.value?.trim() ? cell.value : "未記入"}</span>
              </dd>
            </div>;
          })}
        </dl>
        <div className="pg-sheet-feedback" aria-label="このアイデアへのリアクションとコメント">
          <ReactionButtons targetType={kind} targetId={row.id}/>
          <PostComments key={item.key} targetType={kind} targetId={row.id} tone="light" compact/>
        </div>
      </section>
      </div>
      <div ref={diagram} className="pg-diagram-target" tabIndex={-1}>
        <GraphicRecording title={item.title} person={cells[0].value} scene={cells[1].value}
          proposal={raw} gain={cells[2].value}/>
      </div>
      {footer.length > 0 && <section className="pg-original-sheet pg-sheet-notes" aria-label="記入シートの補足">
        <h3>記入シートの補足</h3>
        <dl className="reading-original pg-sheet-grid">{footer.map(field => <div key={field.key} className="pg-sheet-extra"><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
      </section>}
      <Illustration item={item} all={all}/>
      <div className="pg-detail-bottom">
        {citations.filter((id): id is string => Boolean(id)).map(id => {
          const parent = all.get("idea:" + id);
          return parent ? <button type="button" className="pg-parent" key={id} onClick={() => onOpen(parent, "related", body.current?.scrollTop)}><CornerDownRight size={15}/>
            <span><small>元の個人案 · {groupLabel(parent.row.team)}</small>{parent.title}</span><ArrowRight size={15}/></button> :
            <a className="pg-parent" key={id} href={pageLink(source, { view:"screen", idea:id })}><CornerDownRight size={15}/>元の個人案を開く</a>;
        })}
        <div className="pg-actions">
          {kind === "idea" ? <a href={pageLink(source, {reply:row.id})}><CornerDownRight size={15}/>この案に共感・ひと言</a> :
            <a href={pageLink(source,{view:"summary",write:"edit",themeId:row.id,team:row.team==="all"?"":row.team})}><Pencil size={15}/>まとめを編集</a>}
        </div>
      </div>
    </div>
  </dialog>;
}

export default function PresentationGallery({ ideas, themes, allIdeas = ideas, allThemes = themes, source = "", loaded, loadError = false, projectorGroups = false, onSelect, detailOnly=false, externalOpen, onExternalOpenConsumed }: GalleryProps) {
  const { order, setOrder, score, values, ready } = useReactions();
  const [category, setCategory] = useState<KindFilter>("all");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const restore = () => {
      const query = new URL(window.location.href).searchParams.get("q")?.slice(0,180) || "";
      setInput(query);setSearch(query);
    };
    restore();
    window.addEventListener("popstate",restore);
    return () => window.removeEventListener("popstate",restore);
  },[]);
  function commitSearch(value:string) {
    setSearch(value);
    const url=new URL(window.location.href);
    if(value.trim())url.searchParams.set("q",value);else url.searchParams.delete("q");
    if(url.href!==window.location.href) try { window.history.replaceState(window.history.state,"",url.href); } catch { /* Local history may be unavailable. */ }
  }
  const [target, setTarget] = useState<RouteTarget | null>(null);
  const [lastKey, setLastKey] = useState("");
  const [previousIsDetail, setPreviousIsDetail] = useState(false);
  const [restoreScroll, setRestoreScroll] = useState(0);
  const waitingForBack = useRef(false);
  const composing = useRef(false);
  const deferredSearch = useDeferredValue(search);
  const queryId = useId();
  const scrollGroupId = useId();
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
  const rowGroups = useMemo(() => !projectorGroups ? [rows] :
    Array.from({ length:Math.ceil(rows.length / projectionChunk) }, (_, i) => rows.slice(i * projectionChunk, (i + 1) * projectionChunk)), [projectorGroups, rows]);
  const current = target ? target.kind ? pool.get(target.kind+":"+target.id) : pool.get("idea:"+target.id) || pool.get("theme:"+target.id) : undefined;
  const index = current ? rows.findIndex(item => item.key === current.key) : -1;
  useEffect(() => {
    const read = () => {
      const next = routeTarget(new URL(window.location.href));
      const entry = galleryEntry(window.history.state);
      waitingForBack.current = false;
      setTarget(next);
      setPreviousIsDetail(Boolean(next && entry?.parent === "detail"));
      setRestoreScroll(entry?.scrollTop ?? 0);
    };
    read();
    window.addEventListener("popstate",read);window.addEventListener("hashchange",read);
    return () => { window.removeEventListener("popstate",read);window.removeEventListener("hashchange",read); };
  },[]);
  const open = useCallback((item: Row, move?: "related" | "carousel", scrollTop = 0) => {
    const next = {kind:item.kind,id:item.row.id};
    const currentUrl = window.location.href;
    const nextUrl = galleryLocation(currentUrl, next);
    if (nextUrl.href === currentUrl || waitingForBack.current) return;
    const history = window.history;
    const currentEntry = galleryEntry(history.state);
    let parent = currentEntry?.parent;
    try {
      if (move === "carousel") {
        history.replaceState(galleryHistoryState(history.state, currentEntry ? { ...currentEntry, scrollTop: 0 } : null), "", nextUrl.href);
      } else {
        // A linked original is a deliberate new screen; carousel browsing stays in one entry.
        if (move === "related" && currentEntry) {
          history.replaceState(galleryHistoryState(history.state, { ...currentEntry, scrollTop }), "", currentUrl);
        }
        const newParent = move === "related" ? "detail" : "list";
        history.pushState(galleryHistoryState(history.state, { parent: newParent, scrollTop: 0 }), "", nextUrl.href);
        parent = newParent;
      }
    } catch { /* Portable local HTML can restrict history. The dialog still works. */ }
    setTarget(next);setRestoreScroll(0);setPreviousIsDetail(parent === "detail");
    if (!move) setLastKey(item.key);
    onSelect?.(next);
  },[onSelect]);
  const consumedOpen=useRef<typeof externalOpen>(null);
  useEffect(()=>{
    if (!externalOpen || externalOpen===consumedOpen.current) return;
    const item=pool.get(externalOpen.key);
    if(!item) return;
    consumedOpen.current=externalOpen;
    open(item);
    onExternalOpenConsumed?.();
  },[externalOpen,pool,open,onExternalOpenConsumed]);
  const close = useCallback(() => {
    if (waitingForBack.current) return;
    const history = window.history;
    if (galleryEntry(history.state)) {
      waitingForBack.current = true;
      history.back();
    } else {
      // No in-app predecessor (such as a URL opened from chat): do not leave the board.
      try { history.replaceState(galleryHistoryState(history.state, null), "", galleryLocation(window.location.href).href); }
      catch { /* Local-file history may be restricted. */ }
      setTarget(null);setPreviousIsDetail(false);setRestoreScroll(0);
    }
    onSelect?.(null);
  },[onSelect]);
  const inputChanged = (event: ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
    if (!composing.current) commitSearch(event.target.value);
  };
  function moveInGrid(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
    const key = event.key;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)) return;
    const from = event.target instanceof Element ? event.target.closest("button") : null;
    const grid = from?.closest(".pg-grid");
    if (!from || !grid) return;
    const selector = from.classList.contains("pg-quick-visual") ? ".pg-quick-visual" : ".pg-choice";
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(selector));
    const index = buttons.indexOf(from as HTMLButtonElement);
    if (index < 0) return;
    const columns = window.getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length || 1;
    const delta = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : key === "ArrowUp" ? -columns : columns;
    const target = key === "Home" ? 0 : key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + delta));
    event.preventDefault(); buttons[target]?.focus();
  }
  function jumpToGroup(group: number) {
    const next = document.getElementById(scrollGroupId + "-" + group);
    next?.focus({ preventScroll:true });
    next?.scrollIntoView({ block:"start", behavior:"instant" });
  }
  function renderRows(list: readonly Row[]) {
    return <ul className="pg-grid">{list.map(item => {
      const label = focusLabels.get(item.key)!;
      const accessibleTitle = label.same ? item.title : label.word + " ／ " + item.title;
      return <li key={item.key} data-team={item.row.team} style={{"--pg-team-accent": teamColors[item.row.team] || teamColors.all} as CSSProperties}>
        <button type="button" className="pg-choice" aria-haspopup="dialog" title={item.title} aria-label={groupLabel(item.row.team) + "・" + kindLabel(item) + "「" + accessibleTitle + "」を開く"}
          aria-pressed={current?.key===item.key} data-last={lastKey===item.key || undefined} onClick={()=>open(item)}>
          <span className="pg-meta"><i style={{background:teamColors[item.row.team]}}/><b>{groupLabel(item.row.team)}</b>
            <span>{kindLabel(item)}</span><small aria-label={"リアクション" + (ready ? score(item.kind,item.row.id) : "取得中")}>{ready ? score(item.kind,item.row.id)+"票" : "—"}</small></span>
          <strong className="pg-focus-word" data-wrap={label.wrap || undefined} style={{"--pg-word-units":label.perLine} as CSSProperties}>{label.word}</strong>
          {label.showTitle && <span className="pg-choice-title">{item.title}</span>}
        </button>
        <IdeaVisualButton className="pg-quick-visual" targetType={item.kind} targetId={item.row.id}/>
      </li>;
    })}</ul>;
  }
  const slide=current && <Detail item={current} source={source} keyword={focusLabels.get(current.key)?.word}
    previous={index>0 ? rows[index-1] : undefined} next={index>=0 && index+1<rows.length ? rows[index+1] : undefined}
    position={index>=0 ? (index+1)+" / "+rows.length : "元の投稿"} all={pool}
    onOpen={open} onClose={close} previousIsDetail={previousIsDetail} restoreScroll={restoreScroll} returnToMap={detailOnly}/>;
  if(detailOnly) return target || slide ? <section className="presentation-gallery">{slide}
    {target && !current && loaded && <div className="pg-unavailable" role="status">指定された投稿が見つかりませんでした。<button type="button" onClick={close}>マップに戻る</button></div>}
  </section> : null;
  return <section className="presentation-gallery" aria-label="発表する案を選ぶ">
    <div className="pg-tools">
      <div className="pg-kinds" role="group" aria-label="投稿の種類">
        {choices.map(([value,label]) => <button type="button" key={value} aria-pressed={category===value} onClick={()=>setCategory(value)}>
          {label}<span>{loaded || counts[value] ? counts[value] : "—"}</span></button>)}
      </div>
      <div className="pg-search">
        <Search size={16} aria-hidden="true"/><label className="pg-sr" htmlFor={queryId}>タイトル・言葉・班・名前で検索</label>
        <input id={queryId} type="search" maxLength={180} value={input} placeholder="タイトル・言葉・班・名前で検索" onChange={inputChanged}
          onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={event=>{composing.current=false;commitSearch(event.currentTarget.value);}}/>
        {input && <button type="button" aria-label="検索を消す" onClick={()=>{setInput("");commitSearch("");}}><X size={14}/></button>}
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
    {rows.length ? <div className="pg-grid-stack" data-projection-deck={projectorGroups || undefined} onKeyDown={moveInGrid}>
      {projectorGroups ? rowGroups.map((list, group) => {
        const groupId = scrollGroupId + "-" + group;
        const start = group * projectionChunk + 1, end = start + list.length - 1;
        return <section className="pg-output-slide" key={group} tabIndex={-1} id={groupId} aria-labelledby={groupId + "-title"}>
          <header className="pg-output-step">
            <h2 id={groupId + "-title"}><strong>{String(group + 1).padStart(2,"0")}</strong><span aria-hidden="true"> / {String(rowGroups.length).padStart(2,"0")}</span><span className="pg-output-range">{start}–{end}件目 / 全{rows.length}件</span></h2>
            {rowGroups.length > 1 && <nav className="pg-output-controls" aria-label="表示する範囲">
              {group > 0 && <button type="button" onClick={() => jumpToGroup(group-1)}><ArrowUp size={14} aria-hidden="true"/>前の{rowGroups[group - 1].length}件</button>}
              {group+1 < rowGroups.length && <button type="button" className="pg-output-next" onClick={() => jumpToGroup(group+1)}><ArrowDown size={14} aria-hidden="true"/>次の{rowGroups[group + 1].length}件</button>}
            </nav>}
          </header>
          {renderRows(list)}
        </section>;
      }) : renderRows(rows)}
    </div> : <div className="pg-empty">{!loaded ? loadError ? "接続が戻ると、発表する案を再度読み込みます。" : "発表する案を読み込み中…" :
      category !== "all" || deferredSearch.trim() ? "この条件に一致する投稿はありません。" : "この範囲の投稿はまだありません。"}
      {(category !== "all" || input) && <button type="button" onClick={()=>{setCategory("all");commitSearch("");setInput("");}}>種類・検索をリセット</button>}</div>}
    {slide}
  </section>;
}
