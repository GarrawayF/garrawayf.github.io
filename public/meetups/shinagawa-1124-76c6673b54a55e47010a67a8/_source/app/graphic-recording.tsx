"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import "./graphic-recording.css";

type Props = {
  title: string;
  person?: string;
  scene?: string;
  proposal?: string;
  gain?: string;
};
type Accent = "pink" | "blue" | "green";
type Glyph = "train" | "bus" | "bench" | "rain" | "shop" | "talk" | "park" | "path" | "cart" | "wheelchair" | "food" | "phone" | "sign" | "hands" | "people" | "notebook";
type Note = { label:string; text:string; accent:Accent; defaultGlyph:Glyph };
type Match = { kind:Glyph; at:number; length:number };

const motifs: ReadonlyArray<readonly [Glyph, RegExp]> = [
  ["train", /新幹線|列車|電車|改札|ホーム|乗り換え|乗換|鉄道|駅前|品川駅/u],
  ["bus", /路線バス|バス停|バス|自動運転車|e-Palette/u],
  ["bench", /ベンチ|椅子|座れ|座る|腰掛|着席|休憩|一休み|休め|立ち上が/u],
  ["rain", /雨よけ|雨宿り|雨の日|雨|傘|日陰|日よけ|屋根/u],
  ["shop", /商店街|買い物|店舗|店主|店先|お店|売り場|売店|商店/u],
  ["talk", /話し合|話しかけ|言葉を交|声をかけ|声を掛け|会話|対話|交流|ミーティング|聞き取|相談/u],
  ["park", /公園|広場|植栽|植樹|木陰|緑|花壇|庭/u],
  ["path", /散歩|歩行|歩く|徒歩|横断|通学路|坂道|歩道|通路|回遊|移動経路|行き方/u],
  ["cart", /ベビーカー|子連れ|抱っこ|乳児|幼児|育児/u],
  ["wheelchair", /車いす|車イス|車椅子|段差|バリアフリー|スロープ/u],
  ["food", /カフェ|珈琲|コーヒー|食事|料理|昼食|小皿|ご飯|お茶|飲食|キッチン/u],
  ["phone", /スマホ|スマートフォン|アプリ|二次元コード|QRコード|デジタル|画面/u],
  ["sign", /地図|マップ|道案内|案内板|道しるべ|目印|サイン|待ち合わせ/u],
  ["hands", /助け合|手伝|支え合|一緒に|協力|共助|ボランティア/u],
  ["people", /住民|子ども|子供|学生|高齢者|家族|利用者|社員|来訪者|旅行者/u],
];

const tidy = (value?: string) => typeof value === "string" ? value.trim().replace(/\s+/gu," ") : "";
function short(value: string, limit: number) {
  const chars = Array.from(value);
  return chars.length > limit ? chars.slice(0,limit).join("") + "…" : value;
}
function matches(text: string): Match[] {
  return motifs.flatMap(([kind,regex]) => {
    const found = regex.exec(text);
    return found ? [{kind,at:found.index,length:found[0].length}] : [];
  }).sort((left,right) => left.at-right.at || right.length-left.length);
}
function choose(text: string, fallback: Glyph, limit: number) {
  const found = matches(text);
  const visible: Glyph[] = [];
  for (const hit of found) {
    // Avoid drawing the broad station motif over a more specific use of the same letters.
    if (visible.includes(hit.kind)) continue;
    visible.push(hit.kind);
    if (visible.length >= limit) break;
  }
  return visible.length ? visible : [fallback];
}

