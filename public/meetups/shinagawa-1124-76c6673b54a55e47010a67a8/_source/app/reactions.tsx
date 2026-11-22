"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { roomFetch, roomApi, roomStorageKey } from "./board-room";
import { Heart, ThumbsUp } from "lucide-react";
import "./reactions.css";

type TargetType = "idea" | "theme";
type Kind = "like" | "love";
type Order = "recent" | "popular";
type Counts = { targetType: TargetType; targetId: string; likes: number; loves: number; myLike: boolean; myLove: boolean };
type Context = {
  order: Order;
  setOrder: (order: Order) => void;
  score: (type: TargetType, id: string) => number;
  values: ReadonlyMap<string, Counts>;
  busy: ReadonlySet<string>;
  ready: boolean;
  toggle: (type: TargetType, id: string, kind: Kind) => void;
};

const ReactionContext = createContext<Context | null>(null);
const actorKey = "shinagawa:1124:reaction-actor";
const signalKey = "shinagawa:1124:reaction-update";
const targetKey = (type: TargetType, id: string) => type + ":" + id;
const memoryActors = new Map<string, string>();

async function requestReactions(options: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const result = await roomFetch(roomApi("/api/reactions"), { ...options, cache: "no-store", signal: controller.signal });
    if (!result.ok) throw new Error("Reaction service is unavailable");
    return await result.json() as unknown;
  } finally {
    window.clearTimeout(timeout);
  }
}

function getActor() {
  const roomKey = roomStorageKey(actorKey);
  const create = () => window.crypto.randomUUID?.() ?? Array.from(window.crypto.getRandomValues(new Uint8Array(20)), b => b.toString(16).padStart(2, "0")).join("");
  const fromMemory = () => {
    const id = memoryActors.get(roomKey) || create();
    memoryActors.set(roomKey, id);
    return id;
  };
  for (const key of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[key];
      const saved = storage.getItem(roomKey);
      if (saved && /^[a-zA-Z0-9_-]{32,128}$/.test(saved)) return saved;
      const id = fromMemory();
      storage.setItem(roomKey, id);
      return id;
    } catch { /* Some browsers allow only session storage. */ }
  }
  return fromMemory();
}

function validCounts(input: unknown): input is Counts {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return (value.targetType === "idea" || value.targetType === "theme") &&
    typeof value.targetId === "string" && typeof value.likes === "number" && Number.isInteger(value.likes) && value.likes >= 0 &&
    typeof value.loves === "number" && Number.isInteger(value.loves) && value.loves >= 0 &&
    typeof value.myLike === "boolean" && typeof value.myLove === "boolean";
}

