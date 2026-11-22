"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { roomApi, roomStorageKey } from "./board-room";
import { roundLabels, type EventRound } from "./event-round";
import { WORKSHEET_FIELD_LIMIT, type Worksheet } from "./worksheet";
import "./round-summary-sheet.css";

const teams = ["A", "B", "C", "D", "E"] as const;
type Team = typeof teams[number];
type ThemeRound = 1 | 2 | 3 | 5;
type Props = { team: Team | ""; round: EventRound; onPickTeam: (team: Team) => void; sourceIds?: readonly string[] };
type Row = {
  text: string;
  voice: string;
  id?: string;
  version?: number;
  worksheet?: Worksheet;
  savedText?: string;
  sourceIds?: string[];
  state: "draft" | "retry" | "saved";
};
type Receipt = { id: string; version: number; enteredText?: string; text: string; worksheet?: Worksheet };
const leftLabel = "品川で、誰とどんなことを試してみたい？";
const rightLabel = "きっかけになった声・体験・共感した理由";
const blank = (): Row => ({ text: "", voice: "", state: "draft" });
const newRows = () => Array.from({ length: 4 }, blank);
const memory = new Map<string, Row[]>();

function loadRows(key: string) {
  const cached = memory.get(key);
  if (cached) return cached;
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const data: unknown = JSON.parse(raw);
      if (Array.isArray(data) && data.length && data.every(row => row && typeof row.text === "string" &&
          typeof row.voice === "string" && ["draft", "retry", "saved"].includes(row.state) &&
          (row.state === "draft" || typeof row.id === "string"))) return data as Row[];
    }
  } catch { /* Memory remains available while this page is open. */ }
  return newRows();
}

function remember(scope: string, rows: Row[]) {
  memory.set(scope, rows);
  try { sessionStorage.setItem(scope, JSON.stringify(rows)); } catch { /* Use the in-memory copy. */ }
}

function fromReceipt(receipt: Receipt): Row {
  return {
    id: receipt.id, version: receipt.version,
    text: receipt.enteredText ?? receipt.text, savedText: receipt.enteredText ?? receipt.text, voice: receipt.worksheet?.voice || "",
    worksheet: receipt.worksheet || {}, state: "saved",
  };
}

