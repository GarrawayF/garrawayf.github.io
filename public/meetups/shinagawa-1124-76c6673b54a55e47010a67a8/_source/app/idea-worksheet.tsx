"use client";
import { useId } from "react";
import type { RefObject } from "react";
import { WORKSHEET_FIELD_LIMIT, type Worksheet, type WorksheetKey } from "./worksheet";
import "./idea-worksheet.css";

type Props = {
  values: Worksheet;
  text: string;
  onTextChange: (value: string) => void;
  onChange: (values: Worksheet) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isReply?: boolean;
};

const fields: readonly { key: WorksheetKey | "text"; label: string; hint: string }[] = [
  { key: "person", label: "誰のことを考える？", hint: "品川駅前で過ごす一人を思い浮かべる。" },
  { key: "scene", label: "いつ、どんな場面？", hint: "その人が、そこで何をしているか。" },
  { key: "gain", label: "その人にとって、うれしい変化は？", hint: "楽になること、できたらうれしい体験、どちらからでも。" },
  { key: "text", label: "品川で試してみたいこと", hint: "何を試せば、どんな人の体験が変わりそう？" },
  { key: "perspective", label: "ほかの立場から見ると？", hint: "別の人や場面を思い浮かべて、違う見方も書く。" },
];

export default function IdeaWorksheet({ values, text, onTextChange, onChange, inputRef, isReply = false }: Props) {
  const id = useId();
  return <div className="idea-worksheet" role="group" aria-label="個人の記入シート">
    {fields.map(({ key, label, hint }) => {
      const main = key === "text";
      const fieldId = id + "-" + key;
      const change = (value: string) => {
        if (main) return onTextChange(value);
        const next = { ...values };
        if (value) next[key] = value;
        else delete next[key];
        onChange(next);
      };
      return <div className={"idea-cell" + (main ? " idea-cell-main" : "")} key={key}>
        <label htmlFor={fieldId}>{main && isReply ? "共感した理由・付け足したいこと" : label}</label>
        <small id={fieldId + "-help"}>{main && isReply ? "どの言葉に共感しましたか？　あなた自身の経験を一言。" : hint}</small>
        <textarea id={fieldId} data-worksheet-key={key} ref={main ? inputRef : undefined}
          aria-describedby={fieldId + "-help"} maxLength={WORKSHEET_FIELD_LIMIT} rows={3}
          value={main ? text : values[key] || ""} onChange={event => change(event.target.value)} />
      </div>;
    })}
  </div>;
}
