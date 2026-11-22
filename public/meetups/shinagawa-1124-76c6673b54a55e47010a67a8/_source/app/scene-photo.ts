import { assetUrl } from "./asset-url";
import type { AnalysisInput } from "./post-analysis";

export type ScenePhoto = { src: string; alt: string; caption: string };
type Scene = { file: string; description: string; alt: string; cues: readonly RegExp[] };

// Original generated illustrations of everyday situations. Never infer a person's
// appearance, identity or mobility from their name, age, team or recorded byline.
const scenes: readonly Scene[] = [
  {
    file: "step-free", description: "段差のない通路を移動する場面",
    alt: "手すりのある通路を、車いすを利用する人と同行者が進む",
    cues: [/車(?:[いイ][すス]|椅子)|wheelchair/iu, /段差|バリアフリー|ステップフリー|スロープ|手すり|手摺/u],
  },
  {
    file: "rain", description: "雨の日にまちを歩く場面",
    alt: "雨に濡れた歩道を、透明な傘をさした人が歩く",
    cues: [/雨宿り|雨よけ|雨除け|雨の日|雨天|雨降り|雨が降|濡れず|ぬれず|レインコート|雨具/u, /雨|傘|umbrella|rainy/iu],
  },
  {
    file: "bench", description: "木陰のベンチでひと休みする場面",
    alt: "木々に囲まれた屋外のベンチに、人が腰を掛けている",
    cues: [/ベンチ|腰掛け|腰掛|ひと休み|一休み|一息|ひと息|休憩|休息|休める|座れる|座りたい|休みたい|休む場所|bench/iu, /木陰|日陰|休憩所/u],
  },
  {
    file: "shops", description: "まちの店で買い物をする場面",
    alt: "通りに面した小さな店で、店主がお客さんに品物を手渡す",
    cues: [/商店街|個人商店|商店主|店舗|店主|お店|商店|小売|八百屋|青果|買い物|買物|お買いもの/u, /飲食店|飲食街|店先|商売|食材|食べ歩き|shopping/iu],
  },
  {
    file: "station", description: "駅で乗り換えや待ち合わせをする場面",
    alt: "駅の大きな時計の下を、人が通り抜けていく",
    cues: [/乗り換え|乗換|のりかえ|改札|駅構内|駅ナカ|駅なか|コンコース|新幹線|ホームドア|乗車|乗り場|乗場|下車/u, /待ち合わせ|待合せ|合流|集合場所|出発時刻|時刻表|電車|終電|鉄道|train station/iu],
  },
];
const streets: Scene = {
  file: "city", description: "品川のまちなみ", alt: "木立の向こうにビルが並ぶ、都市の広場のイメージ", cues: [],
};

export function selectScenePhoto(entry: AnalysisInput): ScenePhoto {
  const sheet = entry.worksheet || {};
  const main = new Set([entry.enteredText ?? entry.text, sheet.scene, sheet.teamScene, sheet.partners].filter(Boolean));
  const other = [entry.context, ...Object.entries(sheet).filter(([key]) => key !== "recorder").map(([, value]) => value)];
  const supporting = [...new Set(other.filter(text => text && !main.has(text)))].join("\n").normalize("NFKC");
  const subject = [...main].join("\n").normalize("NFKC");
  let chosen = streets;
  let best = 0;
  for (const scene of scenes) {
    let score = 0;
    for (const cue of scene.cues) {
      if (cue.test(subject)) score += 3;
      if (cue.test(supporting)) score += 1;
    }
    if (score > best) { chosen = scene; best = score; }
  }
  return { src: assetUrl("/scene-photos/" + chosen.file + ".webp"), alt: chosen.alt, caption: chosen.description + "のイメージ（AI生成）" };
}
