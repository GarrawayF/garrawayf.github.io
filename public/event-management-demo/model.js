/** @typedef {{id:string,title:string,phase:number,role:string,internal?:boolean,offset?:number,deps?:string[]}} Definition */
/** @typedef {{done:boolean,skipped:boolean,owner:string,due:string,completedAt:string,method:string,note:string}} Task */
/** @typedef {{id:string,title:string,date:string,dateConflict:boolean,scheduleCandidates:string[],cancellationMentioned:boolean,intake:string,intakeTime:string,organizer:string,people:number,audience:string,room:string,setup:string,start:string,end:string,clear:string,fee:string,admission:string,acquaintance:string,publicity:string,meeting:string,meetingMode:string,meetingOwner:string,meetingUrl:string,drive:string,publicNote:string,internalNote:string,outcome:string,outcomeReason:string,tasks:Record<string,Task>,history:{text:string,internal:boolean}[]}} EventCase */
export const TODAY='2026-10-04';
export const PHASES=['受付・書類','審査・承認','開催準備','当日','開催後'];
/** @type {Definition[]} */
export const DEFINITIONS=[
{id:'reportInquiry',title:'問い合わせを責任者へ報告',phase:0,role:'運営',internal:true},
{id:'sendPack',title:'同意書・審査フォーム・ヒアリングを案内',phase:0,role:'運営'},
{id:'sendCooperation',title:'アンケート・施設紹介への協力を案内',phase:0,role:'運営'},
{id:'screening',title:'事前審査フォームを受領',phase:0,role:'主催者'},
{id:'hearing',title:'詳細ヒアリングを受領',phase:0,role:'主催者'},
{id:'consent',title:'主催者が手動同意した同意書を受領',phase:0,role:'主催者'},
{id:'doubleCheck',title:'ヒアリングを二重チェック',phase:1,role:'運営',internal:true,deps:['hearing']},
{id:'approval',title:'責任者の最終承認を記録（開催可）',phase:1,role:'責任者',internal:true,deps:['screening','hearing','consent','doubleCheck']},
{id:'approvalMail',title:'承認メールの送信を記録',phase:1,role:'運営',deps:['approval']},
{id:'sendGuides',title:'原状復帰・アプリ・レイアウトを案内',phase:2,role:'運営',offset:-7,deps:['approvalMail']},
{id:'sendQr',title:'施設紹介画像・文章・アンケートQRを案内',phase:2,role:'運営',offset:-7,deps:['approvalMail']},
{id:'space',title:'利用スペース・レイアウトを確認',phase:2,role:'主催者',offset:-5,deps:['approvalMail']},
{id:'meeting',title:'事前打合せ・会場リハーサル',phase:2,role:'運営',offset:-3,deps:['space']},
{id:'meetingShare',title:'打合せ内容をチームに共有',phase:2,role:'運営',internal:true,offset:-3,deps:['meeting']},
{id:'slides',title:'投影資料を事前共有',phase:2,role:'主催者',offset:-3,deps:['approvalMail']},
{id:'promo',title:'告知画像・文章・申込フォームを受領',phase:2,role:'主催者',offset:-7,deps:['approvalMail']},
{id:'facebook',title:'FBイベントページを作成',phase:2,role:'運営',offset:-7,deps:['promo']},
{id:'website',title:'HPイベント情報を更新',phase:2,role:'運営',offset:-7,deps:['promo']},
{id:'calendar',title:'Googleカレンダーに告知タスクを登録',phase:2,role:'運営',internal:true,offset:-7,deps:['approvalMail']},
{id:'roles',title:'役割分担表を作成・印刷',phase:2,role:'運営',internal:true,offset:-5,deps:['approvalMail']},
{id:'announce3',title:'3日前のイベント告知',phase:2,role:'運営',offset:-3,deps:['facebook','website']},
{id:'announce1',title:'1日前のイベント告知',phase:2,role:'運営',offset:-1,deps:['facebook','website']},
{id:'hours',title:'営業時間変更のお知らせ',phase:2,role:'運営',offset:-1,deps:['approvalMail']},
{id:'pop',title:'イベントボード・POPを掲示',phase:2,role:'運営',offset:-1,deps:['approvalMail']},
{id:'checkin',title:'当日の受付・入館を確認',phase:3,role:'運営',offset:0,deps:['approvalMail']},
{id:'restore',title:'原状復帰・完全撤収を報告',phase:3,role:'主催者',offset:0,deps:['checkin']},
{id:'restoreCheck',title:'原状復帰を確認',phase:3,role:'運営',internal:true,offset:0,deps:['restore']},
{id:'restoreReport',title:'原状復帰の確認結果を責任者へ報告',phase:3,role:'運営',internal:true,offset:0,deps:['restoreCheck']},
{id:'report',title:'終了報告・実施資料を提出',phase:4,role:'主催者',offset:3,deps:['restore']},
{id:'photos',title:'写真・広報利用条件を確認',phase:4,role:'主催者',offset:3,deps:['restore']},
{id:'archive',title:'報告確認・広報・履歴共有を完了',phase:4,role:'運営',internal:true,offset:5,deps:['restoreReport','report','photos']},
];
export function addDays(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function businessDue(date){let d=date;for(let n=0;n<3;){d=addDays(d,1);if(![0,6].includes(new Date(d+'T12:00:00Z').getUTCDay()))n++;}return d;}
/** @returns {EventCase[]} */
export function createCases(){
 const samples=[
 ['SAMPLE-001','まちの小さな問いを、次の一歩へ','2026-11-20',30,'hearing'],
 ['SAMPLE-002','異なる視点から、まちを歩く','2026-11-27',24,'doubleCheck'],
 ['SAMPLE-003','はじめての共創ワークショップ','2026-12-04',40,'approvalMail'],
 ['SAMPLE-004','地域の挑戦を持ち寄る対話会','2026-09-30',18,'report'],
 ['SAMPLE-005','小さなアイデアの実験室','2026-10-07',20,'slides'],
 ['SAMPLE-006','学びをひらく交流会','2026-09-25',16,'complete'],
 ];
 return samples.map((s,i)=>{
 const [id,title,date,people,step]=s; const intake=i===1?'2026-09-29':'2026-09-25';
 /** @type {Record<string,Task>} */ const tasks={};let reached=false;
 for(const def of DEFINITIONS){if(def.id===step)reached=true;tasks[def.id]={done:!reached,skipped:false,owner:def.role==='主催者'?'主催者':def.role==='責任者'?'責任者':`担当${['A','B','C'][i%3]}`,due:def.offset!==undefined?addDays(String(date),def.offset):businessDue(intake),completedAt:!reached?'2026-09-30':'',method:'メール',note:''};}
 if(i===0)tasks.hearing.owner='未定';
 if(i===1)tasks.approval.due='';
 if(i===2)tasks.approvalMail.owner='未定';
 if(i===4){for(const def of DEFINITIONS){tasks[def.id].done=def.phase<2||['sendGuides','sendQr','space','meeting','meetingShare','promo','facebook','website','calendar','roles'].includes(def.id);} }
 return {id:String(id),title:String(title),date:String(date),dateConflict:false,scheduleCandidates:[],cancellationMentioned:false,people:Number(people),intake,intakeTime:'10:00',organizer:`サンプル団体${i+1}`,audience:'一般参加',room:i%2?'リビング':'モノづくり',setup:'13:00',start:'14:00',end:'16:00',clear:'17:00',fee:'未確認',admission:'無料',acquaintance:'未確認',publicity:'告知する',meeting:addDays(String(date),-3)+'T14:00',meetingMode:'現地',meetingOwner:`担当${['A','B','C'][i%3]}`,meetingUrl:'',drive:'',publicNote:'資料はまとめてご案内します。',internalNote:'架空の引継ぎ例：不足項目をまとめて連絡。担当交代時は未完了タスクと期限を確認。',outcome:'active',outcomeReason:'',tasks,history:[{text:'架空のサンプル案件を表示',internal:false}]};
 });
}
/** @param {EventCase} e */
export function hasCancellationSignal(e){return e.cancellationMentioned||/[【\[(（](?:中止|キャンセル|開催中止)[】\])）]|^(?:中止|キャンセル|開催中止)(?:[\s:：]|$)/.test(e.title);}
/** @param {EventCase} e */
export function isBooked(e){return e.outcome==='active'&&!e.dateConflict&&!hasCancellationSignal(e)&&['screening','hearing','consent','doubleCheck','approval','approvalMail'].every(id=>e.tasks[id].done);}
/** @param {EventCase} e @param {Definition} d */
export function blockers(e,d){const problems=[];if(d.id==='approvalMail'&&e.dateConflict)problems.push('開催日時の不一致を解消');if(d.id==='approvalMail'&&hasCancellationSignal(e))problems.push('中止記載と開催状態を確認');return problems.concat((d.deps||[]).filter(id=>!e.tasks[id].done&&!e.tasks[id].skipped).map(id=>DEFINITIONS.find(x=>x.id===id)?.title||id));}
/** @param {EventCase} e */
export function status(e){if(e.outcome==='cancelled')return '中止';if(e.outcome==='declined')return '開催不可';if(hasCancellationSignal(e))return '中止記載の確認待ち';if(e.dateConflict)return '日時の確認待ち';if(DEFINITIONS.every(d=>e.tasks[d.id].done||e.tasks[d.id].skipped))return '対応完了';if(e.tasks.archive.done)return '残タスクあり';if(e.tasks.restore.done)return '開催後';if(e.tasks.checkin.done)return '当日';if(isBooked(e))return '開催準備';if(e.tasks.approval.done)return '承認済み・通知待ち';if(['screening','hearing','consent'].every(id=>e.tasks[id].done))return '審査・承認';return '書類確認中';}
/** @param {EventCase} e */
export function pending(e,role='concierge'){if(e.outcome!=='active')return [];return DEFINITIONS.filter(d=>!e.tasks[d.id].done&&!e.tasks[d.id].skipped&&(role==='concierge'||!d.internal)).sort((a,b)=>(e.tasks[a.id].due||'9999').localeCompare(e.tasks[b.id].due||'9999')||a.phase-b.phase);}
/** @param {EventCase} e */
export function nextTask(e,role='concierge'){const p=pending(e,role);return p.find(d=>blockers(e,d).length===0)||p[0];}
/** @param {EventCase} e */
export function overdue(e,role='concierge'){return pending(e,role).filter(d=>e.tasks[d.id].due&&e.tasks[d.id].due<TODAY&&!blockers(e,d).length&&!(e.dateConflict&&d.offset!==undefined));}
/** @param {EventCase} e */
export function changeTask(e,id,role='concierge'){
 const d=DEFINITIONS.find(x=>x.id===id);if(!d)throw new Error('タスクがありません');
 if(e.outcome!=='active')throw new Error('中止・開催不可の案件は更新できません');
 if(role==='applicant'&&(d.internal||d.role!=='主催者'))throw new Error('運営が更新する項目です');
 if(!e.tasks[id].done&&blockers(e,d).length)throw new Error('先に必要な確認を完了してください');
 const done=!e.tasks[id].done;e.tasks[id].done=done;e.tasks[id].skipped=false;e.tasks[id].completedAt=done?TODAY:'';
 const reverted=[];
 if(!done){let again=true;while(again){again=false;for(const target of DEFINITIONS){if(e.tasks[target.id].done&&blockers(e,target).length){e.tasks[target.id].done=false;e.tasks[target.id].completedAt='';reverted.push(target.title);again=true;}}}}
 e.history.unshift({text:`${d.title}：${done?'完了を記録':'未完了に戻す'}${reverted.length?'（関連 '+reverted.length+' 項目も未完了）':''}`,internal:!!d.internal});
 return reverted;
}
/** @param {EventCase} e */
export function changeDate(e,date){const old=e.date;e.date=date;for(const d of DEFINITIONS){if(d.offset!==undefined&&e.tasks[d.id].due===addDays(old,d.offset))e.tasks[d.id].due=addDays(date,d.offset);}if(e.meeting.slice(0,10)===addDays(old,-3))e.meeting=addDays(date,-3)+e.meeting.slice(10);}

export const OPTIONAL=['slides','promo','facebook','website','announce3','announce1','hours','pop'];
/** @param {EventCase} e */
export function skipTask(e,id,reason,role='concierge'){if(role!=='concierge'||!OPTIONAL.includes(id)||!reason.trim()||e.outcome!=='active')throw new Error('対象外には運営の理由記録が必要です');e.tasks[id].skipped=true;e.tasks[id].done=false;e.tasks[id].completedAt='';e.tasks[id].note=reason;e.history.unshift({text:(DEFINITIONS.find(d=>d.id===id)?.title||id)+'：対象外（'+reason+'）',internal:false});}

/** @param {EventCase} e */
export function alerts(e,role='concierge'){
 if(e.outcome!=='active')return [];
 const days=Math.round((new Date(e.date+'T12:00:00Z').getTime()-new Date(TODAY+'T12:00:00Z').getTime())/86400000);
 const conflicts=[];
 if(e.dateConflict)conflicts.push({eventId:e.id,taskId:'space',kind:'開催日時が不一致',priority:0,reason:'同じ案件に複数の日時候補があります。主催者と1つに確定してください',title:'開催日時の食い違いを確認',owner:'運営・主催者',due:'',target:'info'});
 if(hasCancellationSignal(e)&&role==='concierge')conflicts.push({eventId:e.id,taskId:'approvalMail',kind:'中止記載と状態が不一致',priority:0,reason:'内部承認が残っていても予約確定にしません。中止か継続か確認してください',title:'開催状態を再確認',owner:'運営',due:'',target:'info'});
 const tasks=pending(e,role).filter(d=>!(e.dateConflict&&d.offset!==undefined)&&(!blockers(e,d).length||(days>=0&&days<=3&&e.tasks.approval.done&&['space','meeting'].includes(d.id)))).flatMap(d=>{
  const t=e.tasks[d.id];let kind='',priority=3,reason='';
  if(t.due&&t.due<TODAY&&!blockers(e,d).length){kind=['screening','hearing','consent'].includes(d.id)?'必須書類不足':d.phase===4?'終了後未報告':'期限超過';priority=1;reason=fmtDate(t.due)+' の目安を過ぎています';}
  else if(!t.owner||t.owner==='未定'){kind='担当未定';priority=2;reason='次の対応を引き受ける担当者が未設定です';}
  else if(!t.due){kind='期限未設定';priority=2;reason='期限の確認が必要です';}
  else if((isBooked(e)||e.tasks.approval.done&&['space','meeting'].includes(d.id))&&days>=0&&days<=3&&['space','meeting','slides'].includes(d.id)){kind='開催間近・準備未完';priority=2;reason='開催まで '+days+' 日。事前確認が残っています';}
  if(!kind)return [];if(kind!=='担当未定'&&(!t.owner||t.owner==='未定'))reason+=' / 担当も未定';return [{eventId:e.id,taskId:d.id,kind,priority,reason,title:d.title,owner:t.owner,due:t.due,target:'task'}];
 });return conflicts.concat(tasks).sort((a,b)=>a.priority-b.priority||(a.due||'9999').localeCompare(b.due||'9999'));
}
function fmtDate(d){return d.slice(5).replace('-','/');}