/* Compact hand-drawn pictograms, using only shapes and no externally loaded images. */
function Drawing({ kind }: { kind:Glyph }) {
  switch(kind) {
    case "train": return <>
      <path className="gr-fill" d="M20 64q-3-7-2-27 0-16 14-18 15-2 34 0 12 1 14 17l1 28-11 7H31Z"/>
      <path d="M23 66q-4-3-5-11l1-19q0-15 14-16 19-2 34 1 12 3 13 16l1 27-12 7H34Z"/>
      <path d="M28 31q3-4 8-4h26q6 0 8 5v18q-22-3-42 0Z"/>
      <circle cx="31" cy="58" r="3"/><circle cx="69" cy="58" r="3"/><path d="m31 72-7 13m44-13 9 13m-49-5 45 1"/>
    </>;
    case "bus": return <>
      <path className="gr-fill" d="M11 34q1-10 13-11l47 1q13 1 16 13l2 29q-9 9-20 9H23q-10-1-11-9Z"/>
      <path d="M11 34q1-10 13-11l47 1q13 1 16 13l2 29q-6 9-20 9H23q-10-1-11-9Zm10-2 48 1q9 2 10 10l1 10H21Zm14 1v19m20-18v18m-42 9h76m-11-4 1 8"/>
      <circle cx="29" cy="75" r="8"/><circle cx="72" cy="75" r="8"/>
    </>;
    case "bench": return <>
      <path className="gr-fill" d="m23 32 57 1-2 17-55 1Zm-10 22 76-1-3 11-69-1Z"/>
      <path d="M23 48q-2-9 0-17 26-4 57 0l-1 18Zm-6 4 67 1q5 0 5 9l-73 2Zm9 12-3 17m53-18 1 18m-51-7 50-1m-51-23-1 3m50-3 1 3"/>
      <path className="gr-dash" d="m17 83 66-1"/>
    </>;
    case "rain": return <>
      <path className="gr-fill" d="M12 48C16 26 36 18 50 18c22 0 36 15 39 30-7-6-14-5-20 1-6-8-14-7-20 1-6-7-15-6-20 0-5-6-11-7-17-2Z"/>
      <path d="M12 48C16 26 36 18 50 18c22 0 36 15 39 30-7-6-14-5-20 1-6-8-14-7-20 1-6-7-15-6-20 0-5-6-11-7-17-2Zm38-35v6m-1 29-1 29q0 11 9 8 4-2 4-7"/>
      <path className="gr-dash" d="m16 56-4 10m15-4-4 9m45-6-3 8m15-14-3 11"/>
    </>;
    case "shop": return <>
      <path className="gr-fill" d="m20 27 60 1 8 16q-10 11-20 2-8 7-16 1-8 7-17 0-12 6-22-3Z"/>
      <path d="m20 27 60 1 8 16q-10 11-20 2-8 7-16 1-8 7-17 0-12 6-22-3Zm0 23 1 32 61-1 1-31m-48-4 4-18m12 18 1-18m15 17-3-17m-32 54V59h19v23m11-24h13v13H62Z"/>
      <circle cx="43" cy="70" r="1.6"/>
    </>;
    case "talk": return <>
      <path className="gr-fill" d="M9 29q1-12 15-13l27 1q11 1 12 10l-1 12q-2 9-12 10l-14 1-14 11 3-11q-15 0-16-13Z"/>
      <path d="M9 29q1-12 15-13l27 1q11 1 12 10l-1 12q-2 9-12 10l-14 1-14 11 3-11q-15 0-16-13Zm55 15 14 1q14 1 14 11l-1 8q-1 10-10 11l-2 11-11-10-16-1q-9-1-9-11l1-7m-21-22 27 1m-23-7 19 1m14 31 21 1"/>
    </>;
    case "park": return <>
      <path className="gr-fill" d="M48 16q16-12 24 6 14 0 17 15 3 16-13 19-5 12-18 7l-9 4q-16-2-19-17-13-10-4-23 5-7 13-6Z"/>
      <path d="M48 16q16-12 24 6 14 0 17 15 3 16-13 19-5 12-18 7l-9 4q-16-2-19-17-13-10-4-23 5-7 13-6Zm12 65V40m0 17-13-9m13 7 12-9m-56 39q34-3 72 0m-68-5-3-7m5 8 4-8"/>
    </>;
    case "path": return <>
      <path className="gr-fill" d="m14 78 17-27 40-13 17-18 6 10-16 18-36 17-14 17Z"/>
      <path d="m14 78 17-27 40-13 17-18m-60 62 14-17 36-17 16-18M17 32l10 6m-8 1-6 3m72 31 6 5"/>
      <path d="M37 25q-4-8 1-11 4-4 8 0 4 4 0 10l-6 10Z"/><circle cx="42" cy="18" r="2"/>
      <path className="gr-dash" d="m22 75 17-18 36-14 15-17"/>
    </>;
    case "cart": return <>
      <path className="gr-fill" d="M24 40h53q-2 20-17 28H43q-17-7-19-28Zm2-2q0-23 29-25v25Z"/>
      <path d="M25 39q0-24 29-25v25m-40-2 9 3h54q-1 20-18 27H43q-16-6-20-27m22 28-13 12m24-12 13 12m-33 1h29"/>
      <circle cx="28" cy="82" r="6"/><circle cx="72" cy="82" r="6"/>
    </>;
    case "wheelchair": return <>
      <circle className="gr-fill" cx="42" cy="63" r="19"/><circle cx="43" cy="63" r="20"/>
      <circle cx="53" cy="21" r="8"/><path d="m51 31-5 22 21 1 8 19h9m-36-30 15 1m-18 9-8 16-9-1"/>
      <path className="gr-dash" d="M13 86h76"/>
    </>;
    case "food": return <>
      <path className="gr-fill" d="m24 40 45 1-3 28q-4 10-20 10-16-1-19-12Z"/>
      <path d="m24 40 45 1-3 28q-4 10-20 10-16-1-19-12Zm47 4 7 1q11 2 5 12-3 5-13 6m-52 21q30 3 66-1m-43-52q-6-6 1-11m11 9q5-4 0-8"/>
    </>;
    case "phone": return <>
      <path className="gr-fill" d="M32 14q18-2 39 1l3 69q-21 4-42 0Z"/>
      <path d="M32 14q18-2 39 1l3 69q-21 4-42 0Zm7 9 25 1 2 47-27 1Z"/>
      <path d="m44 53 8-10 7 6m-8-19h4m-5 49h6"/><path className="gr-dash" d="m16 28-5-4m12-8-3-7m58 15 8-5"/>
    </>;
    case "sign": return <>
      <path className="gr-fill" d="m17 23 56 1 13 12-13 12-56 1Z"/>
      <path d="m17 23 56 1 13 12-13 12-56 1Zm27-9 1 8m0 28v33m9-34 1 34m-18 1 26-1m-34-47 42 1m-9-7 9 7-9 7"/>
    </>;
    case "hands": return <>
      <path className="gr-fill" d="m13 58 14-25 14 8 8-6 13 1 23 16-15 23-13 5-18-9-12-6Z"/>
      <path d="m13 58 14-25 14 8 8-6 13 1 23 16-15 23-13 5-18-9-12-6Zm27-17-7 14 8 5 12-11 19 19m-20-5 14 11m-22-5 12 9m-32-24 5 3m46 6 5-7"/>
    </>;
    case "people": return <>
      <path className="gr-fill" d="M23 69q1-15 14-20 15 2 18 17 2-9 12-12 13 2 17 15l-1 8-62-1Z"/>
      <circle cx="39" cy="36" r="10"/><circle cx="69" cy="44" r="8"/>
      <path d="M22 76v-8q3-17 16-18 16 1 18 20v7m-2-8q4-13 15-14 13 2 15 15l-1 8m-54 2 44 1"/>
    </>;
    default: return <>
      <path className="gr-fill" d="m23 18 49 1 3 64-49 1Z"/>
      <path d="m23 18 49 1 3 64-49 1Zm10 9 1 47m7-41 22 1m-22 10 22 2m-22 8 17 1m-17 9 23-2m17-35 9-12-6-4-9 11Z"/>
    </>;
  }
}

