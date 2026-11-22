"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown, MessageCircle, Send } from "lucide-react";
import { roomApi, roomStorageKey } from "./board-room";
import "./post-comments.css";

type Target = "idea" | "theme";
type Comment = { id: string; targetType: Target; targetId: string; text: string; name: string; createdAt: string };
type Draft = { text: string; name: string; attemptId?: string };
type Status = "loading" | "ready" | "unavailable" | "offline";
type Notice = { text: string; error?: boolean };
type CommentsApi = {
  threads: ReadonlyMap<string, readonly Comment[]>;
  drafts: ReadonlyMap<string, Draft>;
  notices: ReadonlyMap<string, Notice>;
  busy: ReadonlySet<string>;
  status: Status;
  loaded: boolean;
  refresh: () => Promise<void>;
  edit: (key: string, field: "text" | "name", value: string) => void;
  send: (type: Target, id: string) => Promise<void>;
};
const CommentsContext = createContext<CommentsApi | null>(null);
const draftStorage = "shinagawa:1124:comment-drafts";
const syncStorage = "shinagawa:1124:comments-updated";
const emptyDraft: Draft = { text: "", name: "" };
const targetKey = (type: Target, id: string) => type + ":" + id;
const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
});

function isComment(input: unknown): input is Comment {
  if (!input || typeof input !== "object") return false;
  const c = input as Record<string, unknown>;
  return (c.targetType === "idea" || c.targetType === "theme") && typeof c.targetId === "string" &&
    typeof c.id === "string" && typeof c.text === "string" && typeof c.name === "string" &&
    typeof c.createdAt === "string" && Number.isFinite(Date.parse(c.createdAt));
}
function threadsFrom(rows: readonly Comment[]) {
  const threads = new Map<string, Comment[]>();
  for (const row of rows) {
    const key = targetKey(row.targetType, row.targetId);
    const current = threads.get(key);
    if (current) current.push(row);
    else threads.set(key, [row]);
  }
  return threads;
}
function restoreDrafts(): Map<string, Draft> {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(roomStorageKey(draftStorage)) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return new Map();
    const drafts = new Map<string, Draft>();
    for (const [key, value] of Object.entries(saved)) {
      if (!/^(idea|theme):.+$/.test(key) || !value || typeof value !== "object") continue;
      if (typeof value.text !== "string" || typeof value.name !== "string") continue;
      drafts.set(key, {
        text: value.text, name: value.name,
        attemptId: typeof value.attemptId === "string" ? value.attemptId : undefined,
      });
    }
    return drafts;
  } catch {
    return new Map();
  }
}
async function requestComments(options: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(roomApi("/api/comments"), { ...options, signal: controller.signal, cache: "no-store" });
    const body: unknown = response.status === 304 ? null : await response.json();
    return { response, body };
  } finally {
    window.clearTimeout(timer);
  }
}
function newCommentId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const value = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return [value.slice(0, 8), value.slice(8, 12), value.slice(12, 16), value.slice(16, 20), value.slice(20)].join("-");
}

