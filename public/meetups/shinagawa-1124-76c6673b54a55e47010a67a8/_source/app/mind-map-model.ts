import { extractIdeaKeywords } from "./idea-keywords";
import { roundLabels, type EventRound } from "./event-round";
import type { PostAnalysis } from "./post-analysis";
import { worksheetHeadline, type Worksheet } from "./worksheet";

export type MapTeam = "A" | "B" | "C" | "D" | "E";
export type MapGroup = MapTeam | "all";
type RecordBase = { id: string; text: string; enteredText?: string; worksheet?: Worksheet; createdAt: string; analysis?: PostAnalysis };
export type MapIdea = RecordBase & { team: MapTeam; round: EventRound; name: string; context: string; parentId: string | null };
export type MapTheme = RecordBase & { team: MapGroup; round: EventRound | 5; sourceIdeaId: string | null; sourceIdeaId2?: string | null };
export type MapRecord = { key: string; title: string } & ({ kind: "idea"; row: MapIdea } | { kind: "theme"; row: MapTheme });
export const mapGroups: MapGroup[] = ["A", "B", "C", "D", "E", "all"];
export const groupLabel = (team: MapGroup) => team === "all" ? "会場全体" : team + "班";
export const stageLabel = (round: EventRound | 5) => round === 5 ? "3講演を通したまとめ" : roundLabels[round];
export const kindLabel = (entry: Pick<MapRecord, "kind" | "row">) => entry.kind === "idea" ? "個人案" : entry.row.team === "all" ? "全体の案" : "班のまとめ";
export const locationLabel = (entry: MapRecord) => groupLabel(entry.row.team) + " · " + stageLabel(entry.row.round);

export function buildIdeaMap(ideas: readonly MapIdea[], themes: readonly MapTheme[]) {
  const records: MapRecord[] = [...ideas.map(row => ({ kind: "idea" as const, row })), ...themes.map(row => ({ kind: "theme" as const, row }))].map(entry => {
    const fallback = worksheetHeadline(entry.row.text, entry.row.worksheet, entry.kind === "idea" ? entry.row.context : "");
    return { ...entry, key: entry.kind + ":" + entry.row.id, title: entry.row.analysis?.title?.trim() || fallback || kindLabel(entry) };
  });
  records.sort((a,b) => a.row.createdAt.localeCompare(b.row.createdAt) || a.key.localeCompare(b.key));
  const byKey = new Map(records.map(record => [record.key, record]));
  const sources = new Map<string, MapRecord[]>();
  const successors = new Map<string, MapRecord[]>();
  for (const entry of records) {
    const ids = entry.kind === "idea" ? [entry.row.parentId] : [entry.row.sourceIdeaId, entry.row.sourceIdeaId2];
    for (const id of new Set(ids)) {
      if (!id) continue;
      const source = byKey.get("idea:" + id);
      if (!source || source.key === entry.key) continue;
      if (!sources.has(entry.key)) sources.set(entry.key, []);
      sources.get(entry.key)!.push(source);
      if (!successors.has(source.key)) successors.set(source.key, []);
      successors.get(source.key)!.push(entry);
    }
  }
  return { records, byKey, sources, successors };
}
export type IdeaMap = ReturnType<typeof buildIdeaMap>;

export function defaultFocus(records: readonly MapRecord[], graph: IdeaMap) {
  // Prefer a theme that combines two original ideas, then a recorded link, then a standalone post.
  const plenary = records.filter(entry => entry.row.team === "all" && (graph.sources.get(entry.key)?.length || 0) > 1);
  return plenary.find(entry => new Set(graph.sources.get(entry.key)?.map(source => source.row.team)).size > 1) ||
    plenary[0] || records.find(entry => (graph.sources.get(entry.key)?.length || 0) > 1) ||
    records.find(entry => graph.sources.has(entry.key)) || records.find(entry => graph.successors.has(entry.key)) || records[0];
}

