"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, Compass, Eye, GitBranch, HandHeart, Lightbulb, MapPin, MessageCircle, NotebookPen, Pencil, Quote, Shapes, Users, X } from "lucide-react";
import type { MapIdea, MapTheme } from "./mind-map-model";
import { excerpt, makeVisualIndex, VisualCache, type VisualBranch, type VisualModel } from "./idea-visual-model";
import "./idea-visual.css";

type Kind = "idea" | "theme";
type VisualActions = { openVisual: (kind: Kind, id: string) => void };
const VisualContext = createContext<VisualActions | null>(null);
const icons = { person: Users, scene: MapPin, gain: HandHeart, action: Compass, perspective: Eye,
  origin: MessageCircle, quote: Quote, words: Pencil, location: MapPin, sources: GitBranch };
const noThemes: readonly MapTheme[] = [];

function Marker({ text, word }: { text: string; word?: string }) {
  const at = word ? text.indexOf(word) : -1;
  if (at < 0 || !word) return <>{text}</>;
  return <>{text.slice(0, at)}<mark>{word}</mark>{text.slice(at + word.length)}</>;
}

function Branch({ branch, onSource }: { branch: VisualBranch; onSource: (key: string) => void }) {
  const Icon = icons[branch.type];
  return <article className={"iv-branch iv-" + branch.type} data-branch={branch.type}>
    <h3><span className="iv-ink-icon"><Icon aria-hidden="true" strokeWidth={1.65}/></span>{branch.label}</h3>
    {branch.type === "sources" ? <div className="iv-sources">{branch.sources?.map(source =>
      <button type="button" className="iv-source" key={source.key} onClick={() => onSource(source.key)}>
        <small>{source.location}</small><span>{excerpt(source.title, 55)}<ArrowUpRight aria-hidden="true" size={17}/></span>
      </button>)}</div> :
      branch.type === "words" ? <div className="iv-tags">{branch.passages.map(word => <mark key={word}>{word}</mark>)}</div> :
      branch.passages.map((text, i) => <p key={i}><Marker text={excerpt(text, 100)} word={branch.emphasis[i]}/></p>)}
  </article>;
}

function Drawing({ model, onSource }: { model: VisualModel; onSource: (key: string) => void }) {
  const board = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ width: number; height: number; paths: string[] } | null>(null);
  useLayoutEffect(() => {
    const root = board.current;
    const hub = root?.querySelector<HTMLElement>(".iv-hub");
    if (!root || !hub) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(".iv-branch"));
    const redraw = () => {
      const rect = root.getBoundingClientRect(), head = hub.getBoundingClientRect();
      if (!rect.width || !head.width) return;
      const sx = head.left - rect.left + head.width / 2, sy = head.bottom - rect.top;
      const narrow = rect.width < 620;
      const paths = nodes.map((node, i) => {
        const b = node.getBoundingClientRect();
        const leftSide = b.left - rect.left + b.width / 2 < sx;
        const x = b.left - rect.left + (!narrow && leftSide ? b.width : 0);
        const y = b.top - rect.top + Math.min(31, b.height / 2);
        const trunk = narrow ? 8 : sx + (leftSide ? -1 : 1) * (10 + 4 * (i % 3));
        const elbow = narrow ? Math.min(y - 9, sy + 27) : sy + 14;
        return `M ${sx} ${sy} C ${sx} ${elbow}, ${trunk} ${sy + 3}, ${trunk} ${elbow + 4} L ${trunk} ${y - 12} Q ${trunk} ${y}, ${x} ${y}`;
      });
      setLines({ width: rect.width, height: rect.height, paths });
    };
    redraw();
    const firstFrame = requestAnimationFrame(redraw);
    const observer = new ResizeObserver(redraw);
    [root, hub, ...nodes].forEach(node => observer.observe(node));
    return () => { cancelAnimationFrame(firstFrame); observer.disconnect(); };
  }, [model]);
  return <div className="iv-drawing" ref={board}>
    {lines && <svg className="iv-wires" aria-hidden="true" width="100%" height="100%" viewBox={`0 0 ${lines.width} ${lines.height}`} preserveAspectRatio="none">
      {lines.paths.map((d, i) => <path d={d} key={i} />)}
    </svg>}
    <div className="iv-hub"><Lightbulb aria-hidden="true" size={32} strokeWidth={1.7}/>
      <h2 className="iv-heading"><Marker text={excerpt(model.title, 89)} word={model.emphasis}/></h2>
    </div>
    <div className="iv-branches">{model.branches.map((branch, i) => <Branch branch={branch} key={branch.type + i} onSource={onSource}/>)}</div>
  </div>;
}

