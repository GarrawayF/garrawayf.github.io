"use client";
import { useId } from "react";
import type { RefObject } from "react";
import { ChevronRight } from "lucide-react";
import { WORKSHEET_FIELD_LIMIT, type Worksheet, type WorksheetKey } from "./worksheet";
import "./idea-worksheet.css";

type Props = {
  values: Worksheet;
  text: string;
  onTextChange: (value: string) => void;
  onChange: (values: Worksheet) => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  label?: string; placeholder?: string; help?: string; disabled?: boolean;
  isReply?: boolean;
};

const fields: readonly { key: WorksheetKey; label: string; hint: string }[] = [
  { key: "person", label: "誰のことを考える？", hint: "品川で過ごす一人を思い浮かべてください。" },
  { key: "scene", label: "いつ、どんな場面？", hint: "その人はそこで何をしていますか？" },
  { key: "gain", label: "その人にとって、うれしい変化は？", hint: "楽になること、体験できたらうれしいことなど。" },
  { key: "perspective", label: "ほかの立場から見ると？", hint: "別の人や場面を思い浮かべてください。" },
];

export default function IdeaWorksheet({ values, text, onTextChange, onChange, inputRef, isReply = false, label, placeholder, help, disabled = false }: Props) {
  const id = useId();
  const filled = fields.filter(({ key }) => values[key]?.trim()).length;
  return <div className="idea-worksheet">
    <div className="idea-cell idea-cell-main">
      <h1><label htmlFor={id + "-text"}>{label || (isReply ? "共感した理由・付け足したいこと" : "品川で試してみたいこと")}</label></h1>
      <textarea id={id + "-text"} ref={inputRef} data-worksheet-key="text" rows={3}
        maxLength={WORKSHEET_FIELD_LIMIT} aria-describedby={id + "-help"} value={text}
        disabled={disabled} placeholder={placeholder || (isReply ? "私はここに共感しました。なぜなら…" : "思いついたことを、ここに一言。")}
        onChange={event => onTextChange(event.target.value)} />
      <small id={id + "-help"}>{help || (isReply ? "どの言葉に共感したか、自分の経験を添えてみてください。" : "誰かの案に共感した理由も書けます。")}</small>
    </div>
    <details className="optional-idea-sheet">
      <summary><ChevronRight size={16} aria-hidden="true" /><span>シートの項目から書く</span><small>{filled ? filled + "項目を記入済み" : "任意"}</small></summary>
      <div className="optional-idea-grid">
        {fields.map(({ key, label, hint }) => {
          const fieldId = id + "-" + key;
          return <div className="idea-cell" key={key}>
            <label htmlFor={fieldId}>{label}</label>
            <small id={fieldId + "-help"}>{hint}</small>
            <textarea id={fieldId} data-worksheet-key={key} rows={2} disabled={disabled}
              aria-describedby={fieldId + "-help"} maxLength={WORKSHEET_FIELD_LIMIT}
              value={values[key] || ""} onChange={event => {
                const next = { ...values };
                if (event.target.value) next[key] = event.target.value;
                else delete next[key];
                onChange(next);
              }} />
          </div>;
        })}
      </div>
    </details>
  </div>;
}