export type MapBox = { x:number; y:number; width:number; height:number; label:string; id:string; meta?:string; entry?:MapRecord; style:"group"|"stage"|"idea"|"theme"; focus?:boolean; };
type Wire = { path:string; from:string; to:string; classification:boolean };
export type Diagram = { width:number; height:number; boxes:MapBox[]; wires:Wire[] };
const recordHeight = 88;
const stageHeight = 60;
const gap = 15;
const margin = 8;
const wrapPoint = 540;
const box = (x:number, y:number, width:number, height:number, label:string, id:string, style:MapBox["style"], meta?:string, entry?:MapRecord):MapBox => ({x,y,width,height,label,id,style,meta,entry});
function recordBox(entry:MapRecord, x:number, y:number, width:number, meta:string, height=recordHeight) {
  return box(x,y,width,height,entry.title,entry.key,entry.kind,meta,entry);
}
function wire(from:MapBox, to:MapBox, path:string, classification:boolean):Wire {
  return {from:from.id,to:to.id,path,classification};
}
function across(from:MapBox, to:MapBox, classification:boolean):Wire {
  const x1=from.x+from.width, y1=from.y+from.height/2, x2=to.x, y2=to.y+to.height/2, curve=(x2-x1)*.54;
  return wire(from,to,`M ${x1} ${y1} C ${x1+curve} ${y1}, ${x2-curve} ${y2}, ${x2} ${y2}`,classification);
}
function bentDown(from:MapBox, to:MapBox, distance:number):Wire {
  const x=from.x+distance, y1=from.y+from.height, y2=to.y+to.height/2;
  return wire(from,to,`M ${x} ${y1} V ${y2-8} Q ${x} ${y2}, ${x+8} ${y2} H ${to.x}`,true);
}

export function groupDiagram(width:number, group:MapGroup, records: MapRecord[], count:number, compact=false): Diagram {
  const small=width<wrapPoint;
  const nodeHeight=compact && !small ? 61 : recordHeight;
  const stage=compact && !small ? 41 : stageHeight;
  const space=compact && !small ? 9 : gap;
  const boxes:MapBox[]=[], wires:Wire[]=[];
  const stageEntries = Array.from(new Set(records.map(entry=>entry.row.round))).sort((a,b)=>a-b);
  const groupW = small ? Math.min(155,width-margin*2) : Math.min(124,width*.17);
  const stageX = small ? 43 : groupW+width*.055;
  const stageW = small ? Math.min(220,width-stageX-margin) : Math.min(175,width*.23);
  const leafX=small ? 64 : stageX+stageW+width*.07;
  const leafW=width-leafX-margin;
  const root=box(small ? 24 : margin,margin+stage+space,groupW,stage,groupLabel(group),"group:"+group,"group",count+"件");
  boxes.push(root);
  let y=small?root.y+root.height+space:margin+stage+space;
  const categories:MapBox[]=[];
  for (const round of stageEntries) {
    const category=box(stageX,y,stageW,stage,stageLabel(round),"round:"+round,"stage");
    boxes.push(category); categories.push(category);
    if (small) y+=category.height+space;
    const top=y;
    for (const entry of records.filter(r=>r.row.round===round)) {
      const leaf=recordBox(entry,leafX,y,leafW,kindLabel(entry),nodeHeight);
      boxes.push(leaf); y+=leaf.height+space;
    }
    if (!small) category.y=(top+y-space-category.height)/2;
    for (const target of boxes.filter(b=>b.entry?.row.round===round)) wires.push(small ? bentDown(category,target,10) : across(category,target,true));
    y+=space;
  }
  if (!small) root.y=(y-space+margin+stage+space-root.height)/2;
  const event=box(margin,small ? margin : root.y-stage-space,groupW,stage,"品川","event","group","議論の対象");
  boxes.unshift(event);
  if (small) wires.push(bentDown(event,root,8));
  else {
    const mid=event.x+event.width/2;
    wires.push(wire(event,root,`M ${mid} ${event.y+event.height} V ${root.y}`,true));
  }
  for (const stage of categories) wires.push(small ? bentDown(root,stage,8) : across(root,stage,true));
  return {width, height:y, boxes,wires};
}