function ThemeRows({ team, round, sourceIds }: { team: Team | ""; round: ThemeRound; sourceIds: readonly string[] }) {
  const scope = roomStorageKey("shinagawa:20261124:summary-rows:" + team + ":" + round);
  const [rows, setRows] = useState<Row[]>(newRows);
  const rowsRef = useRef(rows);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<Record<number, boolean>>({});
  const busy = useRef(new Set<number>());
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [conflicts, setConflicts] = useState<Record<number, Receipt | undefined>>({});
  const active = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  const focusNext = (index: number) => requestAnimationFrame(() => {
    if (active.current) container.current?.querySelector<HTMLTextAreaElement>('[data-line="' + index + '"] textarea')?.focus();
  });

  useEffect(() => {
    active.current = true;
    const stored = loadRows(scope);
    rowsRef.current = stored;
    setRows(stored);
    setReady(true);
    const receive = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== scope) return;
      const next = loadRows(scope);
      rowsRef.current = next;
      setRows(next);
    };
    window.addEventListener("shinagawa-summary-receipt", receive);
    return () => { active.current = false; window.removeEventListener("shinagawa-summary-receipt", receive); };
  }, [scope]);

  function replace(next: Row[]) {
    rowsRef.current = next;
    remember(scope, next);
    setRows(next);
  }

  function change(index: number, values: Partial<Row>) {
    replace(rowsRef.current.map((row, i) => i === index ? { ...row, ...values } : row));
    setErrors(previous => ({ ...previous, [index]: "" }));
  }

  function add() {
    const index = rowsRef.current.length;
    replace([...rowsRef.current, blank()]);
    focusNext(index);
  }

  async function save(index: number) {
    const row = rowsRef.current[index];
    if (!ready || !team || !row || row.state === "saved" || busy.current.has(index) || conflicts[index]) return;
    const text = row.text.trim(), voice = row.voice.trim();
    if ((!text && !voice) || text.length > WORKSHEET_FIELD_LIMIT || voice.length > WORKSHEET_FIELD_LIMIT) return;
    const id = row.id || crypto.randomUUID();
    const citations = row.state === "retry" ? row.sourceIds || [] : [...new Set(sourceIds)].slice(0, 2);
    const worksheet = { ...row.worksheet };
    if (voice) worksheet.voice = voice;
    else delete worksheet.voice;
    // Freeze the exact request and its ID before it leaves the device. An uncertain
    // response is retried with identical content, even after switching team/round.
    busy.current.add(index);
    change(index, { id, sourceIds: citations, state: "retry" });
    setPending(previous => ({ ...previous, [index]: true }));
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    try {
      const body = row.version === undefined
        ? { id, text, worksheet, team, round, sourceIdeaId: citations[0] || null, sourceIdeaId2: citations[1] || null }
        : { id, text, worksheet, version: row.version };
      const response = await fetch(roomApi("/api/themes"), {
        method: row.version === undefined ? "POST" : "PATCH", credentials: "omit",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal,
      });
      const data = await response.json() as { theme?: Receipt; error?: string };
      if (!active.current) {
        // The attendee may have switched team or round while the request was running.
        const stored = loadRows(scope);
        const line = stored[index];
        if (response.ok && data.theme?.id === id && line?.id === id && line.state === "retry" && line.version === row.version) {
          const next = stored.map((item, i) => i === index ? fromReceipt(data.theme!) : item);
          if (next.every(item => item.state !== "draft" || item.text || item.voice)) next.push(blank());
          remember(scope, next);
          window.dispatchEvent(new CustomEvent("shinagawa-summary-receipt", { detail: scope }));
        }
        return;
      }
      if (response.status === 409 && data.theme && row.version !== undefined) {
        setConflicts(previous => ({ ...previous, [index]: data.theme }));
        setErrors(previous => ({ ...previous, [index]: "別の人がこの行を更新しました。最新の内容を確認してください。" }));
        return;
      }
      if (!response.ok || !data.theme || data.theme.id !== id) {
        if (response.status === 400 || response.status === 413) change(index, { state: "draft" });
        throw new Error(data.error || "保存を確認できませんでした。");
      }
      const next = rowsRef.current.map((item, i) => i === index ? fromReceipt(data.theme!) : item);
      let nextIndex = next.findIndex((item, i) => i > index && item.state === "draft" && !item.text && !item.voice);
      if (nextIndex < 0) {
        nextIndex = next.findIndex(item => item.state === "draft" && !item.text && !item.voice);
        if (nextIndex < 0) { nextIndex = next.length; next.push(blank()); }
      }
      replace(next);
      const focused = document.activeElement;
      if (!focused || focused === document.body || focused.closest("[data-line]")?.getAttribute("data-line") === String(index)) {
        focusNext(nextIndex);
      }
    } catch (error) {
      if (active.current) setErrors(previous => ({ ...previous, [index]:
        error instanceof Error && error.name !== "TypeError" && error.name !== "AbortError"
          ? error.message : "保存を確認できませんでした。入力は残っています。" }));
    } finally {
      clearTimeout(timer);
      busy.current.delete(index);
      if (active.current) setPending(previous => ({ ...previous, [index]: false }));
    }
  }

  return <div ref={container}>
    <div className="rs-head" aria-hidden="true"><span>{leftLabel}</span><span>{rightLabel}</span></div>
    <div className="rs-table">
      {rows.map((row, i) => {
        const filled = Boolean(row.text.trim() || row.voice.trim());
        const invalid = row.text.trim().length > WORKSHEET_FIELD_LIMIT || row.voice.trim().length > WORKSHEET_FIELD_LIMIT;
        const frozen = row.state !== "draft";
        const conflict = conflicts[i];
        return <div className={"rs-line" + (row.state === "saved" ? " rs-saved" : "")} key={i} data-line={i}>
          <div className="rs-pair">{(["text", "voice"] as const).map((field, column) => {
            const label = column === 0 ? leftLabel : rightLabel;
            return <label className="rs-cell" key={field}>
              <span className="rs-cell-title">{label}</span>
              <textarea rows={2} aria-label={(i + 1) + "行目 " + label} value={row[field]} readOnly={frozen}
                disabled={!team || !ready} onChange={event => change(i, { [field]: event.currentTarget.value })}/>
            </label>;
          })}</div>
          {(filled || frozen || row.version !== undefined) && <div className="rs-actions">
            <span className="rs-status" role="status">{pending[i] ? "保存中…" : row.state === "saved"
              ? <><Check size={14} aria-hidden="true" />保存済み</> : (errors[i] || (invalid
                ? "各欄を800文字以内にしてください。" : row.state === "retry" ? "保存結果を確認してください。" : ""))}</span>
            {row.version !== undefined && row.state === "draft" && <button type="button" className="rs-edit"
              onClick={() => change(i, { text: row.savedText ?? "", voice: row.worksheet?.voice || "", state: "saved" })}>編集を取り消す</button>}
            {conflict ? <div className="rs-conflict">
              <p>最新の挑戦テーマ　{(conflict.enteredText ?? conflict.text) || "（空欄）"}</p>
              <p>最新のきっかけ　{conflict.worksheet?.voice || "（空欄）"}</p>
              <button type="button" onClick={() => { change(i, { version: conflict.version, worksheet: conflict.worksheet, savedText: conflict.enteredText ?? conflict.text, state: "draft" }); setConflicts(previous => ({ ...previous, [i]: undefined })); }}>自分の入力を見直す</button>
              <button type="button" onClick={() => { change(i, fromReceipt(conflict)); setConflicts(previous => ({ ...previous, [i]: undefined })); }}>最新の内容を使う</button>
            </div> : row.state === "saved"
              ? <button type="button" className="rs-edit" onClick={() => { change(i, { state: "draft" }); focusNext(i); }}>編集</button>
              : <button type="button" className="rs-save" disabled={!team || pending[i] || invalid || !filled}
                  onClick={() => void save(i)}>{row.state === "retry" && !pending[i] ? "もう一度保存" : "この行を共有"}</button>}
          </div>}
        </div>;
      })}
    </div>
    <button type="button" className="rs-add" disabled={!ready || !team} onClick={add}><Plus size={16} aria-hidden="true"/>行を追加</button>
  </div>;
}

export default function RoundSummarySheet({ team, round, onPickTeam, sourceIds = [] }: Props) {
  const titleId = useId();
  const targetRound = round === 4 ? 5 : round;
  const label = round === 4 ? "3講演を通したまとめ" : roundLabels[round];
  return <section className="round-summary" aria-labelledby={titleId}>
    <h2 id={titleId}><span>最後の5分</span>個人の案を確認し、班の挑戦テーマも並べる</h2>
    {team ? <p className="rs-scope"><b>{team}班 · {label}</b>　どちらか一方でも、1行ずつ共有できます。</p>
      : <div className="rs-picker"><span>共有する班を選ぶ</span><div>{teams.map(group =>
        <button key={group} type="button" onClick={() => onPickTeam(group)}>{group}班</button>)}</div></div>}
    <ThemeRows key={team + targetRound} team={team} round={targetRound} sourceIds={sourceIds}/>
  </section>;
}
