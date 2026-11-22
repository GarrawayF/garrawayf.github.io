"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, CornerDownRight, Monitor, Pencil, Send, X } from "lucide-react";
import { pageLink, publicBoardUrl, roomStorageKey } from "./board-room";
import { eventRoundAt } from "./event-round";
import { groupLabel, mapGroups, stageLabel, type MapGroup, type MapIdea, type MapTheme } from "./mind-map-model";
import RoundSummarySheet from "./round-summary-sheet";
import TeamThemes, { type ThemeFeed } from "./team-themes";
import TeamReference from "./team-reference";
import { draftFromTheme, saveTheme, type SavedTheme, type ThemeDraft } from "./theme-writer";
import WorksheetFields, { WorksheetReadout } from "./worksheet-fields";
import { cleanWorksheet, hasWorksheetContent } from "./worksheet";
import "./team-summary-workspace.css";

type Group = MapGroup | "";
type Stage = MapTheme["round"];
type Scope = { team: Group; round: Stage };
type Props = {
  ideas: readonly MapIdea[]; hasLoaded: boolean; loadError?: boolean;
  initialTeam?: string; initialRound?: string | number; source?: string;
  onScopeChange?: (team: Group, round: number) => void;
};
type StoredDraft = ThemeDraft & { pending?: boolean };
const cache = new Map<string, StoredDraft>();
const stages = [1, 2, 3, 5] as const;
const scopeStore = "shinagawa:summary-workspace:scope";
const groupValue = (s: unknown): Group => mapGroups.find(t => t === s) || "";
function stageValue(n: unknown, team: Group): Stage {
  if (team === "all") return 4;
  if (Number(n) === 4) return 5;
  return stages.find(value => value === Number(n)) || 1;
}
const blank = ({ team, round }: Scope): StoredDraft => ({
  team, round, text: "", worksheet: {}, id: "", version: null, sourceIdeaId: "", sourceIdeaId2: "",
});
function stored(key: string, seed: StoredDraft): StoredDraft {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.team === seed.team && data.round === seed.round && typeof data.text === "string" && typeof data.id === "string" &&
          (seed.version === null ? data.version === null : data.id === seed.id && Number.isInteger(data.version) && data.version > 0)) {
        return { ...seed, text: data.text, worksheet: cleanWorksheet(data.worksheet), id: data.id, version: data.version,
          sourceIdeaId: typeof data.sourceIdeaId === "string" ? data.sourceIdeaId : "",
          sourceIdeaId2: typeof data.sourceIdeaId2 === "string" ? data.sourceIdeaId2 : "", pending: data.pending === true };
      }
    }
  } catch { /* Browsers can limit persistent storage. */ }
  return cache.get(key) || seed;
}
function keep(key: string, draft: StoredDraft | null) {
  if (draft) cache.set(key, draft); else cache.delete(key);
  try { if (draft) localStorage.setItem(key, JSON.stringify(draft)); else localStorage.removeItem(key); return true; } catch { return false; }
}