export function relationsDiagram(width:number, focus:MapRecord, sources:readonly MapRecord[], successors:readonly MapRecord[], compact=false):Diagram {
  const small=width<wrapPoint;
  const nodeHeight=compact && !small ? 61 : recordHeight;
  const space=compact && !small ? 10 : gap;
  const boxes:MapBox[]=[], wires:Wire[]=[];
  if (small) {
    const x=Math.min(27,width*.09), w=width-x-margin, railGap=16;
    let y=margin;
    const incoming = sources.map(entry => {
      const item=recordBox(entry,x,y,w,groupLabel(entry.row.team)+" · 元の個人案");
      boxes.push(item); y+=recordHeight+gap; return item;
    });
    if (incoming.length) y+=railGap;
    const center=recordBox(focus,margin,y,width-2*margin,groupLabel(focus.row.team)+" · "+kindLabel(focus));
    center.focus=true; boxes.push(center); y+=recordHeight+gap+(successors.length?railGap:0);
    incoming.forEach((item, index) => {
      const rail = margin + 3 + index * 5;
      const middle = item.y + item.height / 2;
      const endX = center.x + 25 + index * 18;
      const kneeY = center.y - (10 + index * 5);
      wires.push(wire(item, center,
        `M ${item.x} ${middle} H ${rail + 4} Q ${rail} ${middle}, ${rail} ${middle + 4} V ${kneeY - 4} Q ${rail} ${kneeY}, ${rail + 4} ${kneeY} H ${endX - 4} Q ${endX} ${kneeY}, ${endX} ${kneeY + 4} V ${center.y}`, false));
    });
    for (const entry of successors) {
      const item=recordBox(entry,x,y,w,groupLabel(entry.row.team)+" · "+(entry.kind==="idea"?"この案からの投稿":kindLabel(entry)));
      boxes.push(item);
      const left=margin+3, middle=item.y+item.height/2;
      wires.push(wire(center,item,`M ${left} ${center.y+center.height} V ${middle-6} Q ${left} ${middle}, ${left+6} ${middle} H ${item.x}`,false));
      y+=recordHeight+gap;
    }
    return {width,height:y,boxes,wires};
  }
  const hasSources=sources.length>0, hasNext=successors.length>0;
  const cols=1+Number(hasSources)+Number(hasNext);
  const laneGap=Math.min(65,width*.063), w=Math.min(325,(width-margin*2-(cols-1)*laneGap)/cols);
  const start=(width-(w*cols+laneGap*(cols-1)))/2, cx=start+(hasSources ? w+laneGap : 0);
  const n=Math.max(1,sources.length,successors.length), height=n*(nodeHeight+space)-space+2*margin;
  const center=recordBox(focus,cx,(height-nodeHeight)/2,w,groupLabel(focus.row.team)+" · "+kindLabel(focus),nodeHeight);
  center.focus=true; boxes.push(center);
  function neighbors(entries:readonly MapRecord[], before:boolean) {
    const top=(height-(entries.length*(nodeHeight+space)-space))/2;
    entries.forEach((entry,index)=>{
      const meta=groupLabel(entry.row.team)+" · "+(before ? "元の個人案" : entry.kind==="idea" ? "この案からの投稿" : kindLabel(entry));
      const item=recordBox(entry,before?start:cx+w+laneGap,top+index*(nodeHeight+space),w,meta,nodeHeight);
      boxes.push(item); wires.push(before?across(item,center,false):across(center,item,false));
    });
  }
  neighbors(sources,true); neighbors(successors,false);
  return {width,height,boxes,wires};
}

