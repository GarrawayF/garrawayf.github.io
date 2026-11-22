"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { BookOpen, Check, ChevronDown, ChevronRight, CircleAlert, CornerDownRight, Link2, Monitor, Pencil, QrCode, Send, X, NotebookPen, Presentation, Users } from "lucide-react";
import { boardViewOf, isDemoRoom, pageLink, roomApi, roomStorageKey } from "./board-room";
import { assetUrl } from "./asset-url";
import MaterialsPanel from "./materials-panel";
import PersonalNotes from "./personal-notes";
import DiscussionGuide from "./discussion-guide";
import IdeaWorksheet from "./idea-worksheet";
import MindMap from "./mind-map";
import TeamOutputs, { boardLocation, joinTeamUrl } from "./team-outputs";
import TeamThemes, { type ThemeFeed } from "./team-themes";
import TeamSummaryWorkspace from "./team-summary-workspace";
import KeywordsPanel from "./keywords-panel";
import { alignDraftRound, eventRoundAt, hasDraftWork, roundLabels as rounds } from "./event-round";
import { cleanWorksheet, hasWorksheetContent, WORKSHEET_FIELD_LIMIT, WORKSHEET_KEYS, type Worksheet } from "./worksheet";
import PresentationGallery from "./presentation-gallery";
import { IdeaVisualProvider } from "./idea-visual";
import { CommentProvider } from "./post-comments";
import type { PostAnalysis } from "./post-analysis";
import { ReactionProvider } from "./reactions";
import "./board-controls.css";

const teams = ["A", "B", "C", "D", "E"] as const;
type Team = (typeof teams)[number];
type Round = 1 | 2 | 3 | 4;
const projectionRounds = { ...rounds, 5: "3講演を通したまとめ" };
type ProjectionRound = Round | 5 | 0;
const roundChoices: Record<Round, string> = { 1: "第1回 牧村和彦さん", 2: "第2回 宮代陽之さん", 3: "第3回 南奈津子さん", 4: "全体対話" };
const storageKey = "shinagawa:20261124:draft";
const apiURL = () => roomApi("/api/ideas");
type Idea = {
  id: string; team: Team; round: Round; text: string; context: string; name: string;
  parentId: string | null; createdAt: string; enteredText?: string; worksheet?: Worksheet; analysis?: PostAnalysis;
};
type Draft = {
  id: string; team: Team | ""; round: Round; text: string; context: string; name: string;
  parentId: string | null; parentText: string; manualRoundSlot?: Round | null; worksheet: Worksheet;
};
const emptyDraft: Draft = { id: "", team: "", round: 1, text: "", context: "", name: "", parentId: null, parentText: "", worksheet: {} };
type NoteFields = { worksheet?: Worksheet; context?: string };

function appendNote(current: string, incoming?: string): string {
  if (!incoming?.trim() || incoming === current) return current;
  return current.trim() ? current + "\n\n" + incoming : incoming;
}

function contentIssue(draft: Draft): string {
  if (!draft.text.trim() && !draft.context.trim() && !hasWorksheetContent(draft.worksheet)) return "書きやすい欄に一つ入力してください。";
  if (draft.text.length > 800) return "アイデアは800文字以内にしてください。";
  if (draft.context.length > 400) return "きっかけ・共感した理由は400文字以内にしてください。";
  if (Object.values(draft.worksheet).some(value => value.length > WORKSHEET_FIELD_LIMIT)) return "シートの各項目を800文字以内にしてください。";
  return "";
}

function restoreDraft(): Draft {
  try {
    const data = JSON.parse(window.localStorage.getItem(roomStorageKey(storageKey)) || "null");
    if (!data || typeof data !== "object") return emptyDraft;
    const record = { ...emptyDraft };
    for (const key of ["id", "text", "context", "name", "parentText"] as const) {
      if (typeof data[key] === "string") record[key] = data[key];
    }
    record.team = teams.includes(data.team) ? data.team : "";
    record.round = [1, 2, 3, 4].includes(data.round) ? data.round : 1;
    record.parentId = typeof data.parentId === "string" ? data.parentId : null;
    record.worksheet = cleanWorksheet(data.worksheet);
    if (data.manualRoundSlot === null || [1, 2, 3, 4].includes(data.manualRoundSlot)) record.manualRoundSlot = data.manualRoundSlot;
    return record;
  } catch { return emptyDraft; }
}

