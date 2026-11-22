"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { analyzePost, type AnalysisInput, type PostAnalysis } from "./post-analysis";
import { WORKSHEET_KEYS, worksheetField, worksheetGroups, type WorksheetMode } from "./worksheet";
import "./post-reading.css";

type Entry = AnalysisInput & {
  name?: string;
  analysis?: PostAnalysis;
};

function comparable(value: string) {
  return value.trim().replace(/\s+/gu, " ").replace(/[。．.!！?？]+$/u, "");
}

/** A single disclosure preserves the wording and field attribution of every response. */
export function OriginalWording({ entry, mode, bodyLabel, attribution = true }: {
  entry: Entry; mode: WorksheetMode; bodyLabel: string; attribution?: boolean;
}) {
  const entered = entry.enteredText ?? entry.text;
  const fields = worksheetGroups[mode];
  const allFields = [...fields, ...WORKSHEET_KEYS.filter(key => !fields.includes(key))];
  const lines: { label: string; value: string }[] = [];
  if (entered.trim()) lines.push({ label: bodyLabel, value: entered });
  for (const key of allFields) {
    const value = entry.worksheet?.[key];
    if (value?.trim()) {
      const label = mode === "personal" && key === "scene" ? "いつ、どんな場面？" : worksheetField(key, mode).label;
      lines.push({ label, value });
    }
  }
  if (entry.context?.trim()) lines.push({ label: "きっかけ・共感した理由", value: entry.context });
  if (attribution && entry.name?.trim()) lines.push({ label: "呼ばれたい名前", value: entry.name });
  return <dl className="reading-original">{lines.map(({ label, value }) => <div key={label}>
    <dt>{label}</dt><dd>{value}</dd>
  </div>)}</dl>;
}

export default function PostReading({ entry, kind, mode, bodyLabel }: {
  entry: Entry; kind: "idea" | "theme"; mode: WorksheetMode; bodyLabel: string;
}) {
  const analysis = useMemo(() => {
    if (typeof entry.analysis?.title === "string" && entry.analysis.title.trim() && typeof entry.analysis.summary === "string") return entry.analysis;
    return analyzePost(entry, kind);
  }, [entry, kind]);
  const showSummary = analysis.summary.trim() && comparable(analysis.title) !== comparable(analysis.summary);
  const Heading = kind === "idea" ? "h3" : "h4";
  return <div className="post-reading">
    <p className="reading-label">{showSummary ? "自動タイトル・要約" : "自動タイトル"}</p>
    <Heading className="reading-title">{analysis.title}</Heading>
    {showSummary && <p className="reading-summary">{analysis.summary}</p>}
    <details className="reading-disclosure">
      <summary><ChevronRight size={15} aria-hidden="true" /><span>{kind === "idea" ? "書いた人の原文" : "記入シートの原文"}を読む</span></summary>
      <OriginalWording entry={entry} mode={mode} bodyLabel={bodyLabel}/>
    </details>
  </div>;
}