export function CommentProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<ReadonlyMap<string, readonly Comment[]>>(new Map());
  const [drafts, setDrafts] = useState<ReadonlyMap<string, Draft>>(new Map());
  const [notices, setNotices] = useState<ReadonlyMap<string, Notice>>(new Map());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState<Status>("loading");
  const [loaded, setLoaded] = useState(false);
  const currentDrafts = useRef(new Map<string, Draft>());
  const pending = useRef(new Set<string>());
  const etag = useRef("");
  const generation = useRef(0);
  const reading = useRef(false);
  const live = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);

  const putDraft = useCallback((key: string, draft?: Draft) => {
    const next = new Map(currentDrafts.current);
    if (draft && (draft.text || draft.name || draft.attemptId)) next.set(key, draft);
    else next.delete(key);
    currentDrafts.current = next;
    setDrafts(next);
    try { sessionStorage.setItem(roomStorageKey(draftStorage), JSON.stringify(Object.fromEntries(next))); }
    catch { /* The in-memory copy survives switching views in this page. */ }
  }, []);

  const say = useCallback((key: string, notice?: Notice) => {
    setNotices(previous => {
      if (!notice && !previous.has(key)) return previous;
      const next = new Map(previous);
      if (notice) next.set(key, notice);
      else next.delete(key);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (reading.current || document.hidden) return;
    if (!navigator.onLine) { setStatus("offline"); return; }
    reading.current = true;
    const version = generation.current;
    try {
      const { response, body } = await requestComments({ headers: etag.current ? { "If-None-Match": etag.current } : {} });
      if (!live.current || version !== generation.current) return;
      if (response.status !== 304) {
        if (!response.ok || !body || typeof body !== "object" || !("comments" in body) ||
          !Array.isArray(body.comments) || !body.comments.every(isComment)) throw new Error();
        setThreads(threadsFrom(body.comments));
        etag.current = response.headers.get("ETag") || "";
        // A request may have reached the server just before the device lost its connection.
        for (const row of body.comments) {
          const key = targetKey(row.targetType, row.targetId);
          const draft = currentDrafts.current.get(key);
          if (draft?.attemptId === row.id && draft.text.trim() === row.text && draft.name.trim() === row.name) {
            putDraft(key);
            say(key, { text: "コメントを共有しました。" });
          }
        }
      }
      setStatus("ready");
      setLoaded(true);
    } catch {
      if (live.current && version === generation.current) setStatus(navigator.onLine ? "unavailable" : "offline");
    } finally {
      reading.current = false;
    }
  }, [putDraft, say]);

  useEffect(() => {
    live.current = true;
    currentDrafts.current = restoreDrafts();
    setDrafts(currentDrafts.current);
    void refresh();
    const signal = roomStorageKey(syncStorage);
    const visible = () => { if (!document.hidden) void refresh(); };
    const offline = () => setStatus("offline");
    const storage = (event: StorageEvent) => { if (event.key === signal) visible(); };
    try {
      channel.current = new BroadcastChannel(signal);
      channel.current.onmessage = visible;
    } catch { /* Other tabs can also refresh through storage events and polling. */ }
    const interval = window.setInterval(visible, 12000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    window.addEventListener("offline", offline);
    window.addEventListener("storage", storage);
    return () => {
      live.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      window.removeEventListener("offline", offline);
      window.removeEventListener("storage", storage);
      channel.current?.close();
      channel.current = null;
    };
  }, [refresh]);

  function edit(key: string, field: "text" | "name", value: string) {
    if (pending.current.has(key)) return;
    const previous = currentDrafts.current.get(key) || emptyDraft;
    const draft = { ...previous, [field]: value };
    if (value.trim() !== previous[field].trim()) delete draft.attemptId;
    putDraft(key, draft);
    say(key);
  }

  async function send(targetType: Target, targetId: string) {
    const key = targetKey(targetType, targetId);
    const draft = currentDrafts.current.get(key);
    if (pending.current.has(key) || !draft?.text.trim()) return;
    const text = draft.text.trim(), name = draft.name.trim();
    if (text.length > 400 || name.length > 40) {
      say(key, { text: "本文は400文字以内、名前は40文字以内で入力してください。", error: true });
      return;
    }
    if (!navigator.onLine) { setStatus("offline"); return; }
    const id = draft.attemptId || newCommentId();
    pending.current.add(key);
    setBusy(new Set(pending.current));
    putDraft(key, { ...draft, attemptId: id });
    say(key);
    try {
      const { response, body } = await requestComments({
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, targetType, targetId, text, name }),
      });
      if (!live.current) return;
      if (!response.ok) {
        if (response.status === 409) putDraft(key, { ...draft, attemptId: undefined });
        if (response.status >= 400 && response.status < 500 && body && typeof body === "object" &&
          "error" in body && typeof body.error === "string") {
          say(key, { text: body.error + " 入力は残っています。", error: true });
          return;
        }
        throw new Error();
      }
      const row = body && typeof body === "object" && "comment" in body ? body.comment : null;
      if (!isComment(row) || row.id !== id || row.targetType !== targetType || row.targetId !== targetId) throw new Error();
      generation.current++;
      etag.current = "";
      setThreads(previous => {
        const existing = previous.get(key) || [];
        if (existing.some(c => c.id === row.id)) return previous;
        return new Map(previous).set(key, [...existing, row].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      });
      putDraft(key);
      say(key, { text: "コメントを共有しました。" });
      try { channel.current?.postMessage(id); localStorage.setItem(roomStorageKey(syncStorage), id); }
      catch { /* A successful write is visible on the next scheduled refresh. */ }
      void refresh();
    } catch {
      if (live.current && currentDrafts.current.get(key)?.attemptId === id) {
        say(key, { text: "送信結果を確認できません。入力を残しています。同じ内容で再送できます。", error: true });
        void refresh();
      }
    } finally {
      pending.current.delete(key);
      if (live.current) setBusy(new Set(pending.current));
    }
  }

  return <CommentsContext.Provider value={{ threads, drafts, notices, busy, status, loaded, edit, send, refresh }}>
    {children}
  </CommentsContext.Provider>;
}

const staticLink = () => () => {};
const serverThread = () => "";
const linkedThread = () => new URL(window.location.href).searchParams.get("thread") || "";

export function PostComments({ targetType, targetId, tone = "dark" }: {
  targetType: Target; targetId: string; tone?: "dark" | "light";
}) {
  const api = useContext(CommentsContext);
  const [opened, setExpanded] = useState<boolean | null>(null);
  const initialThread = useSyncExternalStore(staticLink, linkedThread, serverThread);
  const expanded = opened ?? (initialThread === targetId);
  const id = useId();
  if (!api) throw new Error("CommentProvider is required");
  const key = targetKey(targetType, targetId);
  const rows = api.threads.get(key) || [];
  const draft = api.drafts.get(key) || emptyDraft;
  const notice = api.notices.get(key);
  const sending = api.busy.has(key);
  const offline = api.status === "offline";

  return <div className={"post-comments comments-" + tone}>
    <button type="button" className="comments-toggle" aria-expanded={expanded} aria-controls={id + "-thread"}
      onClick={() => { setExpanded(!expanded); if (!expanded && api.status !== "ready") void api.refresh(); }}>
      <MessageCircle size={16} aria-hidden="true"/>コメント
      <span>{api.loaded || rows.length ? rows.length + "件" : "—"}</span><ChevronDown size={14} aria-hidden="true"/>
    </button>
    {expanded && <section id={id + "-thread"} className="comments-thread" aria-label="この投稿のコメント">
      {api.status === "loading" && <p role="status">コメントを読み込み中…</p>}
      {offline && <p role="status">オフラインです。入力は残ります。接続が戻ると共有できます。</p>}
      {api.status === "unavailable" && <p role="status">コメントを更新できません。<button type="button" className="comments-retry" onClick={() => void api.refresh()}>再読み込み</button></p>}
      {rows.length > 0 ? <ol className="comments-list">{rows.map(row => <li key={row.id}>
        <div className="comments-by"><strong>{row.name || "匿名"}</strong><time dateTime={row.createdAt}>{dateFormat.format(new Date(row.createdAt))}</time></div>
        <p>{row.text}</p>
      </li>)}</ol> : api.loaded && <p>まだコメントはありません。</p>}
      <label htmlFor={id + "-text"}>コメントを書く</label>
      <textarea id={id + "-text"} value={draft.text} rows={3} maxLength={400} disabled={sending}
        aria-describedby={id + "-audience"} onChange={e => api.edit(key, "text", e.target.value)}/>
      <label htmlFor={id + "-name"}>呼ばれたい名前（任意）</label>
      <input id={id + "-name"} type="text" autoComplete="off" maxLength={40} value={draft.name} disabled={sending}
        onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); e.stopPropagation(); } }}
        onChange={e => api.edit(key, "name", e.target.value)}/>
      <p id={id + "-audience"} className="comments-audience">コメントと記入した名前は、このボードを見る全員に共有されます。</p>
      <button type="button" className="comments-send" disabled={sending || offline || !draft.text.trim()}
        onClick={() => void api.send(targetType, targetId)}><Send size={15} aria-hidden="true"/>{sending ? "共有中…" : "コメントを共有"}</button>
      {notice && <p className={notice.error ? "comments-error" : "comments-sent"} role="status">{notice.text}</p>}
    </section>}
  </div>;
}