function Sketch({ glyphs, variation }: { glyphs:Glyph[]; variation:number }) {
  const multiple = glyphs.length > 1;
  return <svg className="gr-sketch" viewBox="0 0 210 105" fill="none" aria-hidden="true" focusable="false">
    <path className="gr-brush" d="M37 32Q68 14 123 21q45 5 59 24 9 25-14 40-28 14-97 5-33-4-41-19-9-14 7-39Z"/>
    <path className="gr-paper-line" d="M25 94q49-7 89-3 34 3 74-1"/>
    <g className="gr-art">
      {glyphs.map((kind,i) => {
        const x = multiple ? (i === 0 ? 25 : 107) : 65;
        const y = multiple ? (i === 0 ? 19 : 12) : 7;
        const tilt = (variation + i) % 2 ? -4 : 4;
        return <g key={kind} transform={'translate('+x+' '+y+') scale('+(multiple ? .76 : .86)+') rotate('+tilt+' 50 54)'}><Drawing kind={kind}/></g>;
      })}
    </g>
    <path className="gr-spark" d={variation % 2 ? "m29 29 1-9m-5 4 9 1m147 52 2-10m-7 5 10 1" : "m31 16 1 10m-6-5 10 1m147 12 1-10m-7 5 11 1"}/>
  </svg>;
}