const sharedConcepts = [
  "雨の日","雨よけ","日よけ","屋根付き","ベンチ","休憩場所","車いす","車椅子","段差","ベビーカー",
  "乗り換え","乗換","待ち合わせ","道案内","案内マップ","案内表示","多言語","回遊","寄り道","商店街",
  "地元店舗","マルシェ","シェアサイクル","自転車","荷物預かり","子育て","子ども","通勤","高齢者",
  "防災","避難","災害","空き店舗","広場","歩行者","信号待ち","日陰","横断歩道","歩道橋","電話","片手","改札",
] as const;
const genericTerms = new Set(["品川","品川駅","駅前","駅周辺","利用者","移動","情報","場所","地域","空間","サービス","イベント","仕組み","アイデア","課題","交通","モビリティ","まちづくり","共同","交流","イメージ","スペース","プロジェクト","コミュニティ","写真","休憩","人","場所","時間","方法","目線","案内","駅","出口","店","テスト","途中","違い","候補","安心","同じ","場合","提案","対応","確認","状態","改善","体験","現場","選択","必要","実現","東京","名前","今日","二人","一軒","初めて","利用","確か","賛成","大人"]);
const concreteConcept = new Set<string>(sharedConcepts);
const singleAnchor = new Set(["雨よけ","日よけ","ベンチ","車いす","車椅子","ベビーカー","案内マップ","マルシェ","シェアサイクル","横断歩道","歩道橋","電話","片手","改札","空き店舗","荷物預かり","避難","段差"]);
const normalize = (text:string)=>text.normalize("NFKC").toLowerCase();
export type RelatedIdea = { entry:MapRecord; kind:"in" | "out" | "suggested"; evidence:string[]; strength:number };
function authoredText(entry:MapRecord) {
  // Analysis-derived titles and summaries, dates/team metadata and bylines are not evidence.
  const { row }=entry;
  return [row.enteredText ?? row.text, entry.kind==="idea"?entry.row.context:"",
    ...Object.entries(row.worksheet || {}).filter(([key])=>key!=="recorder").map(([,value])=>value),
  ].filter(Boolean).join("\n").replace(/https?:\/\/[^\s]+/gu, " ");
}
// A named, specific scenario may establish one inferred link even when writers use different words.
const scenarios = [
  {key:"baggage", label:"荷物を持たずに移動", terms:["荷物配送","荷物を届け","荷物を預け","手ぶらで移動","手ぶらで列車","手ぶらで街","荷物預かり"]},
  {key:"east-west", label:"駅の東西を横断", terms:["東西自由通路","東西をつな","東西を分断","高輪と港南","港南と高輪","線路で分断","線路を横断"]},
  {key:"step-free", label:"段差のない動線", terms:["段差のない","段差をなく","段差解消","バリアフリー動線","車いすで通","車椅子で通"]},
  {key:"rain-shelter", label:"雨を避けて移動・滞在", terms:["雨よけ","雨にぬれず","雨に濡れず","雨を避け","屋根の下で","屋根付きの通路"]},
  {key:"heat-reuse", label:"余剰熱を再利用", terms:["排熱を","廃熱を","余剰熱","捨てる熱","熱回収"]},
  {key:"station-free", label:"乗車せず駅に立ち寄る", terms:["切符がなくても","切符を買わなくても","切符なしで","改札の外に","電車に乗らない日"]},
] as const;
function conceptMatches(text:string) {
  return new Map(scenarios.flatMap(s=>{
    const term=s.terms.find(x=>text.includes(normalize(x)));
    return term?[[s.key,{label:s.label,term}] as const]:[];
  }));
}

export type PairLink = { from:MapRecord; to:MapRecord; edge:RelatedIdea; extended:boolean };
export function relatedPairs(center:MapRecord, page:readonly RelatedIdea[], content:ReadonlyMap<string,readonly RelatedIdea[]>, scope:"all"|"recorded"|"suggested") {
  const siblings=new Map(page.map(e=>[e.entry.key,e.entry]));
  const direct=new Set((content.get(center.key)||[]).map(e=>e.entry.key));
  const pairs:PairLink[]=[]; const seen=new Set<string>();
  for(const {entry} of page){
    for(const edge of content.get(entry.key)||[]){
      const other=edge.entry;
      if(other.key===center.key || (scope==="recorded" && edge.kind==="suggested") || (scope==="suggested" && edge.kind!=="suggested"))continue;
      // Never duplicate a spoke. Extend only to a genuinely new record when a
      // secondary branch isn't already drawn as a direct link with the center.
      const extended=!siblings.has(other.key);
      if(extended&&direct.has(other.key))continue;
      const key=[entry.key,other.key].sort().join("|");
      if(seen.has(key))continue;
      seen.add(key);
      const [from,to]=edge.kind==="in"?[other,entry]:[entry,other];
      pairs.push({from,to,edge,extended});
    }
  }
  return pairs.sort((a,b)=>Number(a.extended)-Number(b.extended)||Number(a.edge.kind==="suggested")-Number(b.edge.kind==="suggested")||b.edge.strength-a.edge.strength);
}

