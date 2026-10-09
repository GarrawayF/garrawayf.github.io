import {DEFINITIONS} from './model.js';
/** @typedef {import('./notifications.js').Notice} Notice */
/** @typedef {import('./model.js').EventCase} EventCase */
/** @typedef {{id:string,noticeId:string,eventId:string,recipientRole:string,recipientLabel:string,subject:string,body:string,status:'disabled'}} EmailDraft */

// This public, browser-only demo has no delivery transport or credentials.
// A production sender belongs on an authenticated server, not behind a UI switch.
export const EMAIL_DELIVERY = Object.freeze({
 channel:'email',mode:'preview-only',enabled:false,
 provider:null,sender:null,recipientDirectory:null,
 reason:'メール配信は未接続です。文面の確認だけできます。'
});

/** @param {string} value */
function oneLine(value){return String(value).replace(/[\u0000-\u001f\u007f]+/g,' ').trim();}

/** Convert an existing scoped notice; do not create another notification rule.
 * @param {Notice} notice
 * @param {EventCase} event
 * @returns {EmailDraft|null}
 */
export function createEmailDraft(notice,event){
 if(notice.eventId!==event.id)throw new Error('通知と案件が一致しません');
 if(!['concierge','applicant'].includes(notice.recipient))throw new Error('通知先の役割が不明です');
 const task=DEFINITIONS.find(d=>d.id===notice.taskId);
 if(!task)throw new Error('通知の対象が不明です');
 const host=notice.recipient==='applicant';
 if(host&&(task.internal||(task.role!=='主催者'&&!['予約確定','再確認','開催判断'].includes(notice.kind))))throw new Error('主催者向けにできない通知です');
 if(notice.resolved)return null;
 const recipientLabel=host?'この案件の主催者（宛先未設定）':'運営の通知先（宛先未設定）';
 const subject='[Garraway F・デモ・未送信] '+oneLine(notice.kind)+'：'+oneLine(event.title);
 const body=[
  '未送信の文面プレビューです。すべて架空のデータです。',
  '',
  '案件：'+oneLine(event.id),
  'イベント：'+oneLine(event.title),
  '',
  oneLine(notice.title),
  oneLine(notice.reason),
  '対象：'+task.title,
  notice.due?'期限の目安：'+oneLine(notice.due):'期限の目安：未設定',
  '',
  '管理画面で対象の項目をご確認ください。',
  'このデモではメールを送信しません。'
 ].join('\n');
 return {
  // Same notification occurrence => same key. Reopened occurrences use a new
  // createdAt. A real backend must persist its delivery ledger across sessions.
  id:JSON.stringify(['email',notice.id,notice.createdAt]),
  noticeId:notice.id,eventId:event.id,recipientRole:notice.recipient,
  recipientLabel,subject,body,status:'disabled'
 };
}

export const emailNotificationAdapter=Object.freeze({
 configuration:EMAIL_DELIVERY,
 prepare:createEmailDraft,
 /** No transport is present, including when invoked directly. @param {EmailDraft} _draft */
 send(_draft){return {status:'blocked',reason:EMAIL_DELIVERY.reason};}
});
