"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Pencil, Share2, X, ZoomIn, ZoomOut } from "lucide-react";
import { isMaterials, type DeckKey, type Materials } from "./materials-data";
import { roomApi, roomFetch } from "./board-room";
import "./materials-panel.css";

type Round = 1 | 2 | 3 | 4;
type PanelProps = {
  onClose: () => void;
  round?: number;
  initialDeck?: DeckKey;
  onStartIdea?: (round: Round) => void;
  onStartNote?: () => void;
};

const sheetRounds: Partial<Record<number, Round>> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 4 };

export default function MaterialsPanel(props: PanelProps) {
  const [materials,setMaterials]=useState<Materials|null>(null);
  const [error,setError]=useState(false);
  const retry=useState(0);
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const el=ref.current;
    if(!el)return;
    el.showModal();
    return ()=>{if(el.open)el.close();};
  },[materials]);
  useEffect(()=>{
    const controller=new AbortController();
    setError(false);
    void roomFetch(roomApi("/api/materials"),{signal:controller.signal,cache:"no-store"}).then(async response=>{
      if(!response.ok)throw Error("Materials unavailable");
      const data=await response.json();
      if(!isMaterials(data.materials))throw Error("Invalid materials");
      if(!controller.signal.aborted)setMaterials(data.materials);
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[retry[0]]);
  if(materials)return <MaterialDeck {...props} materials={materials}/>;
  return <dialog ref={ref} className="materials-dialog" aria-label="当日の資料" onCancel={e=>{e.preventDefault();props.onClose();}}>
    <div className="materials-surface"><header className="materials-header"><h2>当日の資料</h2>
      <button type="button" className="materials-close" aria-label="資料を閉じる" onClick={props.onClose}><X size={20} aria-hidden="true"/></button>
    </header><p role="status">{error?"資料を読み込めませんでした。":"資料を読み込んでいます…"}</p>
    {error&&<button type="button" className="materials-share" onClick={()=>retry[1](n=>n+1)}>再読み込み</button>}</div>
  </dialog>;
}

function MaterialDeck({ onClose, round, initialDeck, onStartIdea, onStartNote, materials }: PanelProps & { materials:Materials }) {
  const [kind, setKind] = useState<DeckKey>(initialDeck ?? (round ? "worksheets" : "slides"));
  const [positions, setPositions] = useState({ slides: 0, worksheets: round === 4 ? 6 : round && round >= 1 && round <= 3 ? round + 1 : 0 });
  const [zoomed, setZoomed] = useState(false);
  const [shareState, setShareState] = useState<"copied" | "manual" | "idle">("idle");
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const heading = useId();
  const deck = materials[kind];
  const index = Math.max(0,Math.min(positions[kind],deck.slides.length-1));
  const slide = deck.slides[index];
  const [preview,setPreview]=useState({key:"",url:"",error:false});
  const slideKey=deck.file+"-"+(index+1);
  useEffect(()=>{
    const controller=new AbortController();
    let objectUrl="";
    void roomFetch(roomApi("/api/asset/slides/"+slideKey+".webp"),{signal:controller.signal,cache:"no-store"}).then(async response=>{
      if(!response.ok||!response.headers.get("Content-Type")?.startsWith("image/webp"))throw Error("Preview unavailable");
      const blob=await response.blob();
      if(controller.signal.aborted)return;
      objectUrl=URL.createObjectURL(blob);
      setPreview({key:slideKey,url:objectUrl,error:false});
    }).catch(()=>{if(!controller.signal.aborted)setPreview({key:slideKey,url:"",error:true});});
    return ()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[slideKey]);
  const activeSlideId = slide.id;
  const url = `https://docs.google.com/presentation/d/${deck.id}/edit#slide=id.${activeSlideId}`;
  const actionsRef = useRef(0);
  const targetRound = kind === "worksheets" ? sheetRounds[index] : undefined;
  const noteAction = kind === "worksheets" && index === 1 && onStartNote;
  const ideaAction = targetRound && onStartIdea;
  const hasWriteAction = Boolean(noteAction || ideaAction);

  function startWriting() {
    if (noteAction) {
      onClose();
      noteAction();
    } else if (ideaAction && targetRound) {
      onClose();
      ideaAction(targetRound);
    }
  }

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.showModal();
    return () => {
      actionsRef.current++;
      if (el.open) el.close();
      previousFocus.current?.focus({ preventScroll: true });
    };
  }, []);

  function choose(nextKind: DeckKey, nextIndex: number) {
    actionsRef.current++;
    setShareState("idle");
    setZoomed(false);
    setKind(nextKind);
    setPositions(prev => ({ ...prev, [nextKind]: nextIndex }));
  }

  async function share() {
    const action = ++actionsRef.current;
    const shareData = { title: `X-meetup品川｜${slide.title}`, url };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      if (action === actionsRef.current) setShareState("copied");
    } catch {
      if (action === actionsRef.current) setShareState("manual");
    }
  }

  return (
    <dialog ref={dialog} className="materials-dialog" aria-labelledby={heading}
      onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="materials-surface">
        <header className="materials-header">
          <h2 id={heading}>当日の資料</h2>
          <button className="materials-close" type="button" onClick={onClose} aria-label="資料を閉じる" autoFocus><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="materials-choices" role="group" aria-label="資料の種類">
          {(["slides", "worksheets"] as const).map(key =>
            <button type="button" key={key} className={key === kind ? "is-selected" : ""} aria-pressed={key === kind}
              onClick={() => choose(key, positions[key])}>{materials[key].label}</button>
          )}
        </div>
        <div className="materials-stepper">
          <button type="button" className="materials-nav" aria-label="前のページ" disabled={index === 0}
            onClick={() => choose(kind, index - 1)}><ChevronLeft size={18} aria-hidden="true" /></button>
          <label className="materials-picker">
            <select aria-label="表示するページ" value={index} onChange={e => choose(kind, Number(e.target.value))}>
              {deck.slides.map((item, i) => <option key={item.id} value={i}>{i + 1} / {deck.slides.length}　{item.title}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </label>
          <button type="button" className="materials-nav" aria-label="次のページ" disabled={index === deck.slides.length - 1}
            onClick={() => choose(kind, index + 1)}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
        <div className="materials-preview-wrap">
          <div className={zoomed ? "materials-preview is-zoomed" : "materials-preview"}
            tabIndex={zoomed ? 0 : undefined} aria-label={zoomed ? "拡大表示。横と縦にスクロールできます" : undefined}>
            {preview.key===slideKey&&preview.url?<img src={preview.url} alt={`${deck.label} ${index + 1}枚目：${slide.title}`}
              key={kind + activeSlideId} width={kind === "slides" ? 1280 : 1682} height={kind === "slides" ? 720 : 1190}
              decoding="async" draggable={false} />:<p role="status">{preview.key===slideKey&&preview.error?"プレビューを読み込めません。下のリンクから資料を開けます。":"プレビューを読み込んでいます…"}</p>}
          </div>
          <button className="materials-zoom" type="button" aria-pressed={zoomed}
            aria-label={zoomed ? "ページ全体を表示" : "ページを拡大"} onClick={() => setZoomed(v => !v)}>
            {zoomed ? <ZoomOut size={16} aria-hidden="true" /> : <ZoomIn size={16} aria-hidden="true" />}
          </button>
        </div>
        <footer className="materials-footer">
          {hasWriteAction && <button type="button" className="materials-primary materials-write" onClick={startWriting}>
            <Pencil size={15} aria-hidden="true" />{noteAction ? "個人メモに書く" : targetRound === 4 ? "全体対話の案を書く" : "この問いで投稿を書く"}
          </button>}
          <a className={hasWriteAction ? "materials-share" : "materials-primary"} href={url} target="_blank" rel="noopener noreferrer"
            aria-label={kind === "worksheets" ? "共有シートをGoogleスライドで開く" : "当日スライドを開く"}>
            {kind === "slides" ? "スライドを開く" : "共有シートを開く"}<ExternalLink size={15} aria-hidden="true" />
          </a>
          <button type="button" className="materials-share" onClick={share}><Share2 size={15} aria-hidden="true" />このページを共有</button>
        </footer>
        {shareState === "copied" && <p className="materials-note" role="status">このページのリンクをコピーしました。</p>}
        {shareState === "manual" && <label className="materials-manual">共有用リンク
          <input readOnly value={url} onFocus={e => e.currentTarget.select()} aria-label="共有用リンク" />
        </label>}
      </div>
    </dialog>
  );
}