export default function GraphicRecording({ title, person, scene, proposal, gain }: Props) {
  const caption = [tidy(person),tidy(scene)].filter(Boolean).join(" ／ ");
  const action = tidy(proposal);
  const impact = tidy(gain);
  const active: Note[] = [];
  if (caption) active.push({label:"誰・どんな場面",text:caption,accent:"blue",defaultGlyph:"people"});
  if (action) active.push({label:"試したいこと",text:action,accent:"pink",defaultGlyph:"notebook"});
  else if (tidy(title)) active.push({label:"案の見出し",text:tidy(title),accent:"pink",defaultGlyph:"notebook"});
  if (impact) active.push({label:"うれしい変化",text:impact,accent:"green",defaultGlyph:"notebook"});
  const id = useId();
  const paper = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  const hasNotes = active.length > 0;
  useEffect(() => {
    if (near || !hasNotes) return;
    const element = paper.current;
    if (!element) return;
    if (typeof IntersectionObserver !== "function") {
      const frame = requestAnimationFrame(() => setNear(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setNear(true);
      observer.disconnect();
    }, { rootMargin:"240px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNotes, near]);
  if (!hasNotes) return null;
  const variation = Array.from(tidy(title)).reduce((n,c) => n + (c.codePointAt(0) || 0), 0);
  return <figure className="gr-paper" ref={paper} aria-labelledby={id}>
    <figcaption className="gr-top" id={id}>
      <div><span className="gr-kicker">GRAPHIC RECORDING</span><h3>イメージスケッチ</h3></div>
      <p>記入された言葉を絵と言葉で整理</p>
    </figcaption>
    <ol className="gr-panels" style={{"--gr-count":active.length} as CSSProperties}>
      {active.map((note,i) => <li className="gr-panel" key={note.label} data-gr-accent={note.accent}>
        {i>0 && <svg className="gr-arrow" viewBox="0 0 28 18" fill="none" aria-hidden="true"><path d="M2 9q12 3 23 0m-7-4 8 4-8 5"/></svg>}
        {near ? <Sketch glyphs={choose(note.text,note.defaultGlyph,2)} variation={variation+i}/> :
          <span className="gr-sketch gr-placeholder" aria-hidden="true" /> }
        <div className="gr-note"><h4>{note.label}</h4><p>{short(note.text,82)}</p></div>
      </li>)}
    </ol>
    <p className="gr-foot">絵は記載内容のイメージです。</p>
  </figure>;
}