export function ReactionProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState(new Map<string, Counts>());
  const [busy, setBusy] = useState(new Set<string>());
  const [order, setOrder] = useState<Order>("recent");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const actor = useRef("");
  const epoch = useRef(0);
  const pending = useRef(new Set<string>());
  const reading = useRef(false);
  const broadcast = useRef<BroadcastChannel | null>(null);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    if (!actor.current || reading.current || pending.current.size) return;
    const version = epoch.current;
    reading.current = true;
    try {
      const data = await requestReactions({ headers: { "X-Board-Actor": actor.current } });
      if (!data || typeof data !== "object" || !("reactions" in data) || !Array.isArray(data.reactions) || !data.reactions.every(validCounts)) throw new Error();
      if (!mounted.current || version !== epoch.current) return;
      setValues(new Map(data.reactions.map((r: Counts) => [targetKey(r.targetType, r.targetId), r])));
      setReady(true);
      setError("");
    } catch {
      if (mounted.current && version === epoch.current) {
        setReady(false);
        setError("リアクションを取得できません。接続を確認して再読み込みしてください。");
      }
    } finally {
      reading.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    actor.current = getActor();
    void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    const roomActor = roomStorageKey(actorKey);
    const roomSignal = roomStorageKey(signalKey);
    const changed = (e: StorageEvent) => {
      if (e.key === roomActor && e.newValue && e.newValue !== actor.current) {
        actor.current = getActor();
        epoch.current++;
        setReady(false);
      }
      if (e.key === roomActor || e.key === roomSignal) void refresh();
    };
    const offline = () => {
      epoch.current++;
      setReady(false);
      setError("オフラインです。接続が戻るとリアクションを更新します。");
    };
    try {
      broadcast.current = new BroadcastChannel(roomSignal);
      broadcast.current.onmessage = visible;
    } catch { /* Storage events and the polling interval also synchronize tabs. */ }
    const timer = window.setInterval(visible, 12000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("storage", changed);
    window.addEventListener("online", visible);
    window.addEventListener("offline", offline);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("storage", changed);
      window.removeEventListener("online", visible);
      window.removeEventListener("offline", offline);
      broadcast.current?.close();
      broadcast.current = null;
    };
  }, [refresh]);

  async function toggle(type: TargetType, id: string, kind: Kind) {
    const key = targetKey(type, id);
    if (!ready || pending.current.has(key)) return;
    const active = !(kind === "like" ? values.get(key)?.myLike : values.get(key)?.myLove);
    const sender = actor.current;
    pending.current.add(key);
    epoch.current++;
    setBusy(new Set(pending.current));
    try {
      const data = await requestReactions({ method: "POST", headers: { "Content-Type": "application/json", "X-Board-Actor": sender },
        body: JSON.stringify({ targetType: type, targetId: id, kind, active }) });
      if (!data || typeof data !== "object" || !("reaction" in data)) throw new Error();
      const { reaction } = data;
      if (!validCounts(reaction) || reaction.targetType !== type || reaction.targetId !== id) throw new Error();
      if (!mounted.current || sender !== actor.current) return;
      setValues(previous => new Map(previous).set(key, reaction));
      const label = kind === "like" ? "いいね" : "LOVE";
      const count = kind === "like" ? reaction.likes : reaction.loves;
      setAnnouncement(label + (active ? "を追加しました。" : "を取り消しました。") + count + "件。");
      broadcast.current?.postMessage(key);
      try { localStorage.setItem(roomStorageKey(signalKey), key + ":" + Date.now()); } catch { /* Polling is still available. */ }
    } catch {
      if (mounted.current) {
        setReady(false);
        setError("リアクションの保存結果を確認できません。再読み込みで現在の件数を確認してください。");
      }
    } finally {
      pending.current.delete(key);
      if (mounted.current) setBusy(new Set(pending.current));
    }
  }

  const score = useCallback((type: TargetType, id: string) => {
    const item = values.get(targetKey(type, id));
    return (item?.likes ?? 0) + (item?.loves ?? 0);
  }, [values]);
  return <ReactionContext.Provider value={{ order, setOrder, score, values, busy, ready, toggle }}>
    <span className="reaction-announcement" role="status">{announcement}</span>
    {error && <div className="reaction-status" role="status">{error}<button type="button" onClick={() => void refresh()}>再読み込み</button></div>}
    {children}
  </ReactionContext.Provider>;
}

export function useReactions() {
  const api = useContext(ReactionContext);
  if (!api) throw new Error("ReactionProvider is required");
  return api;
}

export function ReactionButtons({ targetType, targetId }: { targetType: TargetType; targetId: string }) {
  const { values, busy, ready, toggle } = useReactions();
  const key = targetKey(targetType, targetId);
  const counts = values.get(key);
  return <div className="reaction-buttons" role="group" aria-label="この投稿へのリアクション" aria-busy={busy.has(key)}>
    {(["like", "love"] as const).map(kind => {
      const like = kind === "like";
      const Icon = like ? ThumbsUp : Heart;
      const label = like ? "いいね" : "LOVE";
      const count = like ? counts?.likes : counts?.loves;
      const pressed = Boolean(like ? counts?.myLike : counts?.myLove);
      return <button type="button" className={"reaction-button reaction-" + kind} key={kind} aria-pressed={pressed}
        disabled={!ready || busy.has(key)} onClick={() => void toggle(targetType, targetId, kind)}>
        <Icon size={15} strokeWidth={1.8} fill={pressed ? "currentColor" : "none"} aria-hidden="true" />
        {label}<span className="reaction-count">{count ?? (ready ? 0 : "—")}</span>
      </button>;
    })}
  </div>;
}
