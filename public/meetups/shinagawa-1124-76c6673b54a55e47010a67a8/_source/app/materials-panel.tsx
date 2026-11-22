"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Pencil, Share2, X, ZoomIn, ZoomOut } from "lucide-react";
import { materials } from "./materials-data";
import { assetUrl } from "./asset-url";
import "./materials-panel.css";

type DeckKey = keyof typeof materials;
type Round = 1 | 2 | 3 | 4;
type PanelProps = {
  onClose: () => void;
  round?: number;
  initialDeck?: DeckKey;
  onStartIdea?: (round: Round) => void;
  onStartNote?: () => void;
};

const sheetRounds: Partial<Record<number, Round>> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 4 };

export default function MaterialsPanel({ onClose, round, initialDeck, onStartIdea, onStartNote }: PanelProps) {
  const [kind, setKind] = useState<DeckKey>(initialDeck ?? (round ? "worksheets" : "slides"));
  const [positions, setPositions] = useState({ slides: 0, worksheets: round === 4 ? 6 : round && round >= 1 && round <= 3 ? round + 1 : 0 });
  const [zoomed, setZoomed] = useState(false);
  const [shareState, setShareState] = useState<"copied" | "manual" | "idle">("idle");
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const heading = useId();
  const deck = materials[kind];
  const index = positions[kind];
  const slide = deck.slides[index];
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
            <img src={assetUrl(`/slides/${deck.file}-${index + 1}.webp`)} alt={`${deck.label} ${index + 1}枚目：${slide.title}`}
              key={kind + activeSlideId} width={kind === "slides" ? 1280 : 1682} height={kind === "slides" ? 720 : 1190}
              decoding="async" draggable={false} />
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