function Poster({ model, original, hasBack, onBack, onSource, onClose }: {
  model: VisualModel; original: { label: string; text: string }[]; hasBack: boolean; onBack: () => void;
  onSource: (key: string) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    close.current?.focus({ preventScroll: true });
    return () => { if (element.open) element.close(); };
  }, []);
  useEffect(() => { dialog.current?.scrollTo(0, 0); }, [model.key]);
  return <dialog className="iv-dialog" ref={dialog} aria-labelledby={titleId} onCancel={event => {
    event.preventDefault(); event.stopPropagation(); onClose();
  }}>
    <div className="iv-paper">
      <header className="iv-toolbar"><div className="iv-section-title" id={titleId}><NotebookPen aria-hidden="true" size={21}/><strong>アイデアの図解</strong></div>
        <div>{hasBack && <button type="button" onClick={onBack}><ArrowLeft size={17} aria-hidden="true"/>前の図解</button>}
          <button className="iv-close" type="button" ref={close} onClick={onClose}><X size={19} aria-hidden="true"/>閉じる</button></div>
      </header>
      <main className="iv-content"><p className="iv-meta"><span>{model.kind}</span>{model.location}</p>
        <Drawing model={model} onSource={onSource}/>
        {original.length > 0 && <details className="iv-original" key={model.key}>
          <summary><BookOpen size={16} aria-hidden="true"/>原文を読む</summary>
          <dl>{original.map(({ label, text }) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
        </details>}
      </main>
    </div>
  </dialog>;
}

export function IdeaVisualProvider({ ideas, themes = noThemes, children }: {
  ideas: readonly MapIdea[]; themes?: readonly MapTheme[]; children: ReactNode;
}) {
  const [cache] = useState(() => new VisualCache());
  const index = useMemo(() => makeVisualIndex(ideas, themes), [ideas, themes]);
  const [path, setPath] = useState<string[]>([]);
  const opener = useRef<HTMLElement | null>(null);
  const key = path[path.length - 1];
  const selected = useMemo(() => key ? cache.resolve(key, index) : undefined, [key, cache, index]);
  const show = useCallback((target: string) => Boolean(cache.resolve(target, index)), [cache, index]);
  const openVisual = useCallback((kind: Kind, id: string) => {
    const target = kind + ":" + id;
    if (!show(target)) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPath([target]);
  }, [show]);
  const close = useCallback(() => {
    setPath([]);
    const previous = opener.current;
    requestAnimationFrame(() => { if (previous?.isConnected) previous.focus({ preventScroll: true }); });
  }, []);
  const actions = useMemo(() => ({ openVisual }), [openVisual]);

  useEffect(() => {
    cache.removeMissing(index);
    const queue = Array.from(index.entries()).filter(([id, entry]) => !cache.fresh(id, entry)).map(([id]) => id);
    if (!queue.length) return;
    let cursor = 0, idle: number | undefined, timer: number | undefined;
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function")
        idle = window.requestIdleCallback(work, { timeout: 300 });
      else timer = window.setTimeout(() => work(), 12);
    };
    function work(deadline?: IdleDeadline) {
      const end = Date.now() + 7;
      do { cache.resolve(queue[cursor++], index); }
      while (cursor < queue.length && Date.now() < end && (!deadline || deadline.timeRemaining() > 1));
      if (cursor < queue.length) schedule();
    }
    schedule();
    return () => {
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [index, cache]);
  return <VisualContext.Provider value={actions}>
    {children}
    {selected && <Poster model={selected} original={selected.original} hasBack={path.length > 1} onClose={close}
      onBack={() => { const previous = path[path.length - 2]; if (previous && show(previous)) setPath(path.slice(0, -1)); }}
      onSource={target => { if (show(target)) setPath(previous => [...previous, target]); }}/>}
  </VisualContext.Provider>;
}

export function useIdeaVisual() {
  const value = useContext(VisualContext);
  if (!value) throw new Error("IdeaVisualProvider is required");
  return value;
}

export function IdeaVisualButton({ targetType, targetId, className = "" }: {
  targetType: Kind; targetId: string; className?: string;
}) {
  const { openVisual } = useIdeaVisual();
  return <button type="button" className={"iv-trigger " + className} data-target-id={targetId}
    aria-haspopup="dialog" onClick={() => openVisual(targetType, targetId)}>
    <Shapes size={17} strokeWidth={1.8} aria-hidden="true"/>図解
  </button>;
}