type EditorProps = Pick<Props, "ideas" | "hasLoaded" | "loadError"> & {
  scope: Scope; existing?: SavedTheme; source: string; feed: ThemeFeed;
  onBusy: (busy: boolean) => void; onSaved: (theme: SavedTheme) => void;
};
function ScopedEditor({ scope, existing, source, feed, ideas, hasLoaded, loadError, onBusy, onSaved }: EditorProps) {
  const key = roomStorageKey("shinagawa:summary-workspace:draft:" + (existing ? "edit:" + existing.id : scope.team + ":" + scope.round));
  const [draft, setDraft] = useState<StoredDraft>(() => existing ? draftFromTheme(existing) : blank(scope));
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"references" | "write">("write");
  const [saving, setSaving] = useState(false);
  const writing = useRef(false);
  const [conflict, setConflict] = useState<SavedTheme | null>(null);
  const [error, setError] = useState("");
  const [memoryOnly, setMemoryOnly] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const columns = useRef<HTMLDivElement>(null);
  const seed = useRef(draft);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    setDraft(stored(key, seed.current));
    setReady(true);
    return () => { alive.current = false; };
  }, [key]);

  const citeIds = [draft.sourceIdeaId, draft.sourceIdeaId2].filter(Boolean);
  const editMode = draft.version !== null;
  const frozen = !ready || saving || Boolean(draft.pending);
  const stageMode = scope.team === "all" ? "plenary" : scope.round === 5 ? "summary" : "work";
  const label = scope.team === "all" ? "会場で加えたい挑戦テーマ" : scope.round === 5 ? "発表で紹介したい挑戦テーマ" : "品川で、誰とどんなことを試してみたい？";
  const selectedThemes = feed.themes.filter(row => row.team === scope.team && row.round === scope.round);
  const readyMessage = editMode ? "変更を保存" : scope.team === "all" ? "全体の案を共有" : "班のまとめを共有";
  const canSave = draft.text.trim() || hasWorksheetContent(draft.worksheet);

  function change(changes: Partial<StoredDraft>) {
    if (writing.current) return;
    const next = { ...draft, ...changes };
    setMemoryOnly(!keep(key, next)); setDraft(next); setError("");
  }
  function quote(id: string) {
    if (frozen || editMode) return;
    if (!citeIds.includes(id) && citeIds.length === 2) return;
    const next = citeIds.includes(id) ? citeIds.filter(other => other !== id) : [...citeIds, id];
    change({ sourceIdeaId: next[0] || "", sourceIdeaId2: next[1] || "" });
  }
  function writeHere() {
    setTab("write");
    requestAnimationFrame(() => {
      panel.current?.querySelector<HTMLTextAreaElement>(".sw-main-text")?.focus({ preventScroll: true });
      panel.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
  function switchPanel(next: "references" | "write") {
    setTab(next);
    requestAnimationFrame(() => {
      if (columns.current && columns.current.getBoundingClientRect().top < 0) columns.current.scrollIntoView({ block: "start" });
    });
  }
  async function share(event: FormEvent) {
    event.preventDefault();
    if (writing.current || !ready || !scope.team || conflict || !canSave) return;
    const request = { ...draft, id: draft.id || crypto.randomUUID(), pending: true };
    setMemoryOnly(!keep(key, request)); setDraft(request);
    writing.current = true; setSaving(true); onBusy(true); setError("");
    try {
      const result = await saveTheme(request);
      if (result.status === "rejected") {
        const restored = { ...request, pending: false, id: editMode ? request.id : "" };
        keep(key, restored);
        if (alive.current) { setDraft(restored); setError(result.message); }
      } else if (result.status === "conflict") {
        const restored = { ...request, pending: false };
        keep(key, restored);
        if (alive.current) { setDraft(restored); setConflict(result.theme); setError("別の人が更新しました。両方の内容を確認してください。"); }
      } else {
        keep(key, null);
        if (alive.current) { setDraft(blank(scope)); onSaved(result.theme); }
      }
    } catch {
      if (alive.current) setError("通信が途切れたため、保存結果を確認できません。同じ内容でもう一度確認できます。");
    } finally {
      writing.current = false;
      if (alive.current) { setSaving(false); onBusy(false); }
    }
  }

  return <>
    <div className="sw-mobile-switch" role="group" aria-label="画面を切り替える">
      <button type="button" aria-pressed={tab === "references"} onClick={() => switchPanel("references")}><BookOpen size={16}/>参考を見る</button>
      <button type="button" aria-pressed={tab === "write"} onClick={() => switchPanel("write")}><Pencil size={16}/>まとめを書く</button>
    </div>
    <div className="sw-columns" data-panel={tab} ref={columns}>
      <aside className="sw-references" aria-label="まとめに使う資料">
        <TeamReference team={scope.team} round={scope.round} ideas={ideas} themes={feed.themes}
          ideasLoaded={hasLoaded} themesLoaded={feed.loaded} loadError={Boolean(loadError || feed.unavailable)}
          quotedIds={citeIds} onToggleQuote={quote} quotesLocked={frozen || editMode}/>
        <button type="button" className="sw-switch-write" onClick={writeHere}>{citeIds.length ? "選んだ投稿で書く" : "まとめを書く"}<ArrowRight size={16}/></button>
      </aside>
      <section ref={panel} className="sw-editor" aria-labelledby="summary-form-title">
        <h2 id="summary-form-title">{scope.team === "all" ? "全体の案" : scope.team + "班のまとめ"}{editMode ? "を編集" : "を書く"}</h2>
        <p className="sw-stage">{stageLabel(scope.round)}</p>
        <form onSubmit={share}>
          <label className="sw-main-label" htmlFor="summary-theme-text">{label}</label>
          <textarea className="sw-main-text" id="summary-theme-text" value={draft.text} maxLength={800} rows={4} disabled={frozen}
            placeholder="この欄、またはシートのどれか一つに書いてください。" onChange={e => change({ text: e.target.value })}/>
          <WorksheetFields mode={stageMode} values={draft.worksheet} disabled={frozen} onChange={worksheet => change({ worksheet })}/>
          <div className="sw-citations">
            <div className="sw-citation-head"><b><CornerDownRight size={14}/>元になった個人案</b><small>{citeIds.length} / 2件</small></div>
            {citeIds.length ? citeIds.map(id => {
              const item = ideas.find(row => row.id === id);
              return <div className="sw-citation" key={id}><span>{item ? item.team + "班 · " + (item.analysis?.title || item.text) : "元の投稿"}</span>
                {!editMode && <button type="button" disabled={frozen} aria-label="引用から外す" onClick={() => quote(id)}><X size={16}/></button>}</div>;
            }) : <p>参考一覧から2件まで選べます。<button type="button" className="sw-open-reference" onClick={() => switchPanel("references")}>参考を見る</button></p>}
          </div>
          {error && <p className="sw-error" role="alert">{error}</p>}
          {conflict && <div className="sw-conflict"><strong>現在共有されている内容</strong><p>{conflict.enteredText ?? conflict.text}</p>
            <WorksheetReadout mode={stageMode} values={conflict.worksheet}/>
            <button type="button" onClick={() => { change(draftFromTheme(conflict)); setConflict(null); }}>共有中の内容を使う</button>
            <button type="button" onClick={() => { change({ version: conflict.version }); setConflict(null); }}>自分の下書きから続ける</button>
          </div>}
          <div className="sw-submit-row"><small>{saving ? "保存中…" : memoryOnly ? "このタブで下書きを保持しています。閉じる前に共有してください。" : draft.pending ? "確認が終わるまで入力内容を保管します。" : canSave || citeIds.length ? "下書きをこの端末に保存" : "共有すると、発表画面に追加されます。"}</small>
            <button type="submit" disabled={!ready || saving || !canSave || Boolean(conflict)}><Send size={16}/>{saving ? "保存中…" : draft.pending ? "保存結果を確認" : readyMessage}</button>
          </div>
        </form>
        {selectedThemes.length > 0 && <details className="sw-saved-list"><summary>この回の共有済みテーマ（{selectedThemes.length}件）</summary>
          {selectedThemes.map(row => <a key={row.id} href={pageLink(source, { view: "summary", write: "edit", team: row.team === "all" ? "" : row.team, themeId: row.id, round: String(row.round) })}><span>{row.analysis?.title || row.text}</span><span><Pencil size={13}/>編集</span></a>)}
        </details>}
        {scope.team && scope.team !== "all" && !editMode && <details className="sw-multiple"><summary>複数のテーマを表で書く</summary>
          {citeIds.length > 0 && <p className="sw-rows-caption">新しく共有する行に、選択した{citeIds.length}件の元案を紐づけます。</p>}
          <RoundSummarySheet team={scope.team} round={scope.round === 5 ? 4 : scope.round} onPickTeam={() => {}} sourceIds={citeIds}/>
        </details>}
      </section>
    </div>
  </>;
}

export default function TeamSummaryWorkspace({ ideas, hasLoaded, loadError, initialTeam, initialRound, source = "", onScopeChange }: Props) {
  const firstTeam = groupValue(initialTeam);
  const [scope, setScope] = useState<Scope>({ team: firstTeam, round: stageValue(initialRound, firstTeam) });
  const [editId, setEditId] = useState("");
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [feed, setFeed] = useState<ThemeFeed>({ themes: [], loaded: false, unavailable: false });
  const [receipt, setReceipt] = useState<SavedTheme | null>(null);
  const init = useRef({ initialTeam, initialRound });
  const workspace = useRef<HTMLDivElement>(null);
  const existing = editId ? feed.themes.find(row => row.id === editId) : undefined;

  useEffect(() => {
    const header = document.querySelector(".board-header");
    if (!header || !workspace.current) return;
    const measure = () => workspace.current?.style.setProperty("--sw-header-height", header.getBoundingClientRect().height + "px");
    measure();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    let previous: Partial<Scope> = {};
    try { previous = JSON.parse(localStorage.getItem(roomStorageKey(scopeStore)) || "{}") || {}; } catch { /* Optional saved choice. */ }
    const team = url.searchParams.get("write") === "plenary" ? "all" : groupValue(url.searchParams.get("team")) || groupValue(init.current.initialTeam) || groupValue(previous.team);
    const round = url.searchParams.get("round") || (previous.team === team ? previous.round : undefined) || init.current.initialRound || eventRoundAt();
    setScope({ team, round: stageValue(round, team) });
    if (url.searchParams.get("write") === "edit") setEditId(url.searchParams.get("themeId") || url.searchParams.get("id") || "");
    setReady(true);
  }, []);
  useEffect(() => {
    const inherited = groupValue(initialTeam);
    if (ready && !scope.team && !editId && inherited) {
      setScope({ team: inherited, round: stageValue(initialRound, inherited) });
    }
  }, [ready, scope.team, editId, initialTeam, initialRound]);
  const team = existing?.team || scope.team;
  const round = existing?.round || scope.round;
  useEffect(() => {
    if (ready && (!editId || existing)) onScopeChange?.(team, round);
  }, [ready, editId, existing, team, round, onScopeChange]);

  function navigate(next: Scope) {
    if (blocked) return;
    setEditId(""); setScope(next); setReceipt(null);
    try { localStorage.setItem(roomStorageKey(scopeStore), JSON.stringify(next)); } catch { /* The URL also records the scope. */ }
    const href = pageLink(window.location.href, { view: "summary", team: next.team === "all" ? "" : next.team, round: String(next.round), write: next.team === "all" ? "plenary" : "" });
    try { window.history.replaceState(window.history.state, "", href); } catch { if (window.location.protocol === "file:") window.location.assign(href); }
  }
  const receive = useCallback((value: SavedTheme) => {
    const next = { team: value.team, round: value.round };
    setScope(next); setEditId(""); setReceipt(value);
    const href = pageLink(window.location.href, { view: "summary", team: value.team === "all" ? "" : value.team, write: value.team === "all" ? "plenary" : "", round: String(value.round) });
    try { window.history.replaceState(window.history.state, "", href); } catch { /* The receipt link also includes the saved scope. */ }
  }, []);
  const availableFeed = receipt && !feed.themes.some(row => row.id === receipt.id && row.version >= receipt.version)
    ? { ...feed, themes: [receipt, ...feed.themes.filter(row => row.id !== receipt.id)] } : feed;
  const address = source || (typeof window === "undefined" ? publicBoardUrl : window.location.href);
  const loadingEdit = editId && !existing;
  return <div className="team-summary-workspace" ref={workspace}>
    <TeamThemes projection feedOnly team="all" onFeedChange={setFeed}/>
    <div className="sw-scope">
      <fieldset disabled={!ready || blocked}><legend>まとめる班</legend>
        <div className="sw-groups">{mapGroups.map(group => <button key={group} type="button" aria-pressed={group === team}
          onClick={() => navigate({ team: group, round: stageValue(round, group) })}>{group === "all" ? "全体対話" : groupLabel(group)}</button>)}</div>
      </fieldset>
      {team && team !== "all" && <label className="sw-round"><span>対象の回</span><span><select value={round} disabled={!ready || blocked}
        onChange={event => navigate({ team, round: stageValue(event.target.value, team) })}>{stages.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select><ChevronDown size={15}/></span></label>}
    </div>
    {receipt && <div className="sw-receipt" role="status"><Check size={17}/>
      <span>{groupLabel(receipt.team)}の{receipt.team === "all" ? "案" : "まとめ"}を共有しました。</span>
      <a href={pageLink(address, { view: "screen", team: receipt.team === "all" ? "" : receipt.team }, "theme-" + receipt.id)}><Monitor size={15}/>発表を見る</a>
    </div>}
    {loadingEdit ? <div className="sw-empty" role="status"><h2>{feed.loaded ? "編集するまとめが見つかりません" : feed.unavailable ? "まとめを読み込めません" : "編集するまとめを読み込み中…"}</h2>
      <a href={pageLink(address, { view: "screen", team: team === "all" ? "" : team })}>発表画面に戻る</a></div> :
      !team || !ready ? <div className="sw-empty"><BookOpen size={25}/><h2>{ready ? "まとめる班を選んでください" : "まとめる班を確認しています…"}</h2>
        <p>班を選ぶと、投稿を見ながら挑戦テーマを書けます。</p></div> :
      <ScopedEditor key={editId || team + ":" + round} scope={{ team, round }} existing={existing}
        source={address} feed={availableFeed} ideas={ideas} hasLoaded={hasLoaded} loadError={loadError} onBusy={setBlocked} onSaved={receive}/>}
  </div>;
}
