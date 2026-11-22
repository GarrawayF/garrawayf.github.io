"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Compass, Pencil } from "lucide-react";
import { pageLink, roomApi } from "./board-room";
import { roundLabels as eventRoundLabels, type EventRound } from "./event-round";
import { ReactionButtons, useReactions } from "./reactions";
import { PostComments } from "./post-comments";
import type { Worksheet } from "./worksheet";
import type { SavedTheme as Theme } from "./theme-writer";
import PostReading, { OriginalWording } from "./post-reading";
import "./team-themes.css";

const groups = ["A", "B", "C", "D", "E"] as const;
type Team = (typeof groups)[number];
type ThemeTeam = Team | "all";
type Round = EventRound;
type ThemeRound = Round | 5;
const teamLabel = (group: ThemeTeam) => group === "all" ? "会場全体" : `${group}班`;
const roundLabels: Record<ThemeRound, string> = {
  ...eventRoundLabels, 5: "3講演を通したまとめ",
};
type Idea = { id: string; text: string; enteredText?: string; parentId?: string | null; team: Team; round: Round; context: string; name: string; worksheet?: Worksheet };
export type ThemeFeed = { themes: Theme[]; loaded: boolean; unavailable: boolean };

type Props = {
  team: Team | "all";
  round?: Round | 5;
  projection?: boolean;
  ideas?: readonly Idea[];
  feedOnly?: boolean;
  onFeedChange?: (feed: ThemeFeed) => void;
};

function themeMode(row: { team: ThemeTeam | ""; round: ThemeRound }) {
  return row.team === "all" ? "plenary" : row.round === 5 ? "summary" : "work";
}

const themesEndpoint = () => roomApi("/api/themes");

function editThemeLink(source: string, theme: Theme) {
  return pageLink(source, { view: "summary", write: "edit", themeId: theme.id, team: theme.team === "all" ? "" : theme.team });
}

export default function TeamThemes({ team, projection = true, round, ideas = [], feedOnly = false, onFeedChange }: Props) {
  const { order, score } = useReactions();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    onFeedChange?.({ themes, loaded, unavailable });
  }, [onFeedChange, themes, loaded, unavailable]);
  const [source, setSource] = useState("");
  const scrolled = useRef(false);
  const tag = useRef("");
  const reading = useRef(false);
  const headingId = useId();

  const refresh = useCallback(async () => {
    if (reading.current || document.hidden) return;
    reading.current = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(themesEndpoint(), {
        headers: tag.current ? { "If-None-Match": tag.current } : {},
        cache: "no-store", credentials: "omit", signal: controller.signal,
      });
      if (response.status === 304) { setUnavailable(false); return; }
      if (!response.ok) throw new Error();
      const data = await response.json() as { themes?: Theme[] };
      if (!Array.isArray(data?.themes)) throw new Error();
      tag.current = response.headers.get("ETag") || "";
      setThemes(data.themes);
      setLoaded(true);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      clearTimeout(timer);
      reading.current = false;
    }
  }, []);

  useEffect(() => {
    setSource(window.location.href);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(refresh, 4000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!projection || !loaded || scrolled.current) return;
    const hash = window.location.hash.slice(1);
    if (!hash.startsWith("theme-")) return;
    const card = document.getElementById(hash);
    if (!card) return;
    scrolled.current = true;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: "center", behavior: "auto" });
  }, [projection, loaded, themes]);

  if (feedOnly) return null;
  const inView = (theme: Theme) => (team === "all" || theme.team === team) && (!round || theme.round === round);
  const visible = themes.filter(inView);
  if (order === "popular") {
    visible.sort((left, right) => score("theme", right.id) - score("theme", left.id) ||
      right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  }
  const sourcesById = new Map(ideas.map(i => [i.id, i]));
  return (
    <section className={`team-themes${projection ? " is-projection" : ""}`} aria-labelledby={headingId}>
      <div className="tt-head">
        <h3 id={headingId}><Compass size={18} aria-hidden="true" />{team === "all" || !projection ? "班のまとめ・全体の案" : `${team}班のまとめ`}</h3>
      </div>
      {projection && <div>
        {unavailable && <p className="tt-status" role="status">まとめと全体の案を再読み込みしています。<button type="button" onClick={refresh}>今すぐ更新</button></p>}
        {!visible.length && !unavailable && <p className="tt-empty">{loaded ? round ? "この回のまとめや案はまだありません。" : team === "all" ? "まだ共有されたまとめや案はありません。" : `${team}班のまとめはまだありません。` : "読み込み中…"}</p>}
        {visible.length > 0 && <ul className="tt-list">
          {visible.map(theme => <li key={theme.id} id={`theme-${theme.id}`} tabIndex={-1}>
            <div className="tt-row-top"><span className="tt-tag">{teamLabel(theme.team)}</span><span className="tt-round">{roundLabels[theme.round]}</span>
              <a className="tt-edit" href={editThemeLink(source, theme)} aria-label={`入力画面で${theme.text.slice(0,25)}を編集`}><Pencil size={13} aria-hidden="true" />編集</a>
            </div>
            <PostReading kind="theme" mode={themeMode(theme)} entry={theme}
              bodyLabel={theme.team === "all" ? "会場で加えたい挑戦テーマ" : theme.round === 5 ? "発表で紹介したい挑戦テーマ" : "品川で試してみたいこと"} />
            {(theme.sourceIdeaId || theme.sourceIdeaId2) && <details className="tt-origin">
              <summary>元の投稿を読む{theme.sourceIdeaId && theme.sourceIdeaId2 ? "（2件）" : ""}</summary>
              {[theme.sourceIdeaId, theme.sourceIdeaId2].filter((id): id is string => Boolean(id)).map(id => {
                const source = sourcesById.get(id);
                if (!source) return <p className="tt-origin-note" key={id}>元の投稿を取得できていません。</p>;
                return <blockquote key={id} className="tt-origin-entry">
                  <div className="tt-origin-meta">{source.team}班・{roundLabels[source.round]}・{source.name || "匿名"}</div>
                  <OriginalWording entry={source} mode="personal" attribution={false}
                    bodyLabel={source.parentId ? "共感した理由・付け足したいこと" : "品川で試してみたいこと"} />
                </blockquote>;
              })}
            </details>}
            <ReactionButtons targetType="theme" targetId={theme.id} />
            <PostComments targetType="theme" targetId={theme.id} />
          </li>)}
        </ul>}
      </div>}
    </section>
  );
}