function createId(): string {
  if (typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, n => n.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

function storeDraft(draft: Draft) {
  try { window.localStorage.setItem(roomStorageKey(storageKey), JSON.stringify(draft)); } catch { /* Private browsing can disable draft storage. */ }
}

function SelectField({ label, children, value, onChange, required = false }: {
  label: string; children: ReactNode; value: string | number;
  onChange: (value: string) => void; required?: boolean;
}) {
  return <label className="field">
    <span>{label}</span>
    <span className="select-wrap"><select required={required} value={value} onChange={e => onChange(e.target.value)}>{children}</select><ChevronDown aria-hidden="true" size={15} /></span>
  </label>;
}

function Brand({ source }: { source: string }) {
  const demo = isDemoRoom(source);
  return <div className="brand">
    <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
    <span className="brand-type"><b>X-meetup<span>品川</span></b></span>
    {demo && <span className="demo-room-label">テスト会場</span>}
  </div>;
}

type Sync = "loading" | "live" | "error" | "offline";
const syncLabels: Record<Sync, string> = { loading: "接続中", live: "ライブ", error: "再接続中", offline: "オフライン" };

type BoardInitialView = {
  initialRoom?: string; initialSource?: string; initialView?: string; initialWrite?: string; initialTeam?: string; initialTab?: string; initialRound?: string;
};

export default function DiscussionBoard(props: BoardInitialView = {}) {
  return <ReactionProvider><CommentProvider><BoardContents {...props} /></CommentProvider></ReactionProvider>;
}

function BoardContents({ initialRoom, initialSource, initialView, initialWrite, initialTeam, initialTab, initialRound }: BoardInitialView) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [themeFeed, setThemeFeed] = useState<ThemeFeed>({ themes: [], loaded: false, unavailable: false });
  const [hasLoaded, setHasLoaded] = useState(false);
  const [sync, setSync] = useState<Sync>("loading");
  const [view, setView] = useState(() => boardViewOf(initialView, initialWrite));
  const screen = view === "screen";
  const personal = view === "personal";
  const [summaryScope, setSummaryScope] = useState<{ team: Team | "all" | ""; round: number }>(() => ({
    team: initialWrite === "plenary" ? "all" : teams.find(t => t === initialTeam) || "",
    round: Number(initialRound) || 0,
  }));
  const onSummaryScope = useCallback((team: Team | "all" | "", round: number) => {
    setSummaryScope(previous => previous.team === team && previous.round === round ? previous : { team, round });
  }, []);
  const summaryTeam = summaryScope.team === "all" ? "" : summaryScope.team;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [extras, setExtras] = useState(false);
  const [boardView, setBoardView] = useState<"list" | "map" | "words">(initialTab === "map" || initialTab === "words" ? initialTab : "list");
  const [team, setTeam] = useState<Team | "">(teams.find(t => t === initialTeam) || "");
  const [round, setRound] = useState<ProjectionRound>(Object.hasOwn(projectionRounds, Number(initialRound)) ? Number(initialRound) as ProjectionRound : 0);
  const [share, setShare] = useState(false);
  const [tool, setTool] = useState<"slides" | "notes" | "guide" | null>(null);
  const [sourceHref, setSourceHref] = useState(initialSource || (initialRoom === "demo" ? "?room=demo" : ""));
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ message: string; ideaId?: string } | null>(null);
  const [replyId, setReplyId] = useState("");
  const [offerMemoJump, setOfferMemoJump] = useState(false);
  const currentDraft = useRef<Draft>(emptyDraft);
  const input = useRef<HTMLTextAreaElement>(null);
  const eventTools = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const shareDialog = useRef<HTMLDialogElement>(null);
  const inflight = useRef(false);
  const syncSeq = useRef(0);
  const submitGuard = useRef(false);
  const lastPost = useRef<Idea | null>(null);
  const entityTag = useRef("");

  useEffect(() => {
    const page = new URL(window.location.href);
    const enteringTeam = page.searchParams.get("join") as Team | null;
    let saved = alignDraftRound(restoreDraft());
    if (enteringTeam && teams.includes(enteringTeam) && (!saved.team || !hasDraftWork(saved))) {
      saved = { ...saved, team: enteringTeam };
    }
    currentDraft.current = saved;
    storeDraft(saved);
    setDraft(saved);
    setExtras(Boolean(saved.context));
    setSourceHref(page.href);
    const requested = boardViewOf(page.searchParams.get("view"), page.searchParams.get("write"), page.hash);
    setView(requested);
    const initialTab = page.searchParams.get("tab");
    const initialTeam = page.searchParams.get("team");
    const initialRound = Number(page.searchParams.get("round"));
    if (initialTab === "map" || initialTab === "words") setBoardView(initialTab);
    if (teams.includes(initialTeam as Team)) setTeam(initialTeam as Team);
    if (Object.hasOwn(projectionRounds, initialRound)) setRound(initialRound as ProjectionRound);
    if (requested === "personal") setReplyId(page.searchParams.get("reply") || "");
    setHydrated(true);
  }, []);

  const replaceDraft = useCallback((next: Draft) => {
    currentDraft.current = next;
    storeDraft(next);
    setDraft(next);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const align = () => {
      if (document.hidden) return;
      const previous = currentDraft.current;
      const next = alignDraftRound(previous);
      if (next !== previous) replaceDraft(next);
    };
    const timer = window.setInterval(align, 15000);
    document.addEventListener("visibilitychange", align);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", align); };
  }, [hydrated, replaceDraft]);

  useEffect(() => {
    if (!form.current || !personal || typeof IntersectionObserver !== "function") return;
    const memoObserver = new IntersectionObserver(([entry]) => {
      setOfferMemoJump(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    if (eventTools.current) memoObserver.observe(eventTools.current);
    return () => memoObserver.disconnect();
  }, [personal]);

  useEffect(() => {
    if (!hydrated || !screen) return;
    const current = window.location.href;
    const url = new URL(boardLocation(current, screen, { tab: boardView, team, round }));
    if (boardView !== "list") {
      url.searchParams.delete("idea");
      url.searchParams.delete("thread");
      if (url.hash.startsWith("#theme-")) url.hash = "";
    }
    const next = url.href;
    if (next !== current) {
      try { window.history.replaceState(window.history.state, "", next); }
      catch { if (window.location.protocol === "file:") window.location.replace(next); }
    }
  }, [hydrated, screen, boardView, team, round]);

  const refresh = useCallback(async () => {
    if (inflight.current || document.hidden) return;
    if (!window.navigator.onLine) { setSync("offline"); return; }
    inflight.current = true;
    const version = syncSeq.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(apiURL(), {
        cache: "no-store", signal: controller.signal,
        headers: entityTag.current ? { "If-None-Match": entityTag.current } : {},
      });
      if (response.status === 304) { setSync("live"); return; }
      if (!response.ok) throw new Error("read");
      const payload: { ideas: Idea[] } = await response.json();
      if (!Array.isArray(payload.ideas)) throw new Error("format");
      if (version !== syncSeq.current) return;
      entityTag.current = response.headers.get("ETag") || "";
      const received = payload.ideas;
      const posted = lastPost.current;
      if (posted && !received.some(i => i.id === posted.id)) received.push(posted);
      else if (posted) lastPost.current = null;
      setIdeas(received);
      setHasLoaded(true);
      setSync("live");
    } catch {
      if (version === syncSeq.current) setSync(window.navigator.onLine ? "error" : "offline");
    } finally { clearTimeout(timeout); inflight.current = false; }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 3000);
    const offline = () => setSync("offline");
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", offline);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", offline);
    };
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.ideaId ? 7000 : 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (share && !shareDialog.current?.open) shareDialog.current?.showModal();
    if (!share && shareDialog.current?.open) shareDialog.current?.close();
  }, [share]);

  const update = (changes: Partial<Draft>) => {
    setError("");
    replaceDraft({ ...currentDraft.current, ...changes, id: "" });
  };

  const clearReplyLink = useCallback(() => {
    setReplyId("");
    const url = new URL(window.location.href);
    url.searchParams.delete("reply");
    try { window.history.replaceState(window.history.state, "", url.href); } catch { /* Local HTML may restrict history updates. */ }
  }, []);

  const acceptReply = useCallback((source: Idea) => {
    const previous = currentDraft.current;
    if (previous.parentId !== source.id) replaceDraft({ ...previous, parentId: source.id, parentText: source.text, id: "" });
    clearReplyLink();
    setError("");
  }, [clearReplyLink, replaceDraft]);

  const replySource = replyId ? ideas.find(idea => idea.id === replyId) : undefined;
  useEffect(() => {
    if (!replySource || !personal) return;
    const current = currentDraft.current;
    if (!hasDraftWork(current) || current.parentId === replySource.id) acceptReply(replySource);
  }, [replySource, personal, acceptReply]);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitGuard.current || replyId) return;
    if (!draft.team) { setError("自分の班を選んでください。"); return; }
    const problem = contentIssue(draft);
    if (problem) { setError(problem); return; }
    const id = draft.id || createId();
    const submitted = { ...draft, id };
    replaceDraft(submitted);
    setSending(true); setError(""); submitGuard.current = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 14000);
    try {
      const { team: inputTeam, round: inputRound, text, context, name, parentId, worksheet } = submitted;
      const response = await fetch(apiURL(), {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ id, team: inputTeam, round: inputRound, text: text.trim(), context: context.trim(), name: name.trim(), parentId, worksheet: cleanWorksheet(worksheet) }),
      });
      if (!response.ok) {
        if (response.status === 429) throw new Error("少し時間をおいて、もう一度投稿してください。");
        if (response.status === 400 || response.status === 413) throw new Error("入力内容と文字数を確認して、もう一度投稿してください。");
        throw new Error("通信状況を確認して、もう一度投稿してください。");
      }
      const data = await response.json() as { idea?: Idea };
      if (data.idea?.id !== id) throw new Error("投稿の受け付けを確認できませんでした。入力を残しています。もう一度投稿してください。");
      syncSeq.current++; entityTag.current = "";
      const created = data.idea;
      lastPost.current = created;
      setIdeas(previous => [created, ...previous.filter(item => item.id !== id)]);
      setSync("live");
      if (currentDraft.current.id === id) {
        replaceDraft(alignDraftRound({ ...emptyDraft, team: submitted.team, round: submitted.round, name: submitted.name, manualRoundSlot: submitted.manualRoundSlot }));
        setExtras(false);
      }
      setNotice({ message: "アイデアを投稿しました", ideaId: id });
      void refresh();
    } catch (e) {
      const message = e instanceof Error && e.message.endsWith("。") ? e.message : "通信が途切れました。入力を残しています。もう一度投稿してください。";
      if (currentDraft.current.id === id) setError(message);
      else setNotice({ message: "直前の投稿結果を確認できません。みんなの案を確認してください。" });
    } finally { clearTimeout(timeout); setSending(false); submitGuard.current = false; }
  };

  const focusComposer = (field?: "context" | keyof Worksheet) => requestAnimationFrame(() => {
    const destination = field && form.current?.querySelector<HTMLTextAreaElement>('[data-worksheet-key="' + field + '"]');
    const target = destination || input.current;
    const sheet = target?.closest("details");
    if (sheet) sheet.open = true;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const reply = (idea: Idea) => window.location.assign(pageLink(window.location.href, { reply: idea.id }));

  const startFromSheet = (sheetRound: Round) => {
    if (draft.round !== sheetRound && hasDraftWork(draft)) {
      setNotice({ message: rounds[draft.round] + "の下書きを開きました。回は投稿欄で変更できます。" });
    } else {
      update({ round: sheetRound, manualRoundSlot: eventRoundAt() });
    }
    focusComposer("person");
  };

  const receiveNote = (text: string, noteRound: Round, fields: NoteFields = {}) => {
    const previous = currentDraft.current;
    const keepRound = hasDraftWork(previous);
    const worksheet = { ...previous.worksheet };
    for (const key of Object.keys(fields.worksheet || {}) as (keyof Worksheet)[]) {
      worksheet[key] = appendNote(worksheet[key] || "", fields.worksheet?.[key]);
    }
    const merged = {
      ...previous, text: appendNote(previous.text, text), context: appendNote(previous.context, fields.context),
      worksheet, round: keepRound ? previous.round : noteRound, manualRoundSlot: keepRound ? previous.manualRoundSlot : eventRoundAt()
    };
    update(merged);
    if (fields.context) setExtras(true);
    const issue = contentIssue(merged);
    setNotice({ message: issue ? "投稿欄にコピーしました。" + issue : "投稿欄にコピーしました" });
    const firstNoteField = WORKSHEET_KEYS.find(key => fields.worksheet?.[key]?.trim());
    focusComposer(text.trim() ? undefined : firstNoteField || (fields.context ? "context" : undefined));
  };

  const sharingTeam = screen ? team : view === "summary" ? summaryTeam : "";
  const shareUrl = joinTeamUrl(sharingTeam, sourceHref);
  const qrAsset = "/join-" + (isDemoRoom(sourceHref) ? "demo-" : "") + (sharingTeam || "qr") + ".svg";
  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl); setCopied(true);
    } catch {
      const urlField = document.querySelector<HTMLInputElement>(".share-url");
      urlField?.focus(); urlField?.select();
    }
  };

  let submitHint = contentIssue(draft);
  if (replyId) submitHint = "引用する投稿を確認してください。";
  if (!submitHint && !draft.team) submitHint = "投稿するには、自分の班を選んでください。";
  if (sync === "offline") submitHint = "接続が戻ると投稿できます。入力内容はこの端末に残ります。";

  const filteredIdeas = ideas.filter(i => (!team || i.team === team) && (!round || i.round === round));
  const visibleThemes = themeFeed.themes.filter(row => (!team || row.team === team) && (!round || row.round === round));
  const totalShown = filteredIdeas.length + visibleThemes.length;
  const feedReady = hasLoaded && themeFeed.loaded;
  const feedError = themeFeed.unavailable || sync === "error" || sync === "offline";
  const navTeam = screen ? team : personal ? draft.team : summaryTeam;
  const summaryRound = screen ? round : personal ? (navTeam ? draft.round : 0) : summaryScope.round;
  const summaryHref = pageLink(sourceHref, { view: "summary", team: navTeam, round: summaryRound ? String(summaryRound) : "", write: view === "summary" && summaryScope.team === "all" ? "plenary" : "" });

  return <div className={screen ? "board-app screen-mode" : personal ? "board-app personal-mode" : "board-app summary-mode"}>
    <header className="topbar board-header"><div className="shell nav-inner">
      <Brand source={sourceHref} />
      <nav aria-label="表示と共有">
        <span className={"live-state live-" + sync} role="status"><i />{syncLabels[sync]}</span>
        <span className="nav-line" />
        <button type="button" className="nav-action" onClick={() => { setCopied(false); setShare(true); }} aria-label="参加用QRコードを表示"><QrCode size={17} /><span>共有</span></button>
      </nav>
    </div><nav className="shell page-mode-nav" aria-label="入力と発表の画面">
      <a aria-current={personal ? "page" : undefined} href={pageLink(sourceHref, { join: navTeam })}><Pencil size={16}/>個人で書く</a>
      <a aria-current={view === "summary" ? "page" : undefined} href={summaryHref} onClick={e => { if (view === "summary" && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) e.preventDefault(); }}><Users size={16}/>班でまとめる</a>
      <a aria-current={screen ? "page" : undefined} href={pageLink(sourceHref, { view: "screen", team: view === "summary" ? summaryTeam : "" })}><Monitor size={17}/>発表を見る</a>
    </nav></header>

    <main className="shell">
      {view === "summary" && <section className="hero">
        <div className="hero-copy"><div className="event-meta"><span className="event-rule" />2026.11.24 <span>TUE</span><i /> WOVEN CITY</div>
          <h1>班のまとめ</h1>
          <div className="event-tools">
            <button type="button" onClick={() => setTool("slides")}><Presentation size={15} />スライド・記入シート</button>
            <button type="button" onClick={() => setTool("guide")}><BookOpen size={15} />今日の進め方</button>
          </div>
        </div>
        <div className="hero-graphic" aria-hidden="true"><div className="hero-print"><i className="print-track track-a"/><i className="print-track track-b"/><i className="print-track track-c"/><i className="speech speech-back"/><i className="speech speech-front"><b/><b/></i></div></div>
      </section>}
      <div className={screen ? "workspace" : personal ? "workspace sheet-workspace" : "summary-layout"}>
        {personal && <form className="composer" ref={form} onSubmit={send} id="compose">
          <fieldset disabled={sending} className="compose-fields">
            {replyId && <div className="pending-reference" role="status">
              {replySource ? <><strong>この下書きに元の投稿を引用しますか？</strong><p>{replySource.text}</p>
                <button type="button" onClick={() => acceptReply(replySource)}>この下書きに引用する</button></> :
                <p>{hasLoaded ? "元の投稿が見つかりませんでした。" : "引用する投稿を読み込んでいます。"}</p>}
              <button type="button" onClick={clearReplyLink}>引用せずに続ける</button>
            </div>}
            {draft.parentId && <div className="reply-preview"><CornerDownRight size={15} /><span><small>もとになった投稿</small>{draft.parentText}</span><button type="button" onClick={() => update({ parentId: null, parentText: "" })} aria-label="参照を外す"><X size={16} /></button></div>}
            <IdeaWorksheet values={draft.worksheet} text={draft.text} onTextChange={text => update({ text })}
              onChange={worksheet => update({ worksheet })} inputRef={input} isReply={Boolean(draft.parentId)} />
            <div className="sheet-routing">
            <fieldset className="team-picker">
              <legend>自分の班</legend>
              <div className="team-options">
                {teams.map(t => <label key={t}>
                  <input required type="radio" name="投稿する班" value={t} checked={draft.team === t} onChange={() => update({ team: t })}/>
                  <span>{t}班</span>
                </label>)}
              </div>
            </fieldset>
            <div className="round-choice">
              <SelectField label="話し合いの回" value={draft.round} onChange={v => update({ round: Number(v) as Round, manualRoundSlot: eventRoundAt() })}>
                {Object.entries(roundChoices).map(([n, name]) => <option key={n} value={n}>{name}</option>)}
              </SelectField>
            </div>
            </div>
            <button className="extras-trigger" type="button" aria-expanded={extras} aria-controls="personal-sheet-fields" onClick={() => setExtras(!extras)}><ChevronRight className={extras ? "turn" : ""} size={16} />名前・共感した理由を添える <span>任意</span></button>
            {extras && <div id="personal-sheet-fields" className="extras-panel">
              <label className="field"><span>きっかけ・共感した理由</span><textarea rows={2} maxLength={400} data-worksheet-key="context" value={draft.context} onChange={e => update({ context: e.target.value })} /></label>
              <label className="field"><span>呼ばれたい名前</span><input autoComplete="off" value={draft.name} maxLength={40} onChange={e => update({ name: e.target.value })} /></label>
            </div>}
            {error && <p className="error-message" role="alert"><CircleAlert size={15} />{error}</p>}
            <p className="sharing-cue" id="posting-audience">投稿すると、全員がこの内容を読めます。</p>
            <button className="post-button" type="submit" aria-describedby="posting-audience submit-hint" disabled={sending || !hydrated || Boolean(submitHint)}><Send size={17} /><span>{sending ? "投稿中…" : error ? "もう一度投稿する" : "投稿する"}</span></button>
            <p id="submit-hint" className="submit-hint" aria-live="polite">{!sending && submitHint}</p>
          </fieldset>
          <div className="personal-resources" ref={eventTools} role="group" aria-label="個人メモと資料">
            <button type="button" onClick={() => setTool("notes")}><NotebookPen size={16} />個人メモ</button>
            <button type="button" onClick={() => setTool("slides")}><Presentation size={16} />スライド・記入シート</button>
            <button type="button" onClick={() => setTool("guide")}><BookOpen size={16} />今日の進め方</button>
          </div>
        </form>}
        {view === "summary" && <TeamSummaryWorkspace ideas={ideas} hasLoaded={hasLoaded} loadError={sync === "error" || sync === "offline"}
          initialTeam={initialTeam || draft.team} initialRound={initialRound || draft.round} source={sourceHref} onScopeChange={onSummaryScope} />}
        {screen && <section className="ideas-section" tabIndex={-1} aria-label="アイデアの一覧">
          <div className="projection-title">
            <h1>{(team ? team + "班" : "全体") + "のアウトプット"}</h1>
            <span className="projection-count"><b>{feedReady ? totalShown : "—"}</b>件</span>
            <div className="projection-tools">
              <button type="button" onClick={() => setTool("slides")}><Presentation size={16}/>スライド</button>
              <button type="button" onClick={() => setTool("guide")}><BookOpen size={16}/>進め方</button>
            </div>
          </div>
          <div className="projection-controls">
            <TeamOutputs source={sourceHref ? pageLink(sourceHref) : ""} projection team={team} round={round} tab={boardView} onSelect={setTeam} />
            <label className="projection-round">
              <select aria-label="回で絞り込み" value={round} onChange={e => setRound(Number(e.target.value) as ProjectionRound)}>
                <option value={0}>すべての回</option>{Object.entries(projectionRounds).map(([n,label]) => <option key={n} value={n}>{label}</option>)}
              </select><ChevronDown size={14} aria-hidden="true"/>
            </label>
            <div className="view-switch" aria-label="アウトプットの見方" role="group">
              {([["list", "投稿一覧"], ["map", "マインドマップ"], ["words", "キーワード"]] as const).map(([key, title]) => <button key={key} type="button" aria-pressed={boardView === key} onClick={() => setBoardView(key)}>{title}</button>)}
            </div>
          </div>
          <TeamThemes team={team || "all"} round={round || undefined} projection ideas={ideas} feedOnly onFeedChange={setThemeFeed} />
          <IdeaVisualProvider ideas={ideas} themes={themeFeed.themes}>
            {boardView === "map" ? <MindMap ideas={ideas} themes={themeFeed.themes} themesLoaded={themeFeed.loaded} loadError={feedError}
              teamFilter={team} roundFilter={round} hasLoaded={hasLoaded} presentation onReply={reply}/>
              : boardView === "words" ? <KeywordsPanel ideas={filteredIdeas} onReply={reply} presentation/>
              : <PresentationGallery ideas={filteredIdeas} themes={visibleThemes} allIdeas={ideas} allThemes={themeFeed.themes} source={sourceHref} loaded={feedReady} loadError={feedError}/>}
          </IdeaVisualProvider>
        </section>}
      </div>
    </main>
    {tool === "slides" && <MaterialsPanel onClose={() => setTool(null)} onStartIdea={personal ? startFromSheet : undefined} onStartNote={personal ? () => setTool("notes") : undefined}/>}
    <DiscussionGuide open={tool === "guide"} onClose={() => setTool(null)}
      onOpenMemo={personal ? () => setTool("notes") : undefined}
      onWrite={!personal ? undefined : () => requestAnimationFrame(() => {
        input.current?.focus({ preventScroll: true });
        input.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      })} />
    {tool === "notes" && <PersonalNotes initialRound={draft.round} onCopyToComposer={receiveNote} onClose={() => setTool(null)} />}
    {personal && offerMemoJump && !tool && !share && <button className="memo-shortcut" type="button" onClick={() => setTool("notes")}><NotebookPen size={15}/>個人メモ</button>}
    <div className="toast-region" role="status">{notice && <div className="toast"><Check size={16}/><span>{notice.message}</span>{notice.ideaId && <a href={pageLink(sourceHref, { view: "screen", idea: notice.ideaId })}>見る</a>}</div>}</div>
    <dialog className="share-dialog" ref={shareDialog} onCancel={() => setShare(false)} onClose={() => setShare(false)} onClick={e => { if (e.target === e.currentTarget) setShare(false); }} aria-labelledby="qr-title">
      <div className="dialog-body"><button type="button" className="dialog-close" aria-label="閉じる" onClick={() => setShare(false)}><X size={19} /></button><h2 id="qr-title">{sharingTeam ? sharingTeam + "班で参加する" : "ボードに参加する"}</h2><p>スマホで読み取ると投稿画面が開きます。</p><img className="join-qr" src={assetUrl(qrAsset)} alt="参加用QRコード" width={220} height={220}/><input className="share-url" aria-label="参加用URL" value={shareUrl} readOnly onFocus={e => e.target.select()}/><button type="button" className="copy-url" onClick={shareLink}>{copied ? <Check size={16}/> : <Link2 size={16}/>} {copied ? "コピーしました" : "リンクをコピー"}</button></div>
    </dialog>
  </div>;
}
