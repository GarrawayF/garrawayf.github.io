"use client";

import type { MouseEvent } from "react";
import { preserveBoardRoom, publicBoardUrl } from "./board-room";
import { Monitor } from "lucide-react";
import "./team-outputs.css";

export const outputTeams = ["A", "B", "C", "D", "E"] as const;
type Team = (typeof outputTeams)[number];
type Scope = { team: Team | ""; round: 0 | 1 | 2 | 3 | 4 | 5; tab: "list" | "map" | "words" };
export { publicBoardUrl } from "./board-room";

export function boardLocation(source: string, screen: boolean, { team, round, tab }: Scope) {
  const url = preserveBoardRoom(new URL(source || publicBoardUrl, publicBoardUrl), source);
  for (const [key, value] of Object.entries({
    view: screen ? "screen" : "", team, round: round ? String(round) : "", tab: tab === "list" ? "" : tab,
  })) {
    if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  }
  if (screen) url.searchParams.delete("join");
  return source && !source.startsWith("?") ? url.href : url.search || "?";
}

export function joinTeamUrl(team: Team | "", source?: string) {
  const url = preserveBoardRoom(new URL(publicBoardUrl), source);
  if (team) url.searchParams.set("join", team);
  return url.href;
}

type Props = Scope & {
  source: string;
  projection: boolean;
  onSelect: (team: Team | "") => void;
};

export default function TeamOutputs({ source, projection, team, round, tab, onSelect }: Props) {
  const targets: readonly (Team | "")[] = projection ? ["", ...outputTeams] : outputTeams;
  function select(event: MouseEvent<HTMLAnchorElement>, target: Team | "") {
    if (!projection || window.location.protocol === "file:" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(target);
  }
  return <nav className={"team-outputs" + (projection ? " outputs-projected" : "")} aria-label="班別アウトプット">
    <p className="outputs-label"><Monitor size={15} aria-hidden="true" />{projection ? "表示する班" : "班別アウトプット"}</p>
    <div className="outputs-links" style={{ gridTemplateColumns: `repeat(${targets.length},minmax(0,1fr))` }}>
      {targets.map(target => <a key={target || "all"} className={projection && target === team ? "outputs-current" : ""}
        href={boardLocation(source, true, { team: target, round, tab })}
        aria-current={projection && target === team ? "page" : undefined}
        aria-label={(target ? target + "班" : "全体") + "のアウトプットを開く"}
        onClick={event => select(event, target)}>{target ? target + "班" : "全体"}</a>)}
    </div>
  </nav>;
}