const contentTopics = [
  {key:"journey",title:"乗り換え・移動のしやすさ", terms:["乗り換え","乗換","駅間","バス停","改札","運行","乗降","タクシー","バスに乗","列車に乗","自転車","シェアサイクル"]},
  {key:"walk",title:"東西をつなぐ歩行空間", terms:["東西自由通路","東西をつな","東西を分断","高輪と港南","横断歩道","歩道橋","線路で分断","通り抜け","回遊","歩行者","歩行空間"]},
  {key:"place",title:"待ち合わせ・滞在・居場所", terms:["待ち合わせ","ベンチ","広場","座れる","座って","腰掛け","休憩場所","居場所","ラウンジ","滞在","電車に乗らない日"]},
  {key:"access",title:"雨・段差・移動のバリア", terms:["雨の日","雨よけ","屋根付き","ベビーカー","車いす","車椅子","バリアフリー","段差","日よけ","暑さ","高齢者"]},
  {key:"shops",title:"地域のお店・食・交流", terms:["地域商店","地元の店","地元店舗","商店街","地元の商店","マルシェ","飲食","食事","出店","市場","商い"]},
  {key:"information",title:"道案内・情報・サイン", terms:["道案内","案内マップ","案内板","多言語","観光案内","地図","目印","迷わず","現在地","案内サイン","デジタルサイネージ"]},
  {key:"freight",title:"荷物・配送・手ぶら移動", terms:["荷物を届け","荷物を預け","荷物配送","荷物預かり","手ぶら","ロッカー","物流","集荷","配送"]},
  {key:"resilience",title:"防災・エネルギー・環境", terms:["防災","避難","災害","排熱","余剰熱","熱回収","捨てる熱","給電","再生可能","脱炭素","非常用"]},
] as const;
export function groupIdeasByTopic(entries:readonly MapRecord[]) {
  const groups = new Map<string,{key:string;title:string;items:MapRecord[]}>();
  for(const t of contentTopics) groups.set(t.key,{key:t.key,title:t.title,items:[]});
  groups.set("other",{key:"other",title:"その他・分類前の案",items:[]});
  for(const entry of entries){
    const authored=normalize(authoredText(entry));
    let winner:string="other", best=0;
    for(const topic of contentTopics){
      const match=topic.terms.filter(term=>authored.includes(normalize(term)));
      const score=match.reduce((n,term)=>n+Math.min(term.length,6),0);
      if(score>best){best=score;winner=topic.key;}
    }
    groups.get(winner)!.items.push(entry);
  }
  return [...groups.values()].filter(g=>g.items.length).sort((a,b)=>Number(a.key==="other")-Number(b.key==="other")||b.items.length-a.items.length);
}

