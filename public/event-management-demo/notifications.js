import {TODAY,DEFINITIONS,addDays,alerts,blockers,isBooked,pending} from './model.js';
/** @typedef {import('./model.js').EventCase} EventCase */
/** @typedef {{id:string,eventId:string,taskId:string,recipient:string,kind:string,title:string,reason:string,owner:string,due:string,createdAt:string,read:boolean,resolved:boolean,dynamic:boolean,target?:string}} Notice */

// Demo-only notification history. No browser notification permission, storage,
// service worker, timer polling, email, LINE or external transmission.
export class NotificationCenter {
 /** @type {Map<string,Notice>} */ records=new Map();
 /** @type {Map<string,{booked:boolean,approval:boolean,outcome:string,done:Record<string,boolean>}>} */ previous=new Map();
 sequence=0;
 /** @param {Omit<Notice,'createdAt'|'read'|'resolved'>} data */
 put(data){
  const old=this.records.get(data.id);
  if(old){if(old.resolved){old.read=false;old.createdAt=this.stamp();}Object.assign(old,data,{resolved:false});return;}
  this.records.set(data.id,{...data,createdAt:this.stamp(),read:false,resolved:false});
 }
 stamp(){const d=new Date(TODAY+'T09:00:00+09:00');d.setUTCSeconds(d.getUTCSeconds()+this.sequence++);return d.toISOString().replace('T',' ').slice(0,19)+' UTC';}
 /** @param {EventCase[]} cases */
 sync(cases){
  const active=new Set();
  for(const e of cases){
   for(const recipient of ['concierge','applicant']){
    const events=alerts(e,recipient).filter(a=>recipient==='concierge'||DEFINITIONS.find(d=>d.id===a.taskId)?.role==='主催者');
    const notices=events.map(a=>({...a,kind:a.kind}));
    for(const d of pending(e,recipient)){
     if(recipient==='applicant'&&d.role!=='主催者')continue;
     const t=e.tasks[d.id];if(e.dateConflict&&d.offset!==undefined)continue;if(blockers(e,d).length||events.some(a=>a.taskId===d.id))continue;
     if(t.due>=TODAY&&t.due<=addDays(TODAY,1))notices.push({eventId:e.id,taskId:d.id,kind:t.due===TODAY?'本日の期限':'期限前',priority:3,reason:t.due===TODAY?'本日が対応期限の目安です':'明日が対応期限の目安です',title:d.title,owner:t.owner,due:t.due,target:'task'});
    }
    for(const n of notices){
     const id=['task',recipient,e.id,n.taskId,n.kind,n.due||'unset'].join(':');active.add(id);
     this.put({id,eventId:e.id,taskId:n.taskId,recipient,kind:n.kind,title:n.title,reason:n.reason,owner:recipient==='applicant'?'あなた':n.owner||'担当未定',due:n.due,target:n.target,dynamic:true});
    }
   }
   const previous=this.previous.get(e.id);const booked=isBooked(e);
   if(previous){
    if(!previous.approval&&e.tasks.approval.done)this.record(e,'approvalMail','concierge','承認','最終承認を記録しました','正式予約には承認メールの送信記録が必要です');
    if(!previous.booked&&booked){this.record(e,'approvalMail','applicant','予約確定','正式予約になりました（デモ）','最終承認と承認メールの記録がそろいました');this.record(e,'approvalMail','concierge','予約確定','正式予約の記録がそろいました','開催準備を進めてください');}
    if(previous.booked&&!booked&&e.outcome==='active')this.record(e,'approvalMail','applicant','再確認','開催条件の再確認が必要です','変更後の最終承認・承認メールを運営が再確認します');
    if(previous.outcome!==e.outcome){for(const role of ['concierge','applicant'])this.record(e,'approvalMail',role,'開催判断',e.outcome==='active'?'案件を再開しました':e.outcome==='cancelled'?'イベント中止を記録しました':'開催不可を記録しました','開催情報で現在の状態を確認してください');}
    if(e.outcome==='active')for(const d of DEFINITIONS){
     const t=e.tasks[d.id];if(previous.done[d.id]===t.done)continue;
     if(!previous.done[d.id]&&t.done&&d.role==='主催者')this.record(e,d.id,'concierge','受領',d.title+'：完了記録あり','提出・確認内容を運営で確認してください');
     if(previous.done[d.id]&&!t.done&&!blockers(e,d).length){
      this.record(e,d.id,'concierge','差戻し・再確認',d.title+'：再確認が必要','未完了に戻されたため、担当と期限を確認してください');
      if(!d.internal&&d.role==='主催者')this.record(e,d.id,'applicant','差戻し・再確認',d.title+'：再確認が必要','この項目が未完了に戻りました。内容を確認してください');
     }
    }
   }
   this.previous.set(e.id,{booked,approval:e.tasks.approval.done,outcome:e.outcome,done:Object.fromEntries(DEFINITIONS.map(d=>[d.id,e.tasks[d.id].done]))});
  }
  for(const n of this.records.values()){
   if(n.dynamic&&!active.has(n.id))n.resolved=true;
   const e=cases.find(e=>e.id===n.eventId);if(!e)continue;
   if(n.kind==='差戻し・再確認'&&(e.tasks[n.taskId].done||e.tasks[n.taskId].skipped))n.resolved=true;
   if(['承認','再確認'].includes(n.kind)&&isBooked(e))n.resolved=true;
   if(n.kind==='予約確定'&&!isBooked(e))n.resolved=true;
  }
 }
 /** @param {EventCase} e */
 record(e,taskId,recipient,kind,title,reason){const id='change:'+recipient+':'+e.id+':'+taskId+':'+this.sequence;this.put({id,eventId:e.id,taskId,recipient,kind,title,reason,owner:recipient==='applicant'?(DEFINITIONS.find(d=>d.id===taskId)?.role==='主催者'?'あなた':'運営'):e.tasks[taskId].owner||'担当未定',due:e.tasks[taskId].due,dynamic:false});}
 list(role,eventId=''){if(role==='applicant'&&!eventId)return [];return [...this.records.values()].filter(n=>n.recipient===role&&(role!=='applicant'||n.eventId===eventId)).sort((a,b)=>Number(a.resolved)-Number(b.resolved)||Number(a.read)-Number(b.read)||b.createdAt.localeCompare(a.createdAt));}
 unread(role,eventId=''){return this.list(role,eventId).filter(n=>!n.read&&!n.resolved).length;}
 markRead(id,role,eventId=''){const n=this.list(role,eventId).find(n=>n.id===id);if(n)n.read=true;}
 markAllRead(role,eventId=''){for(const n of this.list(role,eventId))n.read=true;}
}
