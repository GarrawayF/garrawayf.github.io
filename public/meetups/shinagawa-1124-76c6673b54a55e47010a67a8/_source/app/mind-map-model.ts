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
