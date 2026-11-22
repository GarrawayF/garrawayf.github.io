"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, LockKeyhole, X } from "lucide-react";
import { roomStorageKey } from "./board-room";
import { WORKSHEET_FIELD_LIMIT, type Worksheet } from "./worksheet";
import "./personal-notes.css";

type Round = 1 | 2 | 3 | 4;
type Note = { scene: string; text: string; context: string };
type Field = keyof Note;
type StorageState = "loading" | "saved" | "memory";
type Selection = { field: Field; start: number; end: number };

type Props = {
  initialRound: Round;
  onClose: () => void;
  onCopyToComposer: (text: string, round: Round, extra?: { worksheet?: Worksheet; context?: string }) => void;
};

const roundLabels: Record<Round, string> = {
  1: "第1回 · 牧村さん",
  2: "第2回 · 宮代さん",
  3: "第3回 · 南さん",
  4: "全体対話",
};
const rounds: Round[] = [1, 2, 3, 4];
const fields: { key: Field; label: string; hint: string; limit: number }[] = [
  { key: "scene", label: "誰の、どんな場面？", hint: "思い浮かんだ人や場面を一言", limit: WORKSHEET_FIELD_LIMIT },
  { key: "text", label: "自分の案", hint: "こんな体験があったらうれしい、など", limit: 800 },
  { key: "context", label: "共感した人の案と、その理由", hint: "どの案の、どこに共感した？", limit: 400 },
];
const emptyNote: Note = { scene: "", text: "", context: "" };
const eventKey = "shinagawa:20261124:private-note:";
const unsaved = new Map<string, string>();

function fieldKey(round: Round, field: Field) {
  // The original single text area used the round key; retain it in place.
  return roomStorageKey(eventKey + round + (field === "text" ? "" : ":" + field));
}

function readNote(round: Round) {
  const note = { ...emptyNote };
  let status: StorageState = "saved";
  for (const { key } of fields) {
    const storageKey = fieldKey(round, key);
    if (unsaved.has(storageKey)) {
      note[key] = unsaved.get(storageKey)!;
      status = "memory";
      continue;
    }
    try {
      note[key] = window.localStorage.getItem(storageKey) ?? "";
    } catch {
      status = "memory";
    }
  }
  return { note, status };
}

export default function PersonalNotes({ initialRound, onClose, onCopyToComposer }: Props) {
  const [round, setRound] = useState(initialRound);
  const [note, setNote] = useState<Note>(emptyNote);
  const [status, setStatus] = useState<StorageState>("loading");
  const [selection, setSelection] = useState<Selection | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    modal.showModal();
    return () => { if (modal.open) modal.close(); };
  }, []);

  useEffect(() => {
    const load = () => {
      const loaded = readNote(round);
      setNote(loaded.note);
      setStatus(loaded.status);
      setSelection(null);
    };
    load();
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === null || fields.some(field => event.key === fieldKey(round, field.key))) load();
    };
    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }, [round]);

  function updateNote(field: Field, value: string) {
    const key = fieldKey(round, field);
    setNote(previous => ({ ...previous, [field]: value }));
    setSelection(null);
    try {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
      unsaved.delete(key);
      setStatus(fields.some(item => unsaved.has(fieldKey(round, item.key))) ? "memory" : "saved");
    } catch {
      unsaved.set(key, value);
      setStatus("memory");
    }
  }

  const chosen = selection
    ? { ...emptyNote, [selection.field]: note[selection.field].slice(selection.start, selection.end).trim() }
    : { scene: note.scene.trim(), text: note.text.trim(), context: note.context.trim() };
  const longField = fields.find(field => chosen[field.key].length > field.limit);
  const hasContent = fields.some(field => chosen[field.key]);
  const hasNote = fields.some(field => note[field.key]);

  return (
    <dialog
      ref={dialog}
      className="private-notes"
      aria-labelledby="private-notes-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== dialog.current) return;
        const bounds = dialog.current.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <header className="private-notes-head">
        <div>
          <h2 id="private-notes-title">個人メモ</h2>
          <p><LockKeyhole size={15} aria-hidden="true" />この端末だけに保存</p>
        </div>
        <button className="private-notes-close" type="button" onClick={onClose} aria-label="個人メモを閉じる"><X size={20} aria-hidden="true" /></button>
      </header>
      <label className="private-notes-round">
        <span className="private-notes-sr">メモを書く回</span>
        <select value={round} onChange={event => { setStatus("loading"); setRound(Number(event.target.value) as Round); }}>
          {rounds.map(item => <option key={item} value={item}>{roundLabels[item]}</option>)}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </label>
      <p className="private-notes-hint">好きな欄に、一言から。</p>
      <div className="private-notes-fields">
        {fields.map(({ key, label, hint }) => (
          <label key={key} className="private-notes-field">
            <span>{label}</span>
            <textarea className="private-notes-editor" rows={2} value={note[key]} disabled={status === "loading"}
              placeholder={hint}
              onChange={event => updateNote(key, event.currentTarget.value)}
              onSelect={event => {
                const { selectionStart: start, selectionEnd: end } = event.currentTarget;
                setSelection(end > start ? { field: key, start, end } : null);
              }}/>
          </label>
        ))}
      </div>
      {status === "memory" ? (
        <p className="private-notes-warning" role="status">端末に保存できないメモがあります。このタブを閉じる前に控えてください。</p>
      ) : (
        <p className="private-notes-status" aria-live="polite">
          {status === "saved" && hasNote && <><Check size={14} aria-hidden="true" />保存済み</>}
        </p>
      )}
      {longField && <p className="private-notes-warning">「{longField.label}」は{longField.limit}文字まで投稿できます。コピーしたい部分を選択してください。</p>}
      <button
        className="private-notes-copy"
        type="button"
        disabled={!hasContent || Boolean(longField) || status === "loading"}
        onClick={() => {
          onCopyToComposer(chosen.text, round, {
            worksheet: chosen.scene ? { scene: chosen.scene } : undefined,
            context: chosen.context || undefined,
          });
          onClose();
        }}
      >
        <Copy size={16} aria-hidden="true" />{selection ? "選択範囲を投稿欄にコピー" : "投稿欄にコピー"}
      </button>
      <p className="private-notes-footnote">コピーした内容は、投稿欄で確認してから共有できます。</p>
    </dialog>
  );
}