export function buildContentMap(graph:IdeaMap, visible:readonly MapRecord[]) {
  const keyset=new Set(visible.map(entry=>entry.key));
  const docs=new Map<string,Map<string,string>>();
  const index=new Map<string,string[]>();
  const conceptDocs=new Map<string,ReturnType<typeof conceptMatches>>();
  for(const entry of visible){
    const raw=authoredText(entry), text=normalize(raw);
    const phrases=new Map<string,string>();
    conceptDocs.set(entry.key,conceptMatches(text));
    for(const label of [...extractIdeaKeywords(raw),...sharedConcepts.filter(value=>text.includes(normalize(value)))]){
      const key=normalize(label);
      if(genericTerms.has(key) || key.length<2 || !text.includes(key)) continue;
      phrases.set(key,label);
    }
    docs.set(entry.key,phrases);
    for(const key of phrases.keys()) {
      if(!index.has(key)) index.set(key,[]);
      index.get(key)!.push(entry.key);
    }
  }
  const result=new Map<string,RelatedIdea[]>();
  for(const entry of visible){
    const explicit:RelatedIdea[]=[];
    for(const [kind,neighbors] of [["in",graph.sources.get(entry.key)],["out",graph.successors.get(entry.key)]] as const) {
      for(const next of neighbors || []) if(keyset.has(next.key) && !explicit.some(edge=>edge.entry.key===next.key)) explicit.push({entry:next,kind,evidence:[],strength:8});
    }
    const phrases=docs.get(entry.key)!;
    const possible=new Map<string,string[]>();
    for(const phrase of phrases.keys()){
      const members=index.get(phrase)!;
      if(members.length>Math.max(3,Math.ceil(visible.length*.34))) continue;
      for(const key of members){
        if(key===entry.key || explicit.some(edge=>edge.entry.key===key)) continue;
        if(!possible.has(key)) possible.set(key,[]);
        possible.get(key)!.push(phrase);
      }
    }
    const suggested:RelatedIdea[]=[];
    for(const [key,overlap] of possible){
      const themes=overlap.sort((a,b)=>Number(singleAnchor.has(b))-Number(singleAnchor.has(a)) || b.length-a.length)
        .filter((phrase,i,array)=>!array.slice(0,i).some(previous=>previous.includes(phrase)||phrase.includes(previous)));
      const distinctive=themes.some(term=>singleAnchor.has(term)||/^[\p{Script=Han}々]{4,}$|^[\p{Script=Katakana}ー]{5,}$/u.test(term));
      const independent=themes.filter(term=>term.length>=2);
      const controlled=themes.filter(term=>concreteConcept.has(term)).length;
      if(independent.length<2 || (!distinctive && controlled===0)) continue;
      const evidence=themes.slice(0,2).map(phrase=>phrases.get(phrase)!);
      suggested.push({entry:graph.byKey.get(key)!,kind:"suggested",evidence,strength:Number(distinctive)*3+evidence.length+controlled*2});
    }
    const present=new Set([...explicit,...suggested].map(edge=>edge.entry.key));
    const concepts=conceptDocs.get(entry.key)!;
    for(const other of visible){
      if(other.key===entry.key || present.has(other.key))continue;
      const their=conceptDocs.get(other.key)!;
      const links=[...concepts].flatMap(([kind,a])=>{
        const b=their.get(kind);
        return b?[a.label+"："+a.term+(a.term===b.term?"":"／"+b.term)]:[];
      });
      if(links.length)suggested.push({entry:other,kind:"suggested",evidence:links.slice(0,2),strength:Math.min(6,3+links.length)});
    }
    const order=(a:RelatedIdea,b:RelatedIdea)=>b.strength-a.strength || a.entry.key.localeCompare(b.entry.key);
    suggested.sort(order);
    // If both types exist, make the distinction visible on the first screen.
    result.set(entry.key,[...explicit.slice(0,2),...suggested.slice(0,2),...explicit.slice(2),...suggested.slice(2)]);
  }
  return result;
}
export function defaultContentFocus(visible:readonly MapRecord[], relations:ReadonlyMap<string,readonly RelatedIdea[]>) {
  const weight=(entry:MapRecord)=>{
    const links=(relations.get(entry.key)||[]).slice(0,5);
    const inferred=links.filter(link=>link.kind==="suggested");
    const recorded=links.some(link=>link.kind!=="suggested");
    return (recorded&&inferred.length?30:0)+(inferred[0]?.strength||0)*5+(inferred.some(link=>link.entry.row.team!==entry.row.team)?9:0)
      +links.length*3+new Set(links.map(link=>link.entry.row.team)).size;
  };
  return visible.reduce<MapRecord|undefined>((chosen,next)=>!chosen||weight(next)>weight(chosen)?next:chosen,undefined);
}
