import { z } from "zod";
import { WORKSHEET_FIELD_LIMIT, WORKSHEET_KEYS, type Worksheet } from "../worksheet";

const allowed = new Set<string>(WORKSHEET_KEYS);
export const worksheetInput = z.record(z.string().max(WORKSHEET_FIELD_LIMIT))
  .refine(values => Object.keys(values).every(key => allowed.has(key)))
  .transform(values => {
    const sheet: Worksheet = {};
    // Ignore blank fields; retain entered text (including internal newlines).
    for (const key of WORKSHEET_KEYS) {
      if (values[key]?.trim()) sheet[key] = values[key];
    }
    return sheet;
  });

export const worksheetMessages = {
  content: "書きやすい欄に一つ入力してください。名前・記録担当だけでは保存できません。",
  worksheet: "各欄は800文字以内で入力してください。",
};

export function sameWorksheet(left: Worksheet, right: Worksheet) {
  return WORKSHEET_KEYS.every(key => (left[key] ?? "") === (right[key] ?? ""));
}
