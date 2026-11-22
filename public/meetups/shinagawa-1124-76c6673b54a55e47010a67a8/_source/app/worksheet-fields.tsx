"use client";
import { useId } from "react";
import { WORKSHEET_FIELD_LIMIT, WORKSHEET_KEYS, worksheetField, worksheetGroups } from "./worksheet";
import type { Worksheet, WorksheetKey, WorksheetMode } from "./worksheet";
import "./worksheet-fields.css";

type ReadProps = { mode: WorksheetMode; values?: Worksheet; };
type EditProps = ReadProps & { onChange: (values: Worksheet) => void; disabled?: boolean; inline?: boolean; exclude?: readonly WorksheetKey[]; summaryLabel?: string; };
function keysFor(mode: WorksheetMode, values: Worksheet) {
  const main = worksheetGroups[mode];
  return [...main, ...WORKSHEET_KEYS.filter(key => !main.includes(key) && values[key]?.trim())];
}

export default function WorksheetFields({ mode, values = {}, onChange, disabled = false, inline = false, exclude = [], summaryLabel = "シートの項目から書く" }: EditProps) {
  const id = useId();
  const keys = keysFor(mode, values).filter(key => !exclude.includes(key));
  const count = keys.filter(key => values[key]?.trim()).length;
  const setValue = (key: WorksheetKey, value: string) => {
    const next = { ...values };
    if (value) next[key] = value;
    else delete next[key];
    onChange(next);
  };
  const inputs = <div className="sheet-grid">
      <p>一つだけでも共有できます。書きたい欄からどうぞ。</p>
      {keys.map(key => {
        const { label, hint } = worksheetField(key, mode);
        const fieldId = id + "-" + key;
        return <div key={key} className="sheet-field">
          <label htmlFor={fieldId}>{label}</label>
          {hint && <small id={fieldId + "-hint"}>{hint}</small>}
          {key === "recorder" ? <input id={fieldId} value={values[key] || ""} disabled={disabled} maxLength={WORKSHEET_FIELD_LIMIT} onChange={e => setValue(key, e.target.value)} /> :
            <textarea id={fieldId} rows={2} disabled={disabled} aria-describedby={hint ? fieldId + "-hint" : undefined}
              maxLength={WORKSHEET_FIELD_LIMIT} value={values[key] || ""} onChange={e => setValue(key, e.target.value)} />}
        </div>;
      })}
    </div>;
  if (inline) return inputs;
  return <details className="sheet-fields">
    <summary>{summaryLabel} <span>{count ? count + "項目を記入" : "任意"}</span></summary>
    {inputs}
  </details>;
}

export function WorksheetReadout({ mode, values = {} }: ReadProps) {
  const keys = keysFor(mode, values).filter(key => values[key]?.trim());
  if (!keys.length) return null;
  return <details className="sheet-readout">
    <summary>記入した項目を見る <span>{keys.length}項目</span></summary>
    <dl>{keys.map(key => <div key={key}><dt>{worksheetField(key, mode).label}</dt><dd>{values[key]}</dd></div>)}</dl>
  </details>;
}
