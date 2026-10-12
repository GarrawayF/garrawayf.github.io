// Async feedback is presentation-only. Operation code still owns validation and locks.
(function(root){
 'use strict';
 const pending=new Set(),buttons=new Map();let shown=null;
 const node=()=>document.querySelector('#async-feedback');
 const symbols={busy:'◌',slow:'⌛',success:'✓',error:'!',unknown:'!'};
 function paint(record){const output=node();if(!output)return;shown=record;output.hidden=false;output.dataset.state=record.state;output.textContent=symbols[record.state]+' '+record.text;}
 function top(){return [...pending].sort((a,b)=>b.priority-a.priority||b.order-a.order)[0];}
 function release(record){clearTimeout(record.timer);for(const button of record.buttons){const count=buttons.get(button)-1;if(count>0)buttons.set(button,count);else{buttons.delete(button);button.removeAttribute('aria-busy');button.removeAttribute('data-feedback-busy');}}pending.delete(record);}
 let sequence=0;
 function begin(text,{buttons:controls=[],slow='応答を待っています。完了はまだ確認できていません。',priority=1}={}){
  const record={text,state:'busy',priority,order:++sequence,buttons:[...new Set(controls.filter(Boolean))],active:true,timer:null};
  for(const button of record.buttons){buttons.set(button,(buttons.get(button)||0)+1);button.setAttribute('aria-busy','true');button.setAttribute('data-feedback-busy','true');}
  pending.add(record);paint(top());
  record.timer=setTimeout(()=>{if(!record.active)return;record.state='slow';record.text='通常より時間がかかっています。'+slow;if(top()===record)paint(record);},8000);
  const finish=(state,text)=>{if(!record.active)return;record.active=false;release(record);const next=top();if(next)paint(next);else if(shown===record){if(state)paint({...record,state,text});else{const output=node();if(output)output.hidden=true;shown=null;}}};
  return {finish,cancel:()=>finish(null,'')};
 }
 function clear(){for(const record of [...pending]){record.active=false;release(record);}shown=null;const output=node();if(output){output.hidden=true;output.textContent='';delete output.dataset.state;}}
 function notice(state,text){const activity=begin(text);activity.finish(state,text);}
 root.GarrawayAsyncFeedback=Object.freeze({begin,clear,notice});
})(window);
// End async feedback.
// GitHub-hosted applicant resume UI. No embedded applicant or integration data.
(function(root){
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const times=[['setupStart','準備開始','setupDay'],['eventStart','イベント開始','eventStartDay'],['eventEnd','イベント終了','eventEndDay'],['clearEnd','完全撤収','clearEndDay']];
 const copy=x=>JSON.parse(JSON.stringify(x));
 function fromCommon(common={}){return {revision:0,candidates:['first','second'].map(prefix=>({date:common[prefix+'Date']||'',undecided:!common[prefix+'Date'],setupStart:'',eventStart:common[prefix+'Start']||'',eventEnd:common[prefix+'End']||'',clearEnd:'',setupDay:0,eventStartDay:0,eventEndDay:0,clearEndDay:0})),program:[]};}
 function minutes(value,day=0){if(!/^\d{2}:\d{2}$/.test(value||''))return null;const [h,m]=value.split(':').map(Number);return h<24&&m<60?h*60+m+Number(day||0)*1440:null;}
 const duration=n=>n===null?'未入力':Math.floor(n/60)+'時間'+(n%60?String(n%60)+'分':'');
 function timeField(prefix,key,label,day,value={},disabled=false){return `<label class="time-field">${label}<span class="time-pair"><input type="time" step="60" data-key="${key}" name="${prefix}${key}" aria-label="${label}" value="${esc(value[key])}" ${disabled?'disabled':''}><select data-key="${day}" name="${prefix}${day}" aria-label="${label}の日付" ${disabled?'disabled':''}><option value="0" ${!Number(value[day])?'selected':''}>当日</option><option value="1" ${Number(value[day])===1?'selected':''}>翌日</option></select></span></label>`;}
 function candidate(c,i,editable){const prefix='candidate'+i+'-';return `<section class="candidate" data-candidate="${i}" role="group" aria-label="第${i+1}希望の日時"><div class="candidate-heading"><h3>第${i+1}希望</h3><label class="check-inline"><input type="checkbox" name="${prefix}undecided" data-key="undecided" ${c.undecided?'checked':''} ${!editable?'disabled':''}>まだ未定</label></div><label>希望日<input type="date" data-key="date" name="${prefix}date" value="${esc(c.date)}" ${!editable||c.undecided?'disabled':''}></label><label>利用希望スペース<select data-key="space" name="${prefix}space" ${!editable?'disabled':''}><option value="">未定・確認中</option>${['リビングラボ','ものづくりラボ','精神と時の部屋'].map(space=>'<option '+(c.space===space?'selected':'')+'>'+space+'</option>').join('')}</select></label><div class="schedule-times">${times.map(([key,label,day])=>timeField(prefix,key,label,day,c,!editable||c.undecided)).join('')}</div>${editable?'<details class="time-shortcuts"><summary>準備・撤収をワンタップで入れる</summary><p>ボタンを押したときだけ時刻に反映します。分単位の直接入力もできます。</p><div class="shortcut-group"><b>準備開始</b><button type="button" data-duration="setup:30">開始の30分前</button><button type="button" data-duration="setup:60">開始の1時間前</button></div><div class="shortcut-group"><b>完全撤収</b><button type="button" data-duration="clear:15">終了の15分後</button><button type="button" data-duration="clear:30">終了の30分後</button><button type="button" data-duration="clear:60">終了の1時間後</button></div></details>':''}<div class="occupancy" aria-live="polite"></div><p class="schedule-warning" role="status"></p></section>`;}
 function programRow(p,i,editable){return `<article class="program-row" data-program-id="${esc(p.id)}"><div class="program-heading"><b>プログラム <span class="program-number">${i+1}</span></b>${editable?'<div class="row-tools"><button type="button" data-row="up" aria-label="この行を上へ">↑</button><button type="button" data-row="down" aria-label="この行を下へ">↓</button><button type="button" data-row="remove">削除</button></div>':''}</div><label>内容<input data-key="title" value="${esc(p.title)}" maxlength="120" placeholder="受付・オープニングなど" ${!editable?'disabled':''}></label><div class="program-times">${timeField('', 'start','開始','startDay',p,!editable)}${timeField('','end','終了','endDay',p,!editable)}</div><details class="program-note"><summary>補足を加える（任意）</summary><label>補足<input data-key="note" value="${esc(p.note)}" maxlength="300" placeholder="担当・必要な機材など" ${!editable?'disabled':''}></label></details></article>`;}
 function planned(s,editable,withForm=true){return `${withForm?'<form id="schedule-form">':''}<p>準備から完全撤収までが会場を使う時間です。深夜をまたぐ場合は「翌日」を選んでください。</p><p class="meta">撤収の警告は確認の目安です。施設の承認ルールや最低時間を決めるものではありません。</p>${editable?'<div class="schedule-tools"><button type="button" data-copy-times>第1希望の時刻を第2希望へコピー</button><span class="meta">第2希望の日付は変えません</span></div>':''}<div class="candidate-grid">${s.candidates.map((c,i)=>candidate(c,i,editable)).join('')}</div><h3>イベント内のプログラム</h3><p class="meta">候補日のどちらにも共通する予定です。細部はあとから追記できます。時刻未定の行は空欄のまま残せます。</p><div class="program-list">${s.program.map((p,i)=>programRow(p,i,editable)).join('')}</div>${editable?'<div class="program-add"><button type="button" class="add-program">＋ 空の行を追加</button><button type="button" class="add-next-program">＋ 続きの30分を追加</button></div>':''}<p class="program-warning" role="status"></p>${editable?'<div class="schedule-assist" role="status" aria-live="polite"><span class="assist-message">入力補助は保存前に取り消せます。</span><button type="button" data-undo-schedule hidden>直前の補助操作を戻す</button></div>':''}${editable&&withForm?'<div class="actions"><button class="primary" type="submit">予定を保存して共有</button></div>':''}${withForm?'</form>':''}`;}
 function actualRow(p,a={}){return `<article class="actual-program" data-program-id="${esc(p.id)}"><h4>${esc(p.title||'未入力のプログラム')}</h4><p class="meta">予定：${esc(p.start||'時刻未定')}〜${esc(p.end||'時刻未定')}（変更前の予定は自動で実績にしません）</p><div class="program-times">${timeField('','actualStart','実際の開始','startDay',a)}${timeField('','actualEnd','実際の終了','endDay',a)}</div><label>変更点だけ（任意）<input data-key="note" value="${esc(a.note)}" maxlength="300" placeholder="予定との違いがあれば記入"></label></article>`;}
 function comparisonSchedule(s,r){if(!r?.planned?.candidate)return s;const candidates=copy(s.candidates);candidates[Number(r.planned.candidateIndex||0)]=copy(r.planned.candidate);return {...s,candidates,program:copy(r.planned.program||[])};}
 function report(s,r,editable,{locked=false,provisional=false,pending=false}={}){s=comparisonSchedule(s,r);const selected=Number(r?.planned?.candidateIndex||0),actual=r?.actual||{};return `<section class="panel report-panel"><p class="eyebrow">REPORT / 予定を見ながら実績だけ</p><h2>開催後のレポート</h2><p>予定を引き継いで表示します。実績の空欄は「未記録」です。予定がそのまま実績として確定されることはありません。</p>${pending?(provisional?'<p class="request">開催日時の確定記録がありません。変更前の第1希望を暫定表示しています。比較する候補を運営に確認してください。</p>':'<p class="request">変更案は未合意のため、現在の合意内容を比較基準にします。</p>'):provisional?'<p class="request">開催候補は未確定です。第1希望を暫定表示しています。実施した候補を確認してください。</p>':''}${r?.recordedAt&&(r.needsReview||r.scheduleRevision!==s.revision)?'<p class="request">レポート記録後に予定が変わっています。ここでは記録時の予定と実績を比較し、削除されたプログラムの実績も保持しています。最新の予定は上の予定欄で確認してください。</p>':''}<p class="request">この試験版は、下書き保存後に比較する希望日を変更できません。保存前に候補を確認してください。間違えた場合は、比較したい希望日と訂正内容を運営へ伝えてください。元の記録を残して訂正方法を確認します。</p><form id="report-form"><label>実施した候補<select name="candidateIndex" ${!editable||r?.recordedAt||locked?'disabled':''}>${s.candidates.map((c,i)=>`<option value="${i}" ${i===selected?'selected':''}>第${i+1}希望：${esc(c.undecided?'未定':c.date||'未定')}</option>`).join('')}</select></label><div class="fields"><label>実施日<input name="actualDate" type="date" value="${esc(actual.date)}" ${!editable?'disabled':''}></label><label>実際の参加人数<input name="actualAttendance" type="number" min="0" max="9999" value="${esc(actual.attendance)}" ${!editable?'disabled':''}></label></div>${editable?'<button type="button" id="copy-planned">未入力の実績欄だけに予定を入れる</button>':''}<div class="actual-times">${times.map(([k,l,d])=>`<div><p class="meta" data-planned="${k}"></p>${timeField('',k,'実際の'+l,d,actual,!editable)}<p class="time-delta" data-delta="${k}"></p></div>`).join('')}</div><details><summary>プログラムごとの実績・変更点</summary>${s.program.map(p=>actualRow(p,r?.programActuals?.find(a=>a.programId===p.id))).join('')}</details><label>実施後のメモ・予定との違い<textarea name="summary" maxlength="2000" rows="3" ${!editable?'disabled':''}>${esc(r?.summary)}</textarea></label><label class="check-inline"><input name="confirmed" type="checkbox" ${r?.confirmed?'checked':''} ${!editable?'disabled':''}>入力した実績を本人が確認しました</label><p class="report-warning" role="status"></p>${editable?'<button class="primary" type="submit">実績レポートを保存</button>':''}</form></section>`;}
 function render(event,{applicant=false,plan=true}={}){const s=copy(event.schedule||fromCommon(event.common));while(s.candidates.length<2)s.candidates.push(fromCommon().candidates[0]);const edit=event.canEditSchedule??applicant,editReport=event.canEditReport??applicant;return `${plan?`<section class="panel schedule-panel"><p class="eyebrow">SCHEDULE / 会場を使う時間</p><h2>準備から、完全撤収まで。</h2>${!edit?'<p class="meta">申請者が入力した同じ予定です。運営側で転記する必要はありません。</p>':''}${planned(s,edit)}</section>`:''}${report(s,event.report,editReport,{locked:[0,1].includes(event.approvedCandidateIndex)||event.changePending&&[0,1].includes(event.agreedConditions?.approvedCandidateIndex),provisional:!event.report?.recordedAt&&![0,1].includes(event.approvedCandidateIndex)&&!(event.changePending&&[0,1].includes(event.agreedConditions?.approvedCandidateIndex)),pending:event.changePending===true})}`;}
 function getValues(node){const out={};node.querySelectorAll('[data-key]').forEach(el=>out[el.dataset.key]=el.type==='checkbox'?el.checked:el.tagName==='SELECT'&&el.dataset.key!=='space'?Number(el.value):el.value);return out;}
 function collect(container){return {candidates:[...container.querySelectorAll('[data-candidate]')].map(getValues),program:[...container.querySelectorAll('.program-row')].map(row=>({id:row.dataset.programId,...getValues(row)}))};}
 function assess(s){const issues=[],warnings=[];s.candidates.forEach((c,i)=>{if(c.undecided)return;const values=times.map(([k,l,d])=>minutes(c[k],c[d]));let prev=null;values.forEach((v,n)=>{if(v!==null){if(prev!==null&&v<prev)issues.push(`第${i+1}希望の${times[n][1]}が前の時刻より早くなっています`);prev=v;}});if(values.every(v=>v!==null)&&values[3]-values[2]<30)warnings.push(`第${i+1}希望の撤収時間は${values[3]-values[2]}分です（確認の目安）。片付け・原状復帰に足りるか確認してください`);});s.program.forEach((p,i)=>{const a=minutes(p.start,p.startDay),b=minutes(p.end,p.endDay);if(a!==null&&b!==null&&b<a)issues.push(`プログラム${i+1}の終了が開始より早くなっています`);s.candidates.forEach((c,n)=>{if(c.undecided)return;const begin=minutes(c.eventStart,c.eventStartDay),finish=minutes(c.eventEnd,c.eventEndDay);if(a!==null&&b!==null&&begin!==null&&finish!==null&&(a<begin||b>finish))warnings.push(`プログラム${i+1}は第${n+1}希望のイベント時間外を含みます。予定を確認してください`);});const prev=s.program[i-1];if(prev){const end=minutes(prev.end,prev.endDay);if(a!==null&&end!==null&&a<end)warnings.push(`プログラム${i+1}が前の行と重なっています`);}});return {issues,warnings};}
 function refresh(container){const s=collect(container);container.querySelectorAll('[data-candidate]').forEach((node,i)=>{const c=s.candidates[i];node.querySelectorAll('input:not([type=checkbox]),select').forEach(el=>{if(node.querySelector('[type=checkbox]').disabled)return;el.disabled=c.undecided;el.required=!c.undecided&&el.dataset.key!=='space';});const vals=times.map(([k,l,d])=>minutes(c[k],c[d]));node.querySelector('.occupancy').innerHTML=c.undecided?'<span>日程・時刻は未定</span>':`<span>準備 <b>${duration(vals[0]!==null&&vals[1]!==null&&vals[1]>=vals[0]?vals[1]-vals[0]:null)}</b></span><span>イベント <b>${duration(vals[1]!==null&&vals[2]!==null&&vals[2]>=vals[1]?vals[2]-vals[1]:null)}</b></span><span>撤収 <b>${duration(vals[2]!==null&&vals[3]!==null&&vals[3]>=vals[2]?vals[3]-vals[2]:null)}</b></span><span>占有時間 <b>${duration(vals[0]!==null&&vals[3]!==null&&vals[3]>=vals[0]?vals[3]-vals[0]:null)}</b></span>`;const feedback=assess({candidates:[c],program:[]});node.querySelector('.schedule-warning').textContent=[...feedback.issues,...feedback.warnings].join('。').replaceAll('第1希望',`第${i+1}希望`);});const feedback=assess(s);container.querySelector('.program-warning').textContent=feedback.issues.filter(x=>x.startsWith('プログラム')).concat(feedback.warnings.filter(x=>x.startsWith('プログラム'))).join('。');container.querySelectorAll('.program-row').forEach((row,i,rows)=>{row.querySelector('.program-number').textContent=i+1;const up=row.querySelector('[data-row=up]'),down=row.querySelector('[data-row=down]');if(up)up.disabled=i===0;if(down)down.disabled=i===rows.length-1;});}
 function bindPrograms(container){
  const editable=Boolean(container.querySelector('.add-program')),undo=[],info=container.querySelector('.assist-message'),undoButton=container.querySelector('[data-undo-schedule]');
  const say=text=>{if(info)info.textContent=text;};
  const remember=()=>{undo.push(copy(collect(container)));if(undo.length>10)undo.shift();if(undoButton)undoButton.hidden=false;};
  const set=(node,key,value)=>{const input=node.querySelector(`[data-key="${key}"]`);if(input){if(input.type==='checkbox')input.checked=Boolean(value);else input.value=value??'';}};
  const restore=value=>{container.querySelectorAll('[data-candidate]').forEach((node,i)=>Object.entries(value.candidates[i]).forEach(([key,v])=>set(node,key,v)));container.querySelector('.program-list').innerHTML=value.program.map((p,i)=>programRow(p,i,editable)).join('');refresh(container);};
  const timeParts=n=>({value:String(Math.floor(n%1440/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'),day:Math.floor(n/1440)});
  undoButton?.addEventListener('click',()=>{if(undoButton.disabled)return;const previous=undo.pop();if(previous)restore(previous);undoButton.hidden=undo.length===0;say('直前の入力補助を戻しました。まだ保存していません。');});
  container.querySelector('[data-copy-times]')?.addEventListener('click',ev=>{if(ev.currentTarget.disabled)return;const values=collect(container),first=values.candidates[0],second=container.querySelector('[data-candidate="1"]');if(first.undecided||!first.eventStart||!first.eventEnd){say('第1希望のイベント開始・終了を入力してからコピーしてください。');return;}remember();times.forEach(([key,label,day])=>{set(second,key,first[key]);set(second,day,first[day]);});set(second,'undecided',false);refresh(container);say('第2希望へ時刻だけコピーしました。日付はそのままです。変更前に戻せます。');second.querySelector('[data-key=date]').focus();});
  container.querySelector('.add-program')?.addEventListener('click',()=>add(false));
  container.querySelector('.add-next-program')?.addEventListener('click',()=>add(true));
  function add(continuous){const list=container.querySelector('.program-list');if(list.children.length>=30){say('プログラムは30行までです。');return;}const value=collect(container),last=value.program.at(-1),first=value.candidates[0];let start=null;if(continuous){start=last?minutes(last.end,last.endDay):!first.undecided?minutes(first.eventStart,first.eventStartDay):null;if(start===null){say('前の行の終了時刻、または第1希望の開始時刻を先に入力してください。');return;}if(start+30>=2880){say('翌日を超えるため自動追加できません。日程を確認してください。');return;}}remember();const p={id:crypto.randomUUID(),title:'',start:'',end:'',startDay:0,endDay:0,note:''};if(continuous){const a=timeParts(start),b=timeParts(start+30);Object.assign(p,{start:a.value,startDay:a.day,end:b.value,endDay:b.day});}list.insertAdjacentHTML('beforeend',programRow(p,list.children.length,true));refresh(container);say(continuous?'前の終了から30分の行を追加しました。内容と時刻は自由に直せます。':'空の行を追加しました。');list.lastElementChild.querySelector('input').focus();}
  container.addEventListener('click',ev=>{if(!editable)return;const durationButton=ev.target.closest('[data-duration]');if(durationButton){if(durationButton.disabled)return;const node=durationButton.closest('[data-candidate]'),c=getValues(node),[kind,length]=durationButton.dataset.duration.split(':');if(c.undecided){say('未定を解除してイベントの開始・終了を入力してください。');return;}const basis=minutes(c[kind==='setup'?'eventStart':'eventEnd'],c[kind==='setup'?'eventStartDay':'eventEndDay']);if(basis===null){say(kind==='setup'?'先にイベント開始を入力してください。':'先にイベント終了を入力してください。');return;}const result=basis+(kind==='setup'?-Number(length):Number(length));if(result<0||result>=2880){say('前日または翌日を超えるため変更しませんでした。希望日と当日・翌日を確認してください。');return;}remember();const t=timeParts(result);set(node,kind==='setup'?'setupStart':'clearEnd',t.value);set(node,kind==='setup'?'setupDay':'clearEndDay',t.day);refresh(container);say('希望'+(Number(node.dataset.candidate)+1)+'の'+(kind==='setup'?'準備開始':'完全撤収')+'を入力しました。変更前に戻せます。');return;}
   const button=ev.target.closest('[data-row]');if(!button||button.disabled)return;const row=button.closest('.program-row');remember();if(button.dataset.row==='up'&&row.previousElementSibling)row.parentElement.insertBefore(row,row.previousElementSibling);if(button.dataset.row==='down'&&row.nextElementSibling)row.parentElement.insertBefore(row.nextElementSibling,row);if(button.dataset.row==='remove')row.remove();refresh(container);say(button.dataset.row==='remove'?'行を削除しました。変更前に戻せます。':'行の順番を変更しました。変更前に戻せます。');});
  const manualChange=()=>{if(undo.length){undo.length=0;if(undoButton)undoButton.hidden=true;say('手入力した内容を保持しています。保存するまで記録は変わりません。');}refresh(container);};container.addEventListener('input',manualChange);container.addEventListener('change',manualChange);refresh(container);
 }
 function bind(event,{applicant=false,onSave,onReport,message}){const sf=document.querySelector('#schedule-form'),rf=document.querySelector('#report-form'),s=event.schedule||fromCommon(event.common),comparison=comparisonSchedule(s,event.report);if(sf){bindPrograms(sf);sf.onsubmit=ev=>{ev.preventDefault();const value=collect(sf),check=assess(value);if(check.issues.length){message(check.issues.join('。'));return;}onSave(value);};}if(rf){const edit=event.canEditReport??applicant;if(!edit)rf.querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=true);const update=()=>{const c=comparison.candidates[Number(rf.elements.candidateIndex.value)]||{};times.forEach(([k,label,day])=>{rf.querySelector(`[data-planned="${k}"]`).textContent=`予定の${label}：${c.undecided?'未定':c[k]||'未入力'}${Number(c[day])===1?'（翌日）':''}`;const actual=rf.querySelector(`[data-key="${k}"]`),a=minutes(actual.value,rf.querySelector(`[data-key="${day}"]`).value),p=minutes(c[k],c[day]);const pd=Date.parse((c.date||'')+'T00:00:00Z'),ad=Date.parse((rf.elements.actualDate.value||'')+'T00:00:00Z'),delta=a-p+(ad-pd)/60000;rf.querySelector(`[data-delta="${k}"]`).textContent=a===null?'実績未記録':c.undecided?'比較する予定が未定':p===null?'比較する予定時刻なし':!Number.isFinite(delta)?'実施日・予定日を入力すると差分を表示':delta===0?'予定どおり':`${Math.abs(delta)}分${delta>0?'遅い':'早い'}`;});};rf.querySelector('#copy-planned')?.addEventListener('click',()=>{const c=comparison.candidates[Number(rf.elements.candidateIndex.value)]||{};if(c.undecided||!c.date||times.some(([key])=>!c[key])){rf.querySelector('.report-warning').textContent='予定が未定または未入力です。実績は実際の日時を確認して入力してください。';return;}let changed=false;if(!rf.elements.actualDate.value){rf.elements.actualDate.value=c.date||'';changed=true;}if(!rf.elements.actualAttendance.value){rf.elements.actualAttendance.value=event.report?.planned?.attendance??event.common?.attendance??'';changed=true;}times.forEach(([k,l,d])=>{const input=rf.querySelector(`[data-key="${k}"]`);if(!input.value){input.value=c[k]||'';rf.querySelector(`[data-key="${d}"]`).value=c[d]||0;changed=true;}});rf.querySelectorAll('.actual-program').forEach(row=>{const p=comparison.program.find(x=>x.id===row.dataset.programId)||{};if(!row.querySelector('[data-key=actualStart]').value&&p.start){row.querySelector('[data-key=actualStart]').value=p.start;row.querySelector('[data-key=startDay]').value=p.startDay||0;changed=true;}if(!row.querySelector('[data-key=actualEnd]').value&&p.end){row.querySelector('[data-key=actualEnd]').value=p.end;row.querySelector('[data-key=endDay]').value=p.endDay||0;changed=true;}});if(changed)rf.elements.confirmed.checked=false;rf.querySelector('.report-warning').textContent=changed?'空欄だけに予定を入れました。既入力の実績は変えていません。実際の時刻・人数を確認してから保存してください。':'空欄がないため変更していません。既入力の実績を保持しています。';update();});rf.addEventListener('input',ev=>{if(ev.target!==rf.elements.confirmed)rf.elements.confirmed.checked=false;update();});rf.addEventListener('change',update);update();rf.onsubmit=ev=>{ev.preventDefault();const actual={date:rf.elements.actualDate.value,attendance:rf.elements.actualAttendance.value};rf.querySelector('.actual-times').querySelectorAll('[data-key]').forEach(el=>actual[el.dataset.key]=el.tagName==='SELECT'&&el.dataset.key!=='space'?Number(el.value):el.value);const data={candidateIndex:Number(rf.elements.candidateIndex.value),scheduleRevision:s.revision||0,actual,programActuals:[...rf.querySelectorAll('.actual-program')].map(row=>({programId:row.dataset.programId,...getValues(row)})),summary:rf.elements.summary.value,confirmed:rf.elements.confirmed.checked};const check=assess({candidates:[{...actual,undecided:false}],program:[]});if(check.issues.length){message(check.issues.join('。'));return;}onReport(data);};}}
 root.GarrawaySchedule={render,planned,collect,assess,bind,bindPrograms,fromCommon};
})(globalThis);
;
(function(root){
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const keys=['participation','participationNote','sales','salesNote','equipmentNote','supportNote','safetyNote'];
 const participation=[['','未回答（未確認）'],['open','どなたでも参加できる'],['conditions','条件に合う方が参加できる'],['internal','社内・関係者のみ'],['undecided','未定']];
 const sales=[['','未回答（未確認）'],['none','販売・勧誘はない'],['sales','販売がある'],['solicitation','勧誘がある'],['both','販売・勧誘の両方がある'],['undecided','未定']];
 const has=value=>value!==null&&value!==undefined&&String(value).trim()!=='';
 const display=value=>has(value)?esc(value):'未確認';
 const selected=(options,value)=>options.find(([key])=>key===value)?.[0]||'';
 const choice=(options,value)=>value?display(options.find(([key])=>key===value)?.[1]):'未確認';
 const row=(label,value)=>`<dt>${esc(label)}</dt><dd>${display(value)}</dd>`;
 const choiceRow=(label,options,value)=>`<dt>${esc(label)}</dt><dd>${choice(options,value)}</dd>`;
 function select(key,label,options,value){const current=selected(options,value);return `<label>${label}（任意）<select name="review-${key}" data-review-key="${key}">${options.map(([key,text])=>`<option value="${key}"${key===current?' selected':''}>${text}</option>`).join('')}</select></label>`;}
 function note(key,label,example,value,short=false){return `<label>${label}（任意）${short?`<input type="text" name="review-${key}" data-review-key="${key}" maxlength="500" placeholder="${esc(example)}" value="${esc(value)}">`:`<textarea name="review-${key}" data-review-key="${key}" maxlength="500" rows="3" placeholder="${esc(example)}">${esc(value)}</textarea>`}</label>`;}
 function supplement(label,contents,filled){return `<details class="review-supplement"${filled?' open':''}><summary>${label}（任意<span data-review-filled>${filled?'・記入済み':''}</span>）</summary>${contents}</details>`;}
 function fields(context={},{operating=true}={}){
  const value=context||{};
  return `<div class="review-fields"><p class="meta">補足は任意です。空欄・未定でも進められます。</p><div class="fields"><div>${select('participation','参加できる方',participation,value.participation)}${supplement('参加条件を補足する',note('participationNote','対象・参加条件','例：社内メンバーのみ／事前申込の方／対象は未定',value.participationNote,true),has(value.participationNote))}</div><div>${select('sales','販売・勧誘の予定',sales,value.sales)}${supplement('販売・勧誘を補足する',note('salesNote','内容・対象','例：希望者への書籍販売／サービスの案内／内容は未定',value.salesNote,true),has(value.salesNote))}</div></div>${operating?supplement('人員・機材を相談する',`<p class="meta">各500文字まで。</p>${note('supportNote','当日の運営人員・会場に相談したい支援','例：主催者2名で受付・進行／設営の相談をしたい／未定',value.supportNote)}${note('equipmentNote','使う機材・設営・片付け','例：持込PCと会場モニター／机の配置を変え、終了後に戻す／未定',value.equipmentNote)}`,['supportNote','equipmentNote'].some(key=>has(value[key]))):''}${supplement('安全面の相談がある場合',note('safetyNote','安全面・配慮','例：音量、通路、参加者への配慮など',value.safetyNote),has(value.safetyNote))}</div>`;
 }
 function collect(container,previous={}){return Object.fromEntries(keys.map(key=>[key,container?.querySelector(`[data-review-key="${key}"]`)?.value??previous?.[key]??'']));}
 function time(value,key,dayKey){if(!has(value[key]))return '未確認';return String(value[key])+(Number(value[dayKey])===1?'（翌日）':'');}
 function candidates(event){
  if(Array.isArray(event.schedule?.candidates))return event.schedule.candidates;
  const common=event.common||{};
  return ['first','second'].map(prefix=>({date:common[prefix+'Date'],eventStart:common[prefix+'Start'],eventEnd:common[prefix+'End']}));
 }
 function scheduleRows(event){
  const entries=candidates(event);
  if(!entries.length)return row('準備から完全撤収まで','');
  return entries.map((entry,index)=>{const c=entry||{};if(c.undecided)return row(`第${index+1}希望の会場利用時間`,'未定');return row(`第${index+1}希望の会場利用時間`,`${has(c.date)?c.date:'日付：未確認'} ／ 準備 ${time(c,'setupStart','setupDay')} → 開始 ${time(c,'eventStart','eventStartDay')} → 終了 ${time(c,'eventEnd','eventEndDay')} → 完全撤収 ${time(c,'clearEnd','clearEndDay')}`);}).join('');
 }
 function programRows(event){
  const program=Array.isArray(event.schedule?.program)?event.schedule.program:[];
  if(!program.length)return row('プログラム','');
  return program.map((entry,index)=>{const p=entry||{};return row(`プログラム${index+1}`,`${has(p.title)?p.title:'内容：未確認'} ／ ${time(p,'start','startDay')}〜${time(p,'end','endDay')}${has(p.note)?' ／ '+p.note:''}`);}).join('');
 }
 function perspective(title,contents){return `<section class="review-card review-perspective"><h3>${title}</h3><dl>${contents}</dl></section>`;}
 function summary(event={}){
  event=event||{};const common=event.common||{},value=event.reviewContext||{};
  return `<section id="review-summary" tabindex="-1" class="panel review-summary"><h2>判断材料</h2><p class="meta">未確認の点は申請者へ確認して判断します。</p><div class="review-grid">${perspective('1. 目的・生みたい変化',row('誰に、どんな良い変化や循環を生みたいか',common.impact))}${perspective('2. 参加者・参加条件',row('参加者の属性',common.audience)+row('想定参加人数',has(common.attendance)?common.attendance+'人':'')+choiceRow('参加できる方',participation,value.participation)+row('対象・参加条件の補足',value.participationNote))}${perspective('3. Garraway Fで行う理由',row('Garraway Fで開催したい理由',common.purpose)+(has(common.understanding)?row('この場への理解（過去の回答）',common.understanding):''))}${perspective('4. 内容・プログラム',row('イベント概要',common.summary)+programRows(event)+choiceRow('販売・勧誘の予定',sales,value.sales)+row('販売・勧誘の補足',value.salesNote))}${perspective('5. 人員・機材・準備撤収・安全',(has(value.supportNote)?row('運営人員・相談したい支援',value.supportNote):'')+(has(value.equipmentNote)?row('機材・設営・片付け',value.equipmentNote):'')+scheduleRows(event)+row('安全面・配慮・確認したいこと',value.safetyNote))}</div></section>`;
 }
 const bound=new WeakSet();
 function bind(container){
  if(!container||bound.has(container))return;
  bound.add(container);
  const update=()=>container.querySelectorAll('.review-supplement').forEach(details=>{const indicator=details.querySelector('[data-review-filled]');if(indicator)indicator.textContent=[...details.querySelectorAll('[data-review-key]')].some(field=>has(field.value))?'・記入済み':'';});
  const conditional=()=>{for(const [key,values,noteKey] of [['participation',['conditions'],'participationNote'],['sales',['sales','solicitation','both'],'salesNote']]){const choice=container.querySelector('[data-review-key='+key+']'),note=container.querySelector('[data-review-key='+noteKey+']');if(note)note.closest('details').hidden=!values.includes(choice?.value)&&!has(note.value);}update();};container.addEventListener('input',conditional);container.addEventListener('change',conditional);conditional();
 }
 root.GarrawayReview={fields,collect,summary,bind};
})(window);
;
(() => {
  
  var scheduleClone = (x) => JSON.parse(JSON.stringify(x));
  function emptyCandidate() {
    return { undecided: true, date: "", setupStart: "", eventStart: "", eventEnd: "", clearEnd: "", setupDay: 0, eventStartDay: 0, eventEndDay: 0, clearEndDay: 0 };
  }
  function scheduleForEvent(event) {
    if (event.schedule && Array.isArray(event.schedule.candidates) && event.schedule.candidates.length === 2) return scheduleClone(event.schedule);
    const common = event.common ?? {};
    return { revision: 0, candidates: ["first", "second"].map((prefix) => ({ ...emptyCandidate(), undecided: !common[prefix + "Date"], date: String(common[prefix + "Date"] || ""), eventStart: String(common[prefix + "Start"] || ""), eventEnd: String(common[prefix + "End"] || "") })), program: [] };
  }

  
  var HEARING_SCHEMA_VERSION = "hearing-labels-2026-10-11-v1";
  var HEARING_SOURCE = Object.freeze({
    id: "manual-linked-hearing-example",
    url: "",
    retrievedAt: "2026-10-11",
    sourceKind: "labels-only-accessible-example",
    originalTemplateUrl: "",
    originalTemplateVerified: false,
    requiredMarkersVerified: false,
    note: "\u78BA\u8A8D\u3067\u304D\u305F\u8A18\u5165\u4F8B\u306E\u9805\u76EE\u540D\u3060\u3051\u3092\u4F7F\u7528\u3057\u3066\u3044\u307E\u3059\u3002\u5143\u306E\u7A7A\u6B04\u3072\u306A\u578B\u306F\u30A2\u30AF\u30BB\u30B9\u3067\u304D\u305A\u3001\u4E00\u81F4\u30FB\u5FC5\u9808\u6307\u5B9A\u30FB\u78BA\u8A8D\u4E8B\u9805\u5168\u6587\u306F\u672A\u78BA\u8A8D\u3067\u3059\u3002\u8A18\u5165\u8005\u306E\u56DE\u7B54\u306F\u4F7F\u7528\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u5FC5\u9808\u533A\u5206\u306F\u3053\u306E\u30A2\u30D7\u30EA\u306E\u5165\u529B\u8A2D\u8A08\u3067\u3059\u3002"
  });
  var consentUrl = "";
  var anchor = (...cells) => cells.map((cell) => ({ sourceId: HEARING_SOURCE.id, cell, url: `${HEARING_SOURCE.url}&range=${cell}` }));
  var consentAnchor = (...clauses) => clauses.map((clause) => ({ sourceId: "original-event-consent", clause, url: consentUrl }));
  var choices = (entries) => entries.map(([value, label]) => ({ value, label }));
  var yesNo = choices([["yes", "\u3042\u308A\u30FB\u53EF\u80FD"], ["no", "\u306A\u3057\u30FB\u4E0D\u53EF"], ["undecided", "\u76F8\u8AC7\u30FB\u672A\u5B9A"]]);
  var field = (label, type, group, requirement, sourceAnchors, extra = {}) => ({ label, type, group, requirement, sourceAnchors, ...extra, ...extra.requiredWhen?.value !== void 0 ? { visibleWhen: { field: extra.requiredWhen.field, values: [extra.requiredWhen.value] } } : {} });
  var HEARING_FIELDS = Object.freeze({
    candidateIndex: field("\u8A73\u7D30\u3092\u78BA\u8A8D\u3059\u308B\u65E5\u7A0B\u5019\u88DC", "candidate", "\u65E5\u6642\u30FB\u53D7\u4ED8", "core", anchor("L2", "L3"), { options: choices([[0, "\u7B2C1\u5E0C\u671B"], [1, "\u7B2C2\u5E0C\u671B"]]), help: "\u3053\u306E\u9078\u629E\u3060\u3051\u3067\u4E88\u7D04\u30FB\u627F\u8A8D\u306F\u78BA\u5B9A\u3057\u307E\u305B\u3093\u3002" }),
    receptionStart: field("\u53D7\u4ED8\u958B\u59CB\u6642\u523B", "time", "\u65E5\u6642\u30FB\u53D7\u4ED8", "core", anchor("L3")),
    receptionDay: field("\u53D7\u4ED8\u958B\u59CB\u306E\u65E5", "day", "\u65E5\u6642\u30FB\u53D7\u4ED8", "core", anchor("L3"), { options: choices([[0, "\u5F53\u65E5"], [1, "\u7FCC\u65E5"]]) }),
    programDocumentUrl: field("\u5F53\u65E5\u306E\u884C\u7A0B\u8868\u306E\u8CC7\u6599URL", "text", "\u65E5\u6642\u30FB\u53D7\u4ED8", "optional", anchor("L5"), { maxLength: 1e3, help: "\u884C\u7A0B\u8868\u3092\u4E88\u5B9A\u6B04\u306B\u5165\u529B\u6E08\u307F\u306A\u3089\u4E0D\u8981\u3067\u3059\u3002\u8CC7\u6599\u306E\u5185\u5BB9\u30FB\u30A2\u30AF\u30BB\u30B9\u53EF\u5426\u306F\u30B9\u30BF\u30C3\u30D5\u304C\u5225\u9014\u78BA\u8A8D\u3057\u307E\u3059\u3002" }),
    layoutNotes: field("\u5E0C\u671B\u30EC\u30A4\u30A2\u30A6\u30C8\u30FB\u914D\u7F6E\u306E\u88DC\u8DB3", "textarea", "\u65E5\u6642\u30FB\u53D7\u4ED8", "optional", anchor("B11", "B12"), { help: "\u5E0C\u671B\u30B9\u30DA\u30FC\u30B9\u306F\u4E88\u5B9A\u6B04\u3092\u518D\u5229\u7528\u3057\u307E\u3059\u3002\u914D\u7F6E\u306E\u5E0C\u671B\u3068\u65BD\u8A2D\u304C\u6C7A\u3081\u308B\u78BA\u5B9A\u30EC\u30A4\u30A2\u30A6\u30C8\u306F\u5225\u3067\u3059\u3002" }),
    feeMode: field("\u53C2\u52A0\u8CBB", "select", "\u53C2\u52A0\u6761\u4EF6", "core", anchor("B6"), { options: choices([["free", "\u7121\u6599"], ["paid", "\u6709\u6599"], ["undecided", "\u76F8\u8AC7\u30FB\u672A\u5B9A"]]), help: "\u30A4\u30D9\u30F3\u30C8\u53C2\u52A0\u8005\u306E\u53C2\u52A0\u8CBB\u3067\u3059\u3002\u65BD\u8A2D\u30FB\u6A5F\u6750\u306E\u5229\u7528\u6599\u3068\u306F\u5225\u3067\u3059\u3002" }),
    feeAmount: field("\u53C2\u52A0\u8CBB\u306E\u91D1\u984D\u30FB\u5358\u4F4D", "text", "\u53C2\u52A0\u6761\u4EF6", "conditional", anchor("B6"), { maxLength: 120, requiredWhen: { field: "feeMode", value: "paid" }, help: "\u4F8B\uFF1A1\u4EBA500\u5186\u3002\u6599\u91D1\u533A\u5206\u304C\u3042\u308B\u5834\u5408\u306F\u5404\u533A\u5206\u3092\u8A18\u5165\u3002" }),
    feeCollectionMethod: field("\u53C2\u52A0\u8CBB\u306E\u5FB4\u53CE\u65B9\u6CD5", "text", "\u53C2\u52A0\u6761\u4EF6", "conditional", anchor("B6"), { maxLength: 300, requiredWhen: { field: "feeMode", value: "paid" } }),
    walkIns: field("\u5F53\u65E5\u53C2\u52A0\u306E\u53EF\u5426", "select", "\u53C2\u52A0\u6761\u4EF6", "core", anchor("B8", "F8", "F9"), { options: yesNo }),
    walkInPlan: field("\u5F53\u65E5\u53C2\u52A0\u306E\u53D7\u4ED8\u65B9\u6CD5", "textarea", "\u53C2\u52A0\u6761\u4EF6", "conditional", anchor("B8"), { requiredWhen: { field: "walkIns", value: "yes" } }),
    dayContactMode: field("\u5F53\u65E5\u306E\u8CAC\u4EFB\u8005\u30FB\u9023\u7D61\u5148", "select", "\u5F53\u65E5\u306E\u62C5\u5F53", "core", anchor("B15", "B16", "D16", "D17"), { options: choices([["same", "\u7533\u8ACB\u6642\u3068\u540C\u3058"], ["different", "\u5F53\u65E5\u306F\u5225\u306E\u8CAC\u4EFB\u8005\u30FB\u9023\u7D61\u5148"], ["undecided", "\u76F8\u8AC7\u30FB\u672A\u5B9A"]]) }),
    dayResponsibleName: field("\u5F53\u65E5\u306E\u8CAC\u4EFB\u8005\u540D", "text", "\u5F53\u65E5\u306E\u62C5\u5F53", "conditional", anchor("B15"), { maxLength: 120, requiredWhen: { field: "dayContactMode", value: "different" } }),
    dayEmail: field("\u5F53\u65E5\u306E\u9023\u7D61\u7528\u30E1\u30FC\u30EB", "text", "\u5F53\u65E5\u306E\u62C5\u5F53", "optional", anchor("D16"), { maxLength: 254, visibleWhen: { field: "dayContactMode", values: ["different"] } }),
    dayPhone: field("\u5F53\u65E5\u9023\u7D61\u3067\u304D\u308B\u96FB\u8A71", "text", "\u5F53\u65E5\u306E\u62C5\u5F53", "conditional", anchor("D17"), { maxLength: 30, requiredWhen: { field: "dayContactMode", value: "different" } }),
    staffCount: field("\u904B\u55B6\u5354\u529B\u8005\u306E\u4EBA\u6570", "text", "\u5F53\u65E5\u306E\u62C5\u5F53", "optional", anchor("B18"), { maxLength: 4, help: "\u8CAC\u4EFB\u8005\u4EE5\u5916\u306E\u5354\u529B\u8005\u30020\u306F\u5354\u529B\u8005\u306A\u3057\u3001\u7A7A\u6B04\u306F\u672A\u56DE\u7B54\u3067\u3059\u3002" }),
    staffRoles: field("\u904B\u55B6\u5354\u529B\u8005\u306E\u62C5\u5F53\u30FB\u5F79\u5272", "textarea", "\u5F53\u65E5\u306E\u62C5\u5F53", "conditional", anchor("B18"), { requiredWhen: { field: "staffCount", positive: true } }),
    operationsPlan: field("\u9032\u884C\u30FB\u53D7\u4ED8\u30FB\u53C2\u52A0\u8005\u5BFE\u5FDC\u30FB\u9000\u51FA\u8A98\u5C0E\u306E\u62C5\u5F53", "textarea", "\u5F53\u65E5\u306E\u62C5\u5F53", "core", [...anchor("B18"), ...consentAnchor("C07", "C08", "C18")], { help: "\u4E3B\u50AC\u8005\u5074\u3067\u8AB0\u304C\u4F55\u3092\u62C5\u5F53\u3059\u308B\u304B\u3092\u8A18\u5165\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u5165\u529B\u306F\u540C\u610F\u30FB\u5B9F\u65BD\u6E08\u307F\u306E\u8A3C\u62E0\u306B\u306F\u306A\u308A\u307E\u305B\u3093\u3002" }),
    restorationPlan: field("\u8A2D\u55B6\u30FB\u7247\u4ED8\u3051\u30FB\u539F\u72B6\u5FA9\u5E30\u306E\u62C5\u5F53\u3068\u624B\u9806", "textarea", "\u5F53\u65E5\u306E\u62C5\u5F53", "core", consentAnchor("C03", "C09", "C10"), { help: "\u673A\u30FB\u6905\u5B50\u30FB\u5099\u54C1\u306E\u5FA9\u65E7\u3001\u5909\u66F4\u524D\u306E\u5199\u771F\u3001\u5B8C\u5168\u64A4\u53CE\u307E\u3067\u306E\u6BB5\u53D6\u308A\u3092\u8A18\u5165\u3057\u3066\u304F\u3060\u3055\u3044\u3002" }),
    publicity: field("\u30A4\u30D9\u30F3\u30C8\u5185\u5BB9\u306ESNS\u63B2\u8F09\u53EF\u5426", "select", "\u5E83\u5831\u30FB\u914D\u4FE1", "optional", anchor("B20", "F20", "F21"), { options: choices([["yes", "\u63B2\u8F09\u53EF\u80FD"], ["no", "\u63B2\u8F09\u4E0D\u53EF"], ["conditional", "\u6761\u4EF6\u4ED8\u304D"], ["undecided", "\u76F8\u8AC7\u30FB\u672A\u5B9A"]]), help: "\u544A\u77E5\u63B2\u8F09\u306E\u6761\u4EF6\u3067\u3059\u3002\u65BD\u8A2D\u306B\u3088\u308B\u64AE\u5F71\u306E\u540C\u610F\u3084\u7814\u7A76\u53C2\u52A0\u306E\u540C\u610F\u3068\u306F\u5225\u3067\u3059\u3002" }),
    publicityConditions: field("SNS\u63B2\u8F09\u306E\u6761\u4EF6", "textarea", "\u5E83\u5831\u30FB\u914D\u4FE1", "conditional", anchor("B20"), { requiredWhen: { field: "publicity", value: "conditional" } }),
    streaming: field("\u30AA\u30F3\u30E9\u30A4\u30F3\u914D\u4FE1\u306E\u4E88\u5B9A", "select", "\u5E83\u5831\u30FB\u914D\u4FE1", "optional", anchor("B22"), { options: yesNo }),
    streamingDetails: field("\u914D\u4FE1\u5185\u5BB9\u30FB\u65B9\u6CD5", "textarea", "\u5E83\u5831\u30FB\u914D\u4FE1", "conditional", anchor("B22"), { requiredWhen: { field: "streaming", value: "yes" } }),
    streamingEquipment: field("\u914D\u4FE1\u6A5F\u6750\u30FB\u6301\u3061\u8FBC\u307F\u5185\u5BB9", "textarea", "\u5E83\u5831\u30FB\u914D\u4FE1", "conditional", anchor("B22"), { requiredWhen: { field: "streaming", value: "yes" } }),
    streamingOperator: field("\u914D\u4FE1\u62C5\u5F53\u8005\u30FB\u64CD\u4F5C\u62C5\u5F53", "text", "\u5E83\u5831\u30FB\u914D\u4FE1", "conditional", anchor("B22"), { maxLength: 300, requiredWhen: { field: "streaming", value: "yes" } }),
    media: field("\u30E1\u30C7\u30A3\u30A2\u53D6\u6750\u306E\u4E88\u5B9A", "select", "\u642C\u5165\u30FB\u98F2\u98DF\u30FB\u53D6\u6750", "optional", anchor("B25"), { options: yesNo, help: "\u78BA\u8A8D\u3067\u304D\u305F\u8A18\u5165\u4F8B\u3067\u306F\u7533\u8ACB\u671F\u9650\u306F15\u65E5\u524D\u3067\u3059\u3002\u671F\u9650\u306E\u78BA\u8A8D\u3068\u7533\u8ACB\u30FB\u627F\u8A8D\u306F\u5225\u306E\u624B\u7D9A\u304D\u3067\u3059\u3002" }),
    mediaDetails: field("\u53D6\u6750\u5185\u5BB9\u30FB\u6A5F\u6750\u30FB\u540C\u884C\u62C5\u5F53\u8005", "textarea", "\u642C\u5165\u30FB\u98F2\u98DF\u30FB\u53D6\u6750", "conditional", anchor("B25"), { requiredWhen: { field: "media", value: "yes" } }),
    mediaApplicationPlan: field("\u53D6\u6750\u7533\u8ACB\u306E\u4E88\u5B9A\u30FB\u72B6\u6CC1", "textarea", "\u642C\u5165\u30FB\u98F2\u98DF\u30FB\u53D6\u6750", "conditional", anchor("B25"), { requiredWhen: { field: "media", value: "yes" }, help: "\u7533\u8ACB\u5148\u30FB\u7533\u8ACB\u4E88\u5B9A\u65E5\u3084\u78BA\u8A8D\u4E2D\u306E\u70B9\u3092\u8A18\u5165\u3002\u56DE\u7B54\u3060\u3051\u3067\u7533\u8ACB\u30FB\u627F\u8A8D\u6E08\u307F\u306B\u306F\u306A\u308A\u307E\u305B\u3093\u3002" }),
    deliveries: field("\u5C4A\u51FA\u304C\u5FC5\u8981\u306A\u5927\u304D\u306A\u8377\u7269\u306E\u642C\u5165", "select", "\u642C\u5165\u30FB\u98F2\u98DF\u30FB\u53D6\u6750", "optional", anchor("B28"), { options: yesNo, help: "\u78BA\u8A8D\u3067\u304D\u305F\u8A18\u5165\u4F8B\u3067\u306F\u642C\u5165\u30FB\u642C\u51FA\u7533\u8ACB\u306F\u524D\u65E5\u307E\u3067\u3067\u3059\u3002" }),
    deliveryDetails: field("\u642C\u5165\u30FB\u642C\u51FA\u3059\u308B\u7269\u3068\u65B9\u6CD5", "textarea", "\u642C\u5165\u30FB\u98F2\u98DF\u30FB\u53D6\u6750", "conditional", anchor("B28"), { requiredWhen: { field: "deliveries", value: "yes" } }),
    deliveryApplicationPlan: field("\u642C\u5165\u30FB\u642C\u51FA\u7533\u8ACB\u306E\u4E88\u5B9A\u30FB\u72B6\u6CC1", "textarea", "\u642C\u5165\u30FB\u98F2\u98DF\u30FB\u53D6\u6750", "conditional", anchor("B28"), { requiredWhen: { field: "deliveries", value: "yes" } }),
    catering: field("\u30B1\u30FC\u30BF\u30EA\u30F3\u30B0\u306E\u4E88\u5B9A", "select", "\u642C\u5165\u30FB\u98F2\u98DF\u30FB\u53D6\u6750", "optional", anchor("B31", "F31", "F32"), { options: yesNo }),
    cateringDetails: field("\u30B1\u30FC\u30BF\u30EA\u30F3\u30B0\u306E\u5185\u5BB9", "textarea", "\u642C\u5165\u30FB\u98F2\u98DF\u30FB\u53D6\u6750", "conditional", anchor("B31"), { requiredWhen: { field: "catering", value: "yes" } }),
    wastePlan: field("\u3054\u307F\u306E\u6301\u3061\u5E30\u308A\u30FB\u51E6\u7406\u65B9\u6CD5", "textarea", "\u642C\u5165\u30FB\u98F2\u98DF\u30FB\u53D6\u6750", "conditional", anchor("B31"), { requiredWhen: { field: "catering", value: "yes" } }),
    equipmentPlan: field("\u5229\u7528\u3059\u308B\u6A5F\u6750", "select", "\u6A5F\u6750", "core", anchor("B34"), { options: choices([["none", "\u6A5F\u6750\u306F\u4F7F\u308F\u306A\u3044"], ["requested", "\u8CB8\u51FA\u30FB\u6301\u8FBC\u6A5F\u6750\u3042\u308A"], ["undecided", "\u76F8\u8AC7\u30FB\u672A\u5B9A"]]) }),
    equipmentOperator: field("\u6A5F\u6750\u306E\u64CD\u4F5C\u62C5\u5F53\u8005", "text", "\u6A5F\u6750", "conditional", [...anchor("B18", "B22"), ...consentAnchor("C07")], { maxLength: 300, requiredWhen: { field: "equipmentPlan", value: "requested" } }),
    equipmentFallback: field("\u6A5F\u6750\u304C\u4F7F\u3048\u306A\u3044\u5834\u5408\u306E\u5BFE\u5FDC", "textarea", "\u6A5F\u6750", "optional", anchor("B22", "B34"), { visibleWhen: { field: "equipmentPlan", values: ["requested"] } }),
    notes: field("\u5171\u6709\u3059\u308B\u5099\u8003", "textarea", "\u5099\u8003", "optional", anchor("L20"), { maxLength: 2e3, help: "\u7533\u8ACB\u8005\u3068\u30B9\u30BF\u30C3\u30D5\u3067\u5171\u6709\u3059\u308B\u5185\u5BB9\u3067\u3059\u3002\u30B9\u30BF\u30C3\u30D5\u5185\u90E8\u30E1\u30E2\u3068\u306F\u5225\u3067\u3059\u3002" })
  });
  var HEARING_EQUIPMENT_CATALOG = Object.freeze([
    ["monitor", "\u30E2\u30CB\u30BF\u30FC", "D34"],
    ["microphone", "\u30DE\u30A4\u30AF", "H34"],
    ["hdmi", "HDMI\u30B1\u30FC\u30D6\u30EB", "D35"],
    ["speaker", "\u30B9\u30D4\u30FC\u30AB\u30FC", "H35"],
    ["typeCAdapter", "\u5909\u63DB\u30B1\u30FC\u30D6\u30EB / \u30BF\u30A4\u30D7C", "D36"],
    ["mixer", "\u30DF\u30AD\u30B5\u30FC", "H36"],
    ["lightningAdapter", "\u5909\u63DB\u30B1\u30FC\u30D6\u30EB / \u30E9\u30A4\u30C8\u30CB\u30F3\u30B0", "D37"],
    ["clicker", "\u30AF\u30EA\u30C3\u30AB\u30FC", "H37"],
    ["usbAdapter", "\u5909\u63DB\u30B1\u30FC\u30D6\u30EB / USB", "D38"],
    ["extensionCord", "\u5EF6\u9577\u30B3\u30FC\u30C9", "D39"],
    ["other", "\u305D\u306E\u4ED6\u306E\u6A5F\u6750\uFF08\u8981\u78BA\u8A8D\uFF09", "B34"]
  ].map(([id2, label, cell]) => ({ id: id2, label, sourceAnchors: anchor(cell) })));
  var HEARING_REUSED_FIELDS = Object.freeze([
    ["common.eventTitle", "\u30A4\u30D9\u30F3\u30C8\u540D", "B2"],
    ["common.organization", "\u4E3B\u50AC\u56E3\u4F53\u30FB\u4F01\u696D\u540D", "B14"],
    ["common.responsibleName", "\u7533\u8ACB\u6642\u306E\u8CAC\u4EFB\u8005", "B15"],
    ["common.email", "\u7533\u8ACB\u6642\u306E\u30E1\u30FC\u30EB", "D16"],
    ["common.phone", "\u7533\u8ACB\u6642\u306E\u5F53\u65E5\u96FB\u8A71", "D17"],
    ["common.attendance", "\u4E88\u5B9A\u4EBA\u6570", "B10"],
    ["common.audience", "\u53C2\u52A0\u5BFE\u8C61", "B7"],
    ["common.purpose", "\u958B\u50AC\u76EE\u7684", "L14"],
    ["common.summary", "\u30A4\u30D9\u30F3\u30C8\u6982\u8981", "L5"],
    ["schedule.candidates", "\u5E0C\u671B\u65E5\u6642\u30FB\u6E96\u5099\u30FB\u5B8C\u5168\u64A4\u53CE\u30FB\u5E0C\u671B\u30B9\u30DA\u30FC\u30B9", "L2"],
    ["schedule.program", "\u5F53\u65E5\u306E\u884C\u7A0B\u8868", "L5"],
    ["reviewContext.participation", "\u4E00\u822C\u53C2\u52A0\u30FB\u6761\u4EF6\u4ED8\u304D\u30FB\u62DB\u5F85\u7B49\u306E\u53C2\u52A0\u6761\u4EF6", "B7"],
    ["reviewContext.participationNote", "\u53C2\u52A0\u6761\u4EF6\u306E\u8AAC\u660E", "B7"]
  ].map(([path, label, cell]) => ({ path, label, sourceAnchors: anchor(cell) })));
  var HEARING_CORE_FIELDS = Object.freeze(Object.keys(HEARING_FIELDS).filter((key) => HEARING_FIELDS[key].requirement === "core"));
  var own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  var record = (value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || Object.getPrototypeOf(prototype) === null && own(prototype, "constructor") && typeof prototype.constructor === "function" && prototype.constructor.name === "Object";
  };
  var controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
  var clockTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  var minutes = (value, day) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) + day * 1440;
  var phoneValid = (value) => /^[+\d\s()-]{8,30}$/.test(value) && /^\d{8,15}$/.test(value.replace(/\D/g, ""));
  var emailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  var issueList = () => {
    const fieldIssues = [];
    return { fieldIssues, add(fieldId, message, code = "invalid") {
      if (!fieldIssues.some((issue) => issue.fieldId === fieldId && issue.message === message)) fieldIssues.push({ fieldId, message, code });
    } };
  };
  function emptyHearing() {
    return { ...Object.fromEntries(Object.keys(HEARING_FIELDS).map((key) => [key, key === "receptionDay" ? 0 : ""])), equipment: [] };
  }
  function validateHearing(input, { event } = {}) {
    const value = emptyHearing(), result = issueList(), { add } = result;
    if (!record(input)) {
      add("hearing", "\u30D2\u30A2\u30EA\u30F3\u30B0\u306E\u5F62\u5F0F\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044");
      return { value, issues: result.fieldIssues.map((issue) => issue.message), fieldIssues: result.fieldIssues };
    }
    for (const key of Object.keys(input)) if (!own(HEARING_FIELDS, key) && key !== "equipment") add("hearing." + key, "\u30D2\u30A2\u30EA\u30F3\u30B0\u306E\u56DE\u7B54\u4EE5\u5916\u306F\u7DE8\u96C6\u3067\u304D\u307E\u305B\u3093", "unknown_field");
    for (const [key, definition] of Object.entries(HEARING_FIELDS)) {
      if (!own(input, key) || input[key] === void 0) continue;
      const raw = input[key], path = "hearing." + key;
      if (definition.type === "day" || definition.type === "candidate") {
        if (raw === 0 || raw === 1 || definition.type === "candidate" && raw === "") value[key] = raw;
        else add(path, definition.label + "\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
        continue;
      }
      if (typeof raw !== "string") {
        add(path, definition.label + "\u306F\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        continue;
      }
      const normalized = raw.trim(), max = definition.maxLength ?? (definition.type === "time" ? 5 : 1e3);
      if (normalized.length > max || controlCharacters.test(normalized)) {
        add(path, definition.label + "\u306F" + max + "\u6587\u5B57\u4EE5\u5185\u306E\u6709\u52B9\u306A\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        continue;
      }
      if (definition.type === "select" && normalized && !definition.options.some((option) => option.value === normalized)) {
        add(path, definition.label + "\u306E\u9078\u629E\u80A2\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044");
        continue;
      }
      if (definition.type === "time" && normalized && !clockTime(normalized)) {
        add(path, definition.label + "\u3092HH:mm\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        continue;
      }
      value[key] = normalized;
    }
    if (value.dayEmail && !emailValid(value.dayEmail)) add("hearing.dayEmail", "\u5F53\u65E5\u306E\u9023\u7D61\u7528\u30E1\u30FC\u30EB\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044");
    if (value.programDocumentUrl) {
      if (!/^https:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(value.programDocumentUrl)) add("hearing.programDocumentUrl", "\u884C\u7A0B\u8868\u306E\u8CC7\u6599URL\u306F\u8A8D\u8A3C\u60C5\u5831\u3092\u542B\u307E\u306A\u3044https\u306EURL\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    }
    if (value.dayPhone && !phoneValid(value.dayPhone)) add("hearing.dayPhone", "\u5F53\u65E5\u9023\u7D61\u3067\u304D\u308B\u96FB\u8A71\u756A\u53F7\u3092\u534A\u89D2\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    if (value.staffCount && !/^(0|[1-9]\d{0,3})$/.test(value.staffCount)) add("hearing.staffCount", "\u904B\u55B6\u5354\u529B\u8005\u306E\u4EBA\u6570\u306F0\u4EE5\u4E0A\u306E\u6574\u6570\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    if (own(input, "equipment")) {
      if (!Array.isArray(input.equipment) || input.equipment.length > 30) add("hearing.equipment", "\u6A5F\u6750\u306F30\u884C\u4EE5\u5185\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      const rows = Array.isArray(input.equipment) ? input.equipment.slice(0, 30) : [], seen =   new Set();
      rows.forEach((raw, index) => {
        const path = "hearing.equipment." + index;
        if (!record(raw)) {
          add(path, "\u6A5F\u6750\u306E\u660E\u7D30\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044");
          return;
        }
        if (Object.keys(raw).some((key) => !["itemId", "quantity", "provider", "otherName"].includes(key))) add(path, "\u6A5F\u6750\u660E\u7D30\u4EE5\u5916\u306E\u9805\u76EE\u306F\u7DE8\u96C6\u3067\u304D\u307E\u305B\u3093", "unknown_field");
        const row = {};
        for (const key of ["itemId", "quantity", "provider", "otherName"]) {
          const rawValue = own(raw, key) ? raw[key] : "";
          if (typeof rawValue !== "string" || rawValue.length > (key === "otherName" ? 120 : 30) || controlCharacters.test(rawValue)) {
            add(path + "." + key, "\u6A5F\u6750\u306E\u9805\u76EE\u3092\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
            row[key] = "";
          } else row[key] = rawValue.trim();
        }
        if (!HEARING_EQUIPMENT_CATALOG.some((item) => item.id === row.itemId)) add(path + ".itemId", "\u6A5F\u6750\u306E\u7A2E\u985E\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
        if (!/^[1-9]\d{0,2}$/.test(row.quantity)) add(path + ".quantity", "\u4F7F\u7528\u3059\u308B\u6A5F\u6750\u306E\u6570\u91CF\u306F1\u4EE5\u4E0A\u306E\u6574\u6570\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        if (!["facility", "organizer"].includes(row.provider)) add(path + ".provider", "\u6A5F\u6750\u306F\u65BD\u8A2D\u8CB8\u51FA\u304B\u4E3B\u50AC\u8005\u6301\u8FBC\u304B\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
        if (row.itemId === "other" && !row.otherName) add(path + ".otherName", "\u305D\u306E\u4ED6\u306E\u6A5F\u6750\u540D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        const identity = row.itemId + ":" + row.provider + (row.itemId === "other" ? ":" + row.otherName : "");
        if (seen.has(identity)) add(path, "\u540C\u3058\u6A5F\u6750\u30FB\u63D0\u4F9B\u5143\u306F1\u884C\u306B\u307E\u3068\u3081\u3066\u304F\u3060\u3055\u3044");
        seen.add(identity);
        value.equipment.push(row);
      });
    }
    const facilityMics = value.equipment.filter((row) => row.itemId === "microphone" && row.provider === "facility").reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
    if (facilityMics > 2) add("hearing.equipment", "\u78BA\u8A8D\u3067\u304D\u305F\u8A18\u5165\u4F8B\u3067\u306F\u65BD\u8A2D\u8CB8\u51FA\u306E\u30DE\u30A4\u30AF\u306F2\u672C\u307E\u3067\u3067\u3059", "source_limit");
    if (event && value.candidateIndex !== "" && value.receptionStart) {
      const candidate = scheduleForEvent(event).candidates[value.candidateIndex];
      if (candidate && !candidate.undecided && clockTime(candidate.setupStart) && clockTime(candidate.eventStart)) {
        const reception = minutes(value.receptionStart, value.receptionDay);
        if (reception < minutes(candidate.setupStart, candidate.setupDay) || reception > minutes(candidate.eventStart, candidate.eventStartDay)) add("hearing.receptionStart", "\u53D7\u4ED8\u958B\u59CB\u306F\u9078\u629E\u3057\u305F\u5019\u88DC\u306E\u6E96\u5099\u958B\u59CB\u304B\u3089\u30A4\u30D9\u30F3\u30C8\u958B\u59CB\u307E\u3067\u306B\u3057\u3066\u304F\u3060\u3055\u3044", "time_order");
      }
    }
    return { value, issues: result.fieldIssues.map((issue) => issue.message), fieldIssues: result.fieldIssues };
  }
  function hearingForEvent(event) {
    return validateHearing(event?.hearing ?? {}).value;
  }

  
  var publicAnchors = (anchors) => (anchors || []).map(({ sourceId, cell, clause }) => ({ sourceId, ...cell ? { cell } : {}, ...clause ? { clause } : {} }));
  var publicFields = Object.fromEntries(Object.entries(HEARING_FIELDS).map(([key, value]) => [key, { ...value, sourceAnchors: publicAnchors(value.sourceAnchors) }]));
  var { id, sourceKind, originalTemplateVerified, requiredMarkersVerified, note } = HEARING_SOURCE;
  window.GarrawayHearingSchema = {
    HEARING_SCHEMA_VERSION,
    HEARING_SOURCE: { id, sourceKind, originalTemplateVerified, requiredMarkersVerified, note },
    HEARING_FIELDS: publicFields,
    HEARING_EQUIPMENT_CATALOG: HEARING_EQUIPMENT_CATALOG.map((item) => ({ ...item, sourceAnchors: publicAnchors(item.sourceAnchors) })),
    HEARING_REUSED_FIELDS: HEARING_REUSED_FIELDS.map((item) => ({ ...item, sourceAnchors: publicAnchors(item.sourceAnchors) })),
    emptyHearing,
    hearingForEvent,
    validateHearing
  };
})();
;
(function(root){
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const clone=value=>JSON.parse(JSON.stringify(value));
 const schema=()=>root.GarrawayHearingSchema;
 const present=value=>value!==undefined&&value!==null&&String(value).trim()!=='';
 const text=value=>present(value)?escape(value):'未記入';
 const safeUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}};
 const sourceLink=(url,label='原文の出典を開く')=>safeUrl(url)?'<a href="'+escape(safeUrl(url))+'" target="_blank" rel="noopener noreferrer">'+label+'</a>':'';
 const list=values=>'<ul>'+values.map(value=>'<li>'+escape(value)+'</li>').join('')+'</ul>';
 const row=(label,value)=>'<dt>'+escape(label)+'</dt><dd>'+text(value)+'</dd>';
 const labels={eventTitle:'イベント名',responsibleName:'主催者のお名前',organization:'会社・団体名／所属',attendance:'想定参加人数',audience:'参加者の属性',summary:'イベント概要',purpose:'この会場を選ぶ理由',understanding:'場の理解',impact:'生みたい変化'};
 const reviewLabels={participation:'参加条件',participationNote:'参加条件の補足',sales:'販売・勧誘',salesNote:'販売・勧誘の補足',equipmentNote:'機材・設営の相談',supportNote:'人員・支援の相談',safetyNote:'安全面の相談'};
 const choices={open:'どなたでも参加可能',conditions:'条件に合う方',internal:'社内・関係者のみ',none:'なし',sales:'販売あり',solicitation:'勧誘あり',both:'販売・勧誘あり',undecided:'未定'};
 function selectedLabel(field,value){return field.options?.find(option=>String(option.value)===String(value))?.label??value;}
 function time(candidate,key,day){return present(candidate?.[key])?(Number(candidate[day])===1?'翌日 ':'')+candidate[key]:'未記入';}
 function candidateLabel(candidate,index){return '第'+(index+1)+'希望：'+(candidate?.undecided?'未定':(candidate?.date||'日付未記入')+(candidate?.space?' ／ '+candidate.space:'')+' ／ 準備 '+time(candidate,'setupStart','setupDay')+' → 開始 '+time(candidate,'eventStart','eventStartDay')+' → 終了 '+time(candidate,'eventEnd','eventEndDay')+' → 完全撤収 '+time(candidate,'clearEnd','clearEndDay'));}
 function hearingSummary(hearing={}){
  const fields=schema()?.HEARING_FIELDS||{};
  const details=Object.entries(fields).filter(([key])=>present(hearing[key])).map(([key,field])=>row(field.label,field.type==='candidate'?(present(hearing[key])?'第'+(Number(hearing[key])+1)+'希望':''):selectedLabel(field,hearing[key]))).join('');
  const items=(Array.isArray(hearing.equipment)?hearing.equipment:[]).map(item=>{const label=schema()?.HEARING_EQUIPMENT_CATALOG?.find(entry=>entry.id===item.itemId)?.label||item.itemId;return '<li>'+escape(item.itemId==='other'?(item.otherName||label):label)+' ／ '+escape(item.quantity)+'点 ／ '+escape(item.provider==='facility'?'会場へ事前申請':item.provider==='organizer'?'主催者持込':'提供元未記入')+'</li>';}).join('');
  return (details?'<dl>'+details+'</dl>':'<p>詳細の回答はまだありません。</p>')+(items?'<h4>機材の申請・持込予定</h4><ul>'+items+'</ul>':'');
 }
 function contactSummary(contact){if(!contact||typeof contact!=='object')return '';return '<section class="consent-contact"><h4>この時点の連絡先</h4><dl>'+[['email','申請時のメール'],['phone','申請時の電話'],['dayEmail','当日の連絡用メール'],['dayPhone','当日の電話']].filter(([key])=>present(contact[key])).map(([key,label])=>row(label,contact[key])).join('')+'</dl><p class="meta">連絡先の修正は条件の同意とは別に確認します。ここに表示された連絡先への送信は行いません。</p></section>';}
 function conditionsSummary(conditions={}){
  const common=conditions.common||{},schedule=conditions.schedule||{},review=conditions.reviewContext||{};
  return '<div class="consent-conditions"><h3>今回確認するイベントの条件</h3><p class="meta">既に入力した申請内容・希望日時・プログラムを再利用しています。変更がある場合は元の入力欄で保存し、条件を読み直してください。</p><dl>'+Object.entries(labels).filter(([key])=>present(common[key])).map(([key,label])=>row(label,common[key])).join('')+'</dl><h4>希望日時・準備・完全撤収</h4>'+list((schedule.candidates||[]).map(candidateLabel))+(schedule.program?.length?'<h4>プログラム</h4>'+list(schedule.program.map(entry=>(entry.startDay===1?'翌日 ':'')+(entry.start||'開始未記入')+'〜'+(entry.endDay===1?'翌日 ':'')+(entry.end||'終了未記入')+' '+(entry.title||'内容未記入')+(entry.note?' ／ '+entry.note:''))):'')+'<dl>'+Object.entries(reviewLabels).filter(([key])=>present(review[key])).map(([key,label])=>row(label,['participation','sales'].includes(key)?(Object.hasOwn(choices,review[key])?choices[review[key]]:review[key]):review[key])).join('')+'</dl><h4>詳細ヒアリング</h4>'+hearingSummary(conditions.hearing||{})+'</div>';
 }
 function groupClauses(document){
  const groups=[];
  for(const clause of document.clauses||[]){let group=groups.find(entry=>entry.title===clause.group);if(!group){group={title:clause.group,clauses:[]};groups.push(group);}group.clauses.push(clause);}
  return groups;
 }
 function originalDocument(document={},{confirm=false}={}){
  const groups=groupClauses(document);
  const notes=Array.isArray(document.notes)?document.notes.map(note=>typeof note==='string'?note:note?.text).filter(Boolean):[];
  return '<section class="consent-document"><h3>'+escape(document.title||'最終利用同意書')+'</h3><p>'+escape(document.introduction||'')+'</p><p class="meta">文書版：'+escape(document.version||'未記録')+' ／ 原文の'+(document.clauses?.length||0)+'項目</p><details data-consent-full-text><summary>元の同意書全文をそのまま読む</summary><pre class="consent-original-text">'+escape(document.fullText||'原文の保存がありません。')+'</pre>'+sourceLink(document.sourceUrl)+'</details>'+groups.map((group,index)=>'<fieldset class="consent-clause-group" data-consent-clause-group="'+index+'"><legend>'+escape(group.title)+'</legend><ol>'+group.clauses.map(clause=>'<li data-clause-id="'+escape(clause.id)+'"><span class="meta">'+escape(clause.id)+'</span><p class="consent-clause-text">'+escape(clause.text)+'</p><details><summary>この項目の出典</summary>'+sourceLink(clause.sourceUrl)+(Array.isArray(clause.sourceLines)?'<p class="meta">元文書の抽出行：'+escape(clause.sourceLines.join('〜'))+'</p>':'')+'</details></li>').join('')+'</ol>'+(confirm?'<label class="check-label"><input type="checkbox" name="consent-group-'+index+'" data-consent-group="'+index+'" data-clause-ids="'+escape(group.clauses.map(clause=>clause.id).join(','))+'" required autocomplete="off"><span>このグループの全項目（'+escape(group.clauses.map(clause=>clause.id).join('、'))+'）を読み、同意します</span></label>':'')+'</fieldset>').join('')+(notes.length?'<aside><h4>原文に付随する注意書き</h4>'+list(notes)+'</aside>':'')+'<p>'+escape(document.closingText||'')+'</p></section>';
 }
 function evidence(event={}){
  const workflow=event.consentWorkflow;if(workflow?.version!==1)return '';
  const records=Array.isArray(workflow.records)?workflow.records:[];
  const receipt=event.tasks?.find(task=>task.id==='consent'),sharedReceipt=event.operationalProgress?.tasks?.find(task=>task.id==='consent');
  const receiptStatus=sharedReceipt?.status==='needs-review'?'共有画面での受領記録は再確認が必要':sharedReceipt?.status==='recorded'?'共有画面で受領を記録済み':receipt?.needsReview?'再受領確認が必要':receipt?.state==='done'?'受領を記録済み':receipt?.state==='submitted'?'申請者提出済み・運営の受領確認待ち':'未受領／受領記録なし';
  const correction=event.canRequestApplicantCorrection===true?'<details><summary>申請者に修正を依頼する</summary><p>対象と理由を記録します。申請者の画面に表示され、現在の条件に対する再確認が必要になります。メールの自動送信は行いません。</p><form data-correction-form><label>修正する内容<select name="taskId" required><option value="">選択してください</option><option value="screening">事前申請の内容</option><option value="hearing">詳細ヒアリング</option><option value="consent">最終利用同意</option></select></label><label>申請者に伝える修正理由<textarea name="reason" required maxlength="400" rows="3"></textarea></label><p data-correction-status role="status" aria-live="polite"></p><button type="submit">修正依頼を記録する</button><button type="button" data-consent-retry="correction" hidden>同じ依頼の結果を確認する</button></form></details>':'';
  const screening=workflow.screeningRecord;
  const screeningEvidence=screening?'<details><summary>事前申請時の確認記録（最終利用同意とは別）</summary><dl>'+row('入力された確認署名',screening.signature)+row('確認日',screening.signedDate)+row('受付日時',screening.receivedAt)+row('文書版',screening.document?.version)+row('文書ハッシュ',screening.document?.hash)+row('確認項目',(screening.acceptedClauseIds||[]).join('、'))+'</dl><p class="meta">この記録は事前申請時の確認です。最終利用同意や署名者の本人確認を示すものではありません。</p><details><summary>事前申請時の原文と条件</summary>'+conditionsSummary(screening.conditions||{})+contactSummary(screening.contact)+originalDocument(screening.document||{})+'</details></details>':'';
  const storedDoc=record=>{const candidates=[record.document,...Object.values(workflow.documents||{}),workflow.document];return candidates.find(document=>document?.version===record.documentVersion&&document?.hash===record.documentHash);};
  return '<details class="panel consent-evidence"><summary>同意の履歴・運営の受領記録'+(records.length?'（同意 '+records.length+'版）':'')+'</summary><p><strong>申請者の同意：</strong>'+(workflow.current?'現在の文書・条件に対する記録あり':'現在の文書・条件に対する記録なし')+'</p><p><strong>運営の受領確認：</strong>'+receiptStatus+'</p><p class="meta">本人が行った同意操作と、運営による書類の受領確認は別の記録です。入力された署名やログイン記録だけで、法的な署名の有効性や署名者本人を証明する表示ではありません。</p>'+(records.length?'<ol class="consent-record-history">'+records.slice().reverse().map((record,index)=>{const doc=storedDoc(record);return '<li><h4>同意記録 '+(records.length-index)+' '+(index===0&&workflow.current?'（現在の条件）':'（過去の条件）')+'</h4><dl>'+row('同意日時',record.agreedAt)+row('入力された署名',record.signature)+row('記録ID',record.id)+row('文書版',record.documentVersion)+row('文書ハッシュ',record.documentHash)+row('条件ハッシュ',record.conditionsHash)+row('確認した原文項目',(record.acceptedClauseIds||[]).join('、'))+row('認証方法（サーバー記録）',record.authentication?.method)+(record.authentication?.confirmation?.purpose==='final-consent'?row('同意直前のメール確認日時',record.authentication.confirmation.verifiedAt):'')+row('本人確認の記録',record.authentication?.identityVerified===true?'サーバー側の本人確認済み記録あり（署名の法的検証とは別）':record.authentication?.method==='verified-email-session'?'メール受信の確認あり。氏名の公的本人確認・法的署名検証は行っていません':'署名者の本人確認は記録されていません')+'</dl><details><summary>この同意時点の条件を見る</summary>'+conditionsSummary(record.conditions||{})+contactSummary(record.contact)+'</details><details><summary>この同意時点の原文・出典を見る</summary>'+(doc?originalDocument(doc):'<p>この版の原文データを表示できません。現在の文書を過去の同意文面として代用しません。文書版とハッシュを運営に確認してください。</p>')+'</details></li>';}).join('')+'</ol>':'<p>この画面での申請者の同意記録はまだありません。</p>')+screeningEvidence+correction+'</details>';
 }
 function inputField(key,field,value,event){
  let control;
  const attributes=' name="hearing-'+escape(key)+'" data-hearing-key="'+escape(key)+'"';
  if(['select','day','candidate'].includes(field.type)){
   const supplied=field.options||[{value:0,label:'当日'},{value:1,label:'翌日'}];
   const options=field.type==='candidate'?[{value:'',label:'選択してください'},...(event.schedule?.candidates||[]).map((candidate,index)=>({value:index,label:candidateLabel(candidate,index)}))]:field.type==='day'?supplied:[{value:'',label:'未回答・選択してください'},...supplied];
   control='<select'+attributes+'>'+options.map(option=>'<option value="'+escape(option.value)+'"'+(String(option.value)===String(value??'')?' selected':'')+'>'+escape(option.label)+'</option>').join('')+'</select>';
  }else if(field.type==='textarea')control='<textarea'+attributes+' rows="3" maxlength="'+(field.maxLength||1000)+'">'+escape(value)+'</textarea>';
  else control='<input'+attributes+' type="'+(field.type==='time'?'time':key.toLowerCase().includes('phone')?'tel':'text')+'" maxlength="'+(field.maxLength||500)+'" value="'+escape(value)+'">';
  return '<label data-hearing-field="'+escape(key)+'">'+escape(field.label)+(field.requirement==='core'?'（提出前に必要）':'')+control+(field.help?'<small>'+escape(field.help)+'</small>':'')+'</label>';
 }
 function equipmentRow(item={},index=0){
  const catalog=schema()?.HEARING_EQUIPMENT_CATALOG||[];
  return '<fieldset data-hearing-equipment-row="'+index+'"><legend>機材 '+(index+1)+'</legend><label>機材<select data-equipment-key="itemId"><option value="">選択してください</option>'+catalog.map(entry=>'<option value="'+escape(entry.id)+'"'+(item.itemId===entry.id?' selected':'')+'>'+escape(entry.label)+'</option>').join('')+'</select></label><label data-equipment-other>その他の機材名<input data-equipment-key="otherName" maxlength="120" value="'+escape(item.otherName)+'"></label><label>数量<input data-equipment-key="quantity" type="number" min="1" max="999" step="1" inputmode="numeric" value="'+escape(item.quantity??'1')+'"></label><label>用意する人<select data-equipment-key="provider"><option value="">選択してください</option><option value="facility"'+(item.provider==='facility'?' selected':'')+'>会場へ事前申請</option><option value="organizer"'+(item.provider==='organizer'?' selected':'')+'>主催者が持ち込む</option></select></label><button type="button" data-hearing-remove-equipment>この機材を削除</button></fieldset>';
 }
 function hearingFields(event){
  const hearing=schema()?.hearingForEvent?.(event)||event.hearing||{},fields=schema()?.HEARING_FIELDS||{},groups=[];
  for(const [key,field] of Object.entries(fields)){let group=groups.find(entry=>entry.title===field.group);if(!group){group={title:field.group||'詳細ヒアリング',fields:[]};groups.push(group);}group.fields.push(inputField(key,field,hearing[key],event));}
  return '<details><summary>ヒアリング項目の出典と確認範囲</summary><p>'+escape(schema()?.HEARING_SOURCE?.note||'項目の出典を確認してください。')+'</p>'+'</details><p class="meta">企画・参加条件・日時・プログラムは既存の回答を使います。ここには当日の進め方と不足している情報だけを入力します。保存は同意や開催承認を意味しません。</p>'+groups.map(group=>'<fieldset><legend>'+escape(group.title)+'</legend><div class="fields">'+group.fields.join('')+'</div></fieldset>').join('')+'<section data-hearing-equipment><h4>機材の事前申請・持込</h4><p>機材名・数量・用意する人を記入してください。記入だけでは貸出確定になりません。</p><div data-hearing-equipment-rows>'+(hearing.equipment||[]).map(equipmentRow).join('')+'</div><button type="button" data-hearing-add-equipment>機材を追加する</button></section>';
 }
 // Presentation only: saving details, submitting them, and agreeing to terms are separate actions.
 function hearingAction(event={}){
  const task=event.tasks?.find(item=>item.id==='hearing');if(!task)return null;
  if(task.request||task.needsReview===true)return {state:'revision',title:'詳細の修正・再提出内容を確認する',next:'あなた：差戻し内容や変更箇所を確認し、必要な修正を保存してから、詳細を再提出してください。',owner:'あなた',open:'保存済みの詳細を確認・修正する',submit:'詳細を再提出して確認を依頼'};
  if(task.state==='submitted')return {state:'waiting',title:'詳細は提出済み・運営の受領確認待ち',next:'運営：提出された詳細を確認します。あなたは、修正依頼が届いた場合に対応してください。',owner:'運営',open:'提出した詳細を確認する',submit:null};
  if(task.state==='done')return {state:'done',title:'詳細の受領確認は完了しています',next:'運営：同意の受領確認と開催判断を進めます。開催確定は承認通知の後です。',owner:'運営',open:'詳細を確認する',submit:null};
  const missing=event.consentWorkflow?.missingHearing;
  if(!Array.isArray(missing))return {state:'unknown',title:'詳細の入力・保存状況を確認する',next:'あなた：最新状態を読み直し、詳細の不足項目と保存状況を確認してください。',owner:'あなた',open:'詳細を確認する',submit:'入力を保存したら提出'};
  if(missing.length)return {state:'incomplete',title:'当日の詳しい内容を入力する',next:'あなた：下の不足項目を入力・確認して保存し、詳細を提出してください。',owner:'あなた',open:'詳細を入力する',submit:'入力を保存したら提出'};
  return {state:'ready',title:'保存済みの詳細を確認して提出する',next:'あなた：詳細に必要な項目は保存されています。内容を確認して「詳細を提出して確認を依頼」を押してください。保存だけでは運営への提出は完了しません。',owner:'あなた',open:'保存済みの詳細を確認する',submit:'詳細を提出して確認を依頼'};
 }
 function hearingFocus(event,task){
  const action=hearingAction(event);if(!action)return '';
  return '<section class="panel focus-panel" aria-label="あなたの次の対応"><p class="eyebrow">次に進むための対応</p><h2>'+escape(action.title)+'</h2><p>'+escape(action.next)+'</p>'+(task.request?'<p class="request">'+escape(task.request)+'</p>':'')+'<dl class="action-ownership"><dt>担当</dt><dd>'+escape(action.owner)+'</dd><dt>期限</dt><dd>'+escape(task.due||'未設定')+'</dd></dl><div class="actions"><button type="button" class="primary" data-open-details>'+escape(action.open)+'</button>'+(action.submit?'<button type="button" data-action="submit-task" data-id="hearing">'+escape(action.submit)+'</button>':'')+'</div>'+(event.consentWorkflow?.current?'<p class="meta">今回の条件への最終同意は記録済みです。詳細の提出とは別に記録されています。条件を変えずに詳細を提出する場合、再同意は不要です。</p>':'<p class="meta">詳細の保存・提出と最終利用同意は別の手続きです。提出後は運営の確認を待ちます。</p>')+'</section>';
 }
 function readiness(event={}){
  const workflow=event.consentWorkflow||{},screening=event.tasks?.find(task=>task.id==='screening');
  if(event.outcome&&event.outcome!=='active')return {ready:false,title:'この申請の受付は終了しています',next:'状況の確認が必要な場合は、運営へお問い合わせください。'};
  const preliminary=typeof event.canProvideOperationalDetails==='boolean'?event.canProvideOperationalDetails:screening?screening.state==='done'&&!screening.needsReview:null;
  if(preliminary===false)return {ready:false,title:screening?.request?'申請内容の修正・事前確認待ち':'運営の事前確認待ち',next:screening?.request?'あなた：表示された差戻し内容を修正して再提出してください。その後、運営が事前確認を行います。':'運営：申請内容を事前確認します。確認が完了すると、あなたが詳細を確定し、最終同意へ進めます。'};
  if(preliminary===null)return {ready:false,title:'事前確認の状況を確認してください',next:'最新状態を再読み込みしてください。状況を確認できない場合は運営へお問い合わせください。'};
  if(workflow.missingHearing?.length)return {ready:false,title:'あなたの詳細入力・確認待ち',next:'あなた：下の不足項目を入力・確認して保存してください。詳細がそろうと、今回の条件への最終同意に進めます。'};
  if(event.canAgreeConsent!==true)return {ready:false,title:'本人確認の状態を確認してください',next:'あなた：登録メールの確認コードで申請を開き直してください。確認済みでも進めない場合は運営へお問い合わせください。'};
  if(workflow.current){const hearing=hearingAction(event);return {ready:true,title:'今回の条件への最終同意は記録済みです',next:hearing&&hearing.state!=='done'?hearing.next+' 最終同意と詳細の提出は別の記録です。条件を変えずに詳細を提出する場合、再同意は不要です。':'運営：詳細と同意の受領確認、開催判断を進めます。開催確定は承認通知の後です。'};}
  return {ready:true,title:workflow.records?.length?'変更後の条件への再同意待ち':'あなたの最終同意待ち',next:'あなた：現在の原文30項目と今回の条件を読み、同意専用コード・署名で同意してください。運営の受領確認と開催承認は、その後の別手続きです。'};
 }
 function readinessNotice(event){const state=readiness(event);return '<section data-consent-readiness role="status"><h3>'+escape(state.title)+'</h3><p>'+escape(state.next)+'</p></section>';}
 function operationError(error,event){
  if(error.code==='OTP_DISABLED')return '確認コード機能を利用できません。運営へ確認してください。';
  if(['UNAUTHENTICATED','AUTHENTICATION_REQUIRED','SESSION_EXPIRED'].includes(error.code))return '本人確認の期限または状態を確認できません。登録メールの確認コードで申請を開き直してください。';
  if(error.code==='FORBIDDEN')return 'この操作の権限を確認できません。最新状態を読み直し、進めない場合は運営へお問い合わせください。';
  if(['VALIDATION','HEARING_INCOMPLETE','WORKFLOW_DISABLED'].includes(error.code)){const state=readiness(event);return !state.ready?state.title+'。'+state.next:'入力内容または業務上の前提条件を確認してください。最新状態を読み直し、必要な項目を確認してください。';}
  if(error.code==='CLOSED')return 'この申請は現在更新できません。最新の受付状況を確認してください。';
  return 'この操作は記録されませんでした。入力内容を確認し、進めない場合は運営へお問い合わせください。';
 }
 function render(event={},options={}){
  const workflow=event.consentWorkflow;if(workflow?.version!==1)return '';
  const applicant=options.applicant===true,canEdit=event.canEditHearing===true,canAgree=applicant&&readiness(event).ready;
  const explanation=workflow.explanation;
  const explanationStatus='<p><strong>必要に応じた個別説明の記録：</strong>'+(explanation?escape(explanation.comment||'記録あり')+'<span class="meta"> ／ '+escape(explanation.recordedAt||explanation.explainedAt||explanation.at||'日時未記録')+'</span>':'個別説明の記録はありません。事前確認と詳細入力が完了したら、サイトで原文と条件を読み、同意できます。')+'</p>';
  const explanationForm=!applicant&&event.canExplainConditions===true?'<details data-explanation-panel><summary>利用条件を説明した事実を記録する</summary><p>申請者へ現在の文書・条件を説明してから記録してください。この操作は申請者の同意や署名を作成しません。</p><form data-explanation-form><label>説明した内容・方法<textarea name="comment" required maxlength="1000" rows="3"></textarea></label><p data-explanation-status role="status" aria-live="polite"></p><button type="submit">説明の実施を記録する</button><button type="button" data-consent-retry="explanation" hidden>同じ記録の結果を確認する</button></form></details>':'';
  return '<section class="panel consent-flow" data-consent-flow data-event-id="'+escape(event.id)+'"><h2>詳細ヒアリングと最終利用同意</h2><p>申請時の基本規約の確認と、詳細確定後の最終利用同意は別の手続きです。運営の事前確認 → 詳細の保存 → 原文30項目と今回の条件の確認 → 同意専用コード・署名による最終同意 → 運営の受領確認・開催判断の順に進みます。個別説明は必要な場合に行います。開催確定は承認通知の後です。</p>'+(applicant?readinessNotice(event):'')+'<p class="meta">不明点は同意前に運営へご相談ください。</p>'+(workflow.contactCheckRequired?'<p class="request">連絡先が変更されています。運営による連絡先の確認が必要です。</p>'+(!applicant&&event.canConfirmContact===true?'<form data-contact-form><p>現在の連絡先を確認してから記録してください。本人認証や同意を行う操作ではありません。</p><p data-contact-status role="status" aria-live="polite"></p><button type="submit">連絡先を確認済みにする</button><button type="button" data-consent-retry="contact" hidden>同じ確認の結果を確認する</button></form>':''):'')+'<details data-hearing-panel><summary>当日の詳細ヒアリングを'+(canEdit?'入力・確認する':'確認する')+'</summary>'+(canEdit&&schema()?'<form data-hearing-form novalidate>'+hearingFields(event)+'<p data-hearing-status role="status" aria-live="polite"></p><button class="primary" type="submit">詳細を保存する</button><button type="button" data-consent-retry="hearing" hidden>同じ保存の結果を確認する</button></form>':hearingSummary(event.hearing||{}))+'</details>'+(workflow.missingHearing?.length?'<details open><summary>提出・同意の前に必要な確認</summary>'+list(workflow.missingHearing)+'</details>':'')+explanationStatus+(explanation?'<details><summary>説明記録の対象版・条件</summary><dl>'+row('文書版',explanation.documentVersion)+row('文書ハッシュ',explanation.documentHash)+row('条件ハッシュ',explanation.conditionsHash)+'</dl><p class="meta">これは当時の説明記録です。文書や条件を変更した場合は、変更後の内容を確認して再同意します。個別説明は必要に応じて行います。</p></details>':'')+explanationForm+'<p data-consent-current>'+(workflow.current?'現在の原文・条件に対する同意が記録されています。':workflow.records?.length?'条件または文書の変更後の同意が必要です。以前の同意は履歴に残っています。':'最終利用同意はまだ記録されていません。')+'</p>'+(canAgree?'<button type="button" class="primary" data-consent-start>'+ (workflow.current?'原文・条件をもう一度確認する':'原文・条件を確認して同意へ進む')+'</button>':applicant?'<p class="meta">上に表示された担当者と次の対応を確認してください。原文と現在の条件は下から読めます。</p>':'<p class="meta">運営画面から申請者の署名や同意を代行することはできません。</p>')+(!canAgree?'<details data-consent-reference><summary>現在の同意書の原文と条件を読む</summary>'+conditionsSummary({common:event.common,schedule:event.schedule,reviewContext:event.reviewContext,hearing:event.hearing})+originalDocument(workflow.document)+'</details>':'')+'<p data-consent-status role="status" aria-live="polite"></p><section data-consent-review hidden tabindex="-1"></section>'+evidence(event)+'</section>';
 }
 function validReview(review,eventId){
  const document=review?.document,clauses=document?.clauses;
  return review?.eventId===eventId&&Number.isInteger(review.eventVersion)&&review.eventVersion>0&&present(review.conditionsHash)&&review.conditions&&typeof review.conditions==='object'&&!Array.isArray(review.conditions)&&present(document?.version)&&present(document?.hash)&&present(document?.fullText)&&Array.isArray(clauses)&&clauses.length===30&&clauses.every(clause=>present(clause.id)&&present(clause.group)&&present(clause.text))&&new Set(clauses.map(clause=>clause.id)).size===clauses.length&&Array.isArray(review.missingHearing);
 }
 function bind(container,event,options={}){
  const box=container?.matches?.('[data-consent-flow]')?container:container?.querySelector('[data-consent-flow]');
  if(!box)return null;if(box._consentController)return box._consentController;
  let readFeedback=null,codeFeedback=null,writeFeedback=null;
  let active=true,writing=false,reading=false,review=null,stale=false,hearingConflict=false,pending=null,generation=0;
  const otpRequired=typeof options.onRequestConsentCode==='function';let requestingCode=false,consentChallenge=null,nextCodeAt=0,codeTimer=null,resendTimer=null;
  const status=box.querySelector('[data-consent-status]'),panel=box.querySelector('[data-consent-review]'),hearingForm=box.querySelector('[data-hearing-form]'),explanationForm=box.querySelector('[data-explanation-form]'),correctionForm=box.querySelector('[data-correction-form]'),contactForm=box.querySelector('[data-contact-form]');
  const notify=text=>{status.textContent=text;};
  const fail=(text,code='VALIDATION')=>Object.assign(new Error(text),{code});
  const setPending=value=>{pending=value;options.onPendingChange?.(Boolean(value));};
  const markSaved=form=>{if(form)root.GarrawayUx?.markSaved(form,root.GarrawayUx.capture(form));};
  const lock=()=>{box.querySelectorAll('button,input,textarea,select').forEach(control=>{const retry=control.matches('[data-consent-retry]');const disabled=writing||reading||requestingCode||Boolean(pending)&&!retry||stale&&control.matches('[data-consent-submit],[data-consent-request-code]')||otpRequired&&!consentChallenge&&control.matches('[data-consent-group],[data-consent-attested],[data-consent-signature],[data-consent-code],[data-consent-submit]')||otpRequired&&Date.now()<nextCodeAt&&control.matches('[data-consent-request-code]')||hearingConflict&&control.matches('[data-hearing-form] button[type=submit],[data-explanation-form] button[type=submit],[data-correction-form] button[type=submit],[data-contact-form] button[type=submit]');if(disabled){if(!control.hasAttribute('data-consent-disabled'))control.dataset.consentDisabled=control.disabled?'1':'0';control.disabled=true;}else if(control.hasAttribute('data-consent-disabled')){control.disabled=control.dataset.consentDisabled==='1';delete control.dataset.consentDisabled;}});};
  const clearAffirmation=()=>{panel.querySelectorAll('input[type=checkbox]').forEach(input=>{input.checked=false;});};
  const clearCode=()=>{consentChallenge=null;clearTimeout(codeTimer);const input=panel.querySelector('[data-consent-code]');if(input)input.value='';};
  const close=()=>{if(writing||pending||requestingCode)return;readFeedback?.cancel();generation++;clearCode();clearTimeout(resendTimer);review=null;stale=false;panel.querySelector('form')?.reset();markSaved(panel.querySelector('form'));panel.replaceChildren();panel.hidden=true;notify('');box.querySelector('[data-consent-start]')?.focus();};
  async function openReview(){
   if(writing||pending||reading||requestingCode||!box.querySelector('[data-consent-start]'))return;clearCode();const token=++generation;reading=true;lock();notify('同意書の原文と現在の条件を読み込んでいます…');const activity=readFeedback=root.GarrawayAsyncFeedback?.begin(status.textContent,{buttons:[box.querySelector('[data-consent-start]'),panel.querySelector('[data-consent-reload]')]});
   try{const result=await options.onReview?.({id:event.id});if(!active||token!==generation)return;if(!validReview(result,event.id))throw fail('原文30項目と条件の版を確認できません。運営に確認してください。','INVALID_REVIEW');review=clone(result);stale=false;
    panel.innerHTML='<h3>同意前の最終確認</h3><p>最後のボタンを押すと、下の文書・条件と確認項目、入力署名、同意日時を運営側に保存します。入力された署名の法的な有効性をこの画面で検証するものではありません。</p>'+conditionsSummary(review.conditions)+contactSummary(review.contact)+'<p class="meta">対象イベント版：'+review.eventVersion+' ／ 文書ハッシュ：'+escape(review.document.hash)+' ／ 条件ハッシュ：'+escape(review.conditionsHash)+'</p>'+(review.missingHearing.length?'<p class="request">同意前に次の情報を保存してください。</p>'+list(review.missingHearing):'')+(otpRequired?'<section data-consent-otp><p>原文の全30項目と今回の条件を下で確認し、同意専用の新しいコードを依頼してください。ログイン用のコードは使えません。コードの依頼だけでは同意は記録されません。</p><button type="button" data-consent-request-code>この原文と条件を確認し、同意用コードを送る</button><p data-consent-code-status role="status" aria-live="polite"></p></section>':'')+'<form data-consent-form>'+originalDocument(review.document,{confirm:true})+(otpRequired?'<label>同意用の8桁の確認コード<input name="consentCode" data-consent-code type="text" inputmode="numeric" pattern="[0-9]{8}" minlength="8" maxlength="8" autocomplete="off" required></label><p class="meta">通常1〜2分で届きます。有効期間は10分、1回限りです。届かないときは60秒後から再送できます。</p>':'')+'<label>内容を確認した申請者の署名<input name="signature" data-consent-signature maxlength="120" required autocomplete="off" value=""></label><label class="check-label"><input type="checkbox" data-consent-attested required autocomplete="off"><span>表示された原文の全30項目と今回の条件を確認し、私自身の意思で同意を記録します</span></label><p data-consent-form-status role="status" aria-live="polite"></p><div class="actions"><button class="primary" type="submit" data-consent-submit'+(review.missingHearing.length?' disabled':'')+'>この原文と条件に同意して記録する</button><button type="button" data-consent-retry="agreement" hidden>同じ同意操作の結果を確認する</button><button type="button" data-consent-reload hidden>最新の原文と条件を読み直す</button><button type="button" data-consent-close>閉じる</button></div></form>';
    panel.hidden=false;if(otpRequired){panel.querySelector('[data-consent-request-code]').onclick=requestConsentCode;scheduleResend();}const form=panel.querySelector('form');form.onsubmit=submitConsent;panel.querySelector('[data-consent-close]').onclick=close;panel.querySelector('[data-consent-reload]').onclick=openReview;panel.querySelector('[data-consent-retry]').onclick=()=>write(pending);root.GarrawayUx?.register(form);notify('原文と条件を確認し、各グループへの同意と署名を入力してください。');panel.focus();activity?.finish('success','同意書の原文と現在の条件を読み込みました。同意はまだ記録していません。');
   }catch(error){if(active&&token===generation){notify('読み込めませんでした：'+(error.message||'接続を確認してください。'));activity?.finish('error',status.textContent);}}finally{activity?.cancel();reading=false;if(active)lock();}
  }
  function scheduleResend(){
   clearTimeout(resendTimer);if(!active)return;const button=panel.querySelector('[data-consent-request-code]');if(!button)return;
   const remaining=Math.max(0,Math.ceil((nextCodeAt-Date.now())/1000));button.textContent=remaining?'同意用コードの再送まで '+remaining+'秒':'この原文と条件を確認し、同意用コードを送る';lock();if(remaining)resendTimer=setTimeout(scheduleResend,1000);
  }
  async function requestConsentCode(){
   if(!active||!otpRequired||!review||stale||writing||pending||reading||requestingCode||Date.now()<nextCodeAt)return;
   const token=generation;requestingCode=true;clearCode();clearAffirmation();const signature=panel.querySelector('[data-consent-signature]');if(signature)signature.value='';nextCodeAt=Date.now()+60000;scheduleResend();lock();
   const output=panel.querySelector('[data-consent-code-status]');output.textContent='この版の原文と条件に対応するコードを依頼しています…';const activity=codeFeedback=root.GarrawayAsyncFeedback?.begin(output.textContent,{buttons:[panel.querySelector('[data-consent-request-code]')],slow:'同意用コードの依頼結果を待っています。再送可能になるまでお待ちください。'});
   try{const result=await options.onRequestConsentCode({eventVersion:review.eventVersion,documentVersion:review.document.version,documentHash:review.document.hash,conditionsHash:review.conditionsHash});
    if(!active||token!==generation)return;
    if(typeof result?.challengeId!=='string'||!/^[a-f0-9]{64}$/.test(result.challengeId)||!Number.isInteger(result.expiresInSeconds)||result.expiresInSeconds<=0||result.expiresInSeconds>600||!Number.isInteger(result.resendAfterSeconds)||result.resendAfterSeconds<60||result.resendAfterSeconds>600)throw fail('コードの依頼結果を確認できません。','OTP_UNAVAILABLE');
    consentChallenge={id:result.challengeId,expiresAt:Date.now()+result.expiresInSeconds*1000};nextCodeAt=Math.max(nextCodeAt,Date.now()+result.resendAfterSeconds*1000);
    output.textContent='入力内容が登録情報と一致し、送信できる場合に確認コードが届きます。届いた同意用コードを入力し、各グループ・署名・最後の同意をあらためて確認してください。';activity?.finish('success','確認コードの依頼を受け付けました。入力内容が登録情報と一致し、送信できる場合に確認コードが届きます。同意はまだ記録していません。');
    codeTimer=setTimeout(()=>{if(active&&token===generation){clearCode();clearAffirmation();output.textContent='コードの有効期間が終了しました。新しいコードを依頼してください。';lock();}},result.expiresInSeconds*1000);
   }catch(error){if(!active||token!==generation)return;if(['OTP_STALE','VERSION_CONFLICT','DOCUMENT_CONFLICT','CONSENT_CONFLICT','CONSENT_STALE','CONDITIONS_CONFLICT'].includes(error.code)){stale=true;review=null;clearAffirmation();panel.querySelector('[data-consent-reload]').hidden=false;output.textContent='原文または条件が更新されました。最新の内容を読み直してください。';}else if(['UNAUTHENTICATED','AUTHENTICATION_REQUIRED','SESSION_EXPIRED','OTP_DISABLED','FORBIDDEN','VALIDATION','HEARING_INCOMPLETE','WORKFLOW_DISABLED','CLOSED'].includes(error.code))output.textContent=operationError(error,event);else output.textContent='コードの依頼結果を確認できません。再送可能になったら、同じ条件で依頼し直してください。';activity?.finish(stale?'error':'unknown',output.textContent);}
   finally{activity?.cancel();requestingCode=false;if(active){scheduleResend();lock();}}
  }
  function collectHearing(){
   const value=clone(schema()?.hearingForEvent?.(event)||event.hearing||{});
   hearingForm?.querySelectorAll('[data-hearing-key]').forEach(input=>{const key=input.dataset.hearingKey,type=schema()?.HEARING_FIELDS?.[key]?.type;value[key]=['day','candidate'].includes(type)&&input.value!==''?Number(input.value):input.value;});
   value.equipment=[...(hearingForm?.querySelectorAll('[data-hearing-equipment-row]')||[])].map(row=>Object.fromEntries([...row.querySelectorAll('[data-equipment-key]')].map(input=>[input.dataset.equipmentKey,input.value])));
   return value;
  }
  async function submitConsent(action){
   action.preventDefault();if(writing||pending||stale||!review||requestingCode)return;
   if(otpRequired&&(!consentChallenge||consentChallenge.expiresAt<=Date.now())){clearCode();clearAffirmation();lock();notify('この原文と条件に対応する新しい同意用コードを依頼してください。');return;}
   const form=action.currentTarget;if(!form.reportValidity())return;
   const groups=groupClauses(review.document),checked=[...form.querySelectorAll('[data-consent-group]')];
   if(checked.length!==groups.length||!checked.every(input=>input.checked)||!form.querySelector('[data-consent-attested]').checked||review.missingHearing.length)return;
   const signature=form.querySelector('[data-consent-signature]').value.trim();if(!signature){notify('内容を確認した申請者の署名を入力してください。');return;}
   const acceptedClauseIds=groups.flatMap(group=>group.clauses.map(clause=>clause.id));
   const command={id:event.id,key:options.createKey?.()||root.crypto.randomUUID(),expectedVersion:review.eventVersion,documentVersion:review.document.version,documentHash:review.document.hash,conditionsHash:review.conditionsHash,acceptedClauseIds,signature,attested:true};
   let proof;if(otpRequired){const input=form.querySelector('[data-consent-code]');if(!/^\d{8}$/.test(input.value))return;proof={challengeId:consentChallenge.id,code:input.value};input.value='';}
   await write({kind:'agreement',command:clone(command),...(proof?{proof}:{}),form});
  }
  const definiteErrors=new Set(['VALIDATION','FORBIDDEN','NOT_FOUND','CLOSED','UNAUTHENTICATED','SESSION_EXPIRED','OTP_DISABLED','CAPACITY','IDEMPOTENCY_CONFLICT','NOT_CONNECTED','BUSY','UNSAVED_INPUT','AUTHENTICATION_REQUIRED','WORKFLOW_DISABLED','HEARING_INCOMPLETE']);
  async function write(operation){
   if(!active||writing||!operation)return;writing=true;options.onBusyChange?.(true);lock();const output=operation.kind==='hearing'?box.querySelector('[data-hearing-status]'):operation.kind==='explanation'?box.querySelector('[data-explanation-status]'):operation.kind==='correction'?box.querySelector('[data-correction-status]'):operation.kind==='contact'?box.querySelector('[data-contact-status]'):panel.querySelector('[data-consent-form-status]');if(output)output.textContent='記録しています。このままお待ちください。';const activity=writeFeedback=root.GarrawayAsyncFeedback?.begin('入力した内容の記録結果を確認しています…',{priority:2,buttons:[...operation.form.querySelectorAll('button')],slow:'記録結果を確認中です。入力を保持しています。同じボタンを押さずにお待ちください。'});
   try{
    const callback=operation.kind==='hearing'?options.onSaveHearing:operation.kind==='explanation'?options.onExplain:operation.kind==='correction'?options.onRequestCorrection:operation.kind==='contact'?options.onConfirmContact:options.onAgree;
    if(typeof callback!=='function')throw fail('保存先が接続されていません。','NOT_CONNECTED');
    const result=await callback(clone(operation.command),operation.proof?clone(operation.proof):undefined);if(!active)return;
    if(!result||!Number.isInteger(result.version)||result.id!==event.id)throw fail('保存結果を確認できません。','OUTCOME_UNKNOWN');
    setPending(null);markSaved(operation.form);event.version=result.version;
    if(operation.kind==='agreement'){clearCode();clearAffirmation();operation.form.querySelector('[data-consent-signature]').value='';markSaved(operation.form);review=null;stale=true;notify('申請者の同意を記録しました。運営の受領確認と開催判断は別に行われます。');if(output)output.textContent='同意記録を保存しました。';}
    else if(operation.kind==='hearing'){event.hearing=clone(operation.command.hearing);if(output)output.textContent='詳細を保存しました。同意はまだ行っていません。';}
    else if(operation.kind==='explanation'){if(output)output.textContent='説明の実施を記録しました。申請者の同意は別に行います。';}
    else if(operation.kind==='correction'){if(output)output.textContent='修正依頼を記録しました。メールは送信していません。';}
    else{if(output)output.textContent='連絡先を確認した記録を保存しました。本人認証の記録ではありません。';}
    activity?.finish('success',output?.textContent||'記録を保存しました。');writing=false;options.onBusyChange?.(false);lock();
    try{await options.onSaved?.(result,operation.kind);}catch{notify('記録は保存されました。最新の表示を取得できないため、再読み込みしてください。');root.GarrawayAsyncFeedback?.notice('unknown',status.textContent);}
   }catch(error){if(!active)return;
    const conflict=['OTP_STALE','VERSION_CONFLICT','DOCUMENT_CONFLICT','CONSENT_CONFLICT','CONSENT_STALE','CONDITIONS_CONFLICT'].includes(error.code);
    if(conflict){setPending(null);stale=true;review=null;clearCode();clearAffirmation();if(output)output.textContent='条件または文書が更新されました。入力内容は残しています。最新の内容を読み直して、あらためて確認してください。';panel.querySelector('[data-consent-reload]')?.removeAttribute('hidden');if(operation.kind!=='agreement'){hearingConflict=true;options.onConflict?.(error);}}
    else if(otpRequired&&operation.kind==='agreement'&&['OTP_INVALID'].includes(error.code)){setPending(null);clearCode();clearAffirmation();if(output)output.textContent='同意を確認できませんでした。新しい同意用コードで、各項目をあらためて確認してください。';}
    else if(definiteErrors.has(error.code)){setPending(null);if(output)output.textContent=operationError(error,event)+' 入力内容は残しています。';}
    else{setPending(operation);if(output)output.textContent='保存結果を確認できません。入力内容は保持しています。「同じ操作の結果を確認する」で、同じ操作として確認してください。';box.querySelector('[data-consent-retry="'+operation.kind+'"]')?.removeAttribute('hidden');}
    activity?.finish(pending?'unknown':'error',output?.textContent||'記録結果を確認できません。');
   }finally{activity?.cancel();writing=false;if(active){lock();options.onBusyChange?.(false);}}
  }
  function updateHearingVisibility(){
   if(!hearingForm)return;const values=collectHearing();
   for(const [key,field] of Object.entries(schema()?.HEARING_FIELDS||{})){const condition=field.visibleWhen;if(condition){const input=hearingForm.querySelector('[data-hearing-field="'+key+'"]');if(input)input.hidden=!condition.values.map(String).includes(String(values[condition.field]));}}
   const equipment=hearingForm.querySelector('[data-hearing-equipment]');if(equipment)equipment.hidden=!['requested','undecided'].includes(values.equipmentPlan)&&!values.equipment.length;
   hearingForm.querySelectorAll('[data-hearing-equipment-row]').forEach(row=>{row.querySelector('[data-equipment-other]').hidden=row.querySelector('[data-equipment-key=itemId]').value!=='other';});
  }
  box.querySelector('[data-consent-start]')?.addEventListener('click',openReview);
  if(hearingForm){
   hearingForm.onsubmit=async action=>{action.preventDefault();if(writing||pending||hearingConflict)return;const hearing=collectHearing(),checked=schema()?.validateHearing?.(hearing,{event});if(checked?.issues?.length){box.querySelector('[data-hearing-status]').textContent=checked.issues.join('。');return;}await write({kind:'hearing',command:{id:event.id,key:options.createKey?.()||root.crypto.randomUUID(),expectedVersion:event.version,hearing:checked?.value||hearing},form:hearingForm});};
   const add=hearingForm.querySelector('[data-hearing-add-equipment]');if(add)add.onclick=()=>{const rows=hearingForm.querySelector('[data-hearing-equipment-rows]');rows.insertAdjacentHTML('beforeend',equipmentRow({},rows.children.length));updateHearingVisibility();rows.lastElementChild.querySelector('select').focus();};
   hearingForm.addEventListener('click',action=>{if(action.target.matches('[data-hearing-remove-equipment]')){action.target.closest('[data-hearing-equipment-row]').remove();updateHearingVisibility();}});
   hearingForm.addEventListener('change',updateHearingVisibility);hearingForm.querySelector('[data-consent-retry]').onclick=()=>write(pending);updateHearingVisibility();
  }
  if(explanationForm){explanationForm.onsubmit=async action=>{action.preventDefault();if(writing||pending||hearingConflict||!explanationForm.reportValidity())return;const comment=explanationForm.elements.namedItem('comment').value.trim();if(!comment)return;await write({kind:'explanation',command:{id:event.id,key:options.createKey?.()||root.crypto.randomUUID(),expectedVersion:event.version,comment},form:explanationForm});};explanationForm.querySelector('[data-consent-retry]').onclick=()=>write(pending);}
  if(correctionForm){correctionForm.onsubmit=async action=>{action.preventDefault();if(writing||pending||hearingConflict||!correctionForm.reportValidity())return;const reason=correctionForm.elements.namedItem('reason').value.trim(),taskId=correctionForm.elements.namedItem('taskId').value;if(!reason||!['screening','hearing','consent'].includes(taskId))return;await write({kind:'correction',command:{id:event.id,key:options.createKey?.()||root.crypto.randomUUID(),expectedVersion:event.version,taskId,reason},form:correctionForm});};correctionForm.querySelector('[data-consent-retry]').onclick=()=>write(pending);}
  if(contactForm){contactForm.onsubmit=async action=>{action.preventDefault();if(writing||pending||hearingConflict)return;await write({kind:'contact',command:{id:event.id,key:options.createKey?.()||root.crypto.randomUUID(),expectedVersion:event.version},form:contactForm});};contactForm.querySelector('[data-consent-retry]').onclick=()=>write(pending);}
  const controller={openReview,close,collectHearing,hasUnresolved:()=>writing||Boolean(pending),isBusy:()=>writing||reading||requestingCode,dispose:()=>{readFeedback?.cancel();codeFeedback?.cancel();writeFeedback?.cancel();active=false;generation++;clearCode();clearTimeout(resendTimer);clearAffirmation();pending=null;review=null;},clearAffirmation};box._consentController=controller;return controller;
 }
 root.GarrawayConsent={render,bind,evidence,conditionsSummary,originalDocument,hearingSummary,validReview,readiness,readinessNotice,hearingAction,hearingFocus};
})(window);
;
(function(root){
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const sources={
  sales:{groupIndex:0,itemIndex:1,text:'GarrawayFは商業的顧客サービス施設ではないことを理解しています',explanation:'この条項は販売・勧誘の一律禁止を定めたものではありません。内容を運営へ確認するための案内です。'},
  time:{groupIndex:0,itemIndex:3,text:'申請した利用時間を「約束」として守り、終了時刻までに原状回復・完全退館を完了することに同意します',explanation:'イベント終了と完全撤収の前後関係を確認します。施設の利用可否や最低撤収時間を決めるものではありません。'}
 };
 function minutes(time,day){
  if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||(day!==0&&day!==1))return null;
  return Number(time.slice(0,2))*60+Number(time.slice(3))+day*1440;
 }
 function evaluate(data={}){
  const notices=[];
  if(['sales','solicitation','both'].includes(data?.reviewContext?.sales))notices.push({id:'sales-consult',level:'consult',title:'要相談',reason:'販売・勧誘の内容を運営へ確認してください',fix:'販売・勧誘の補足に内容を記入',field:'sales',source:{...sources.sales}});
  const candidates=Array.isArray(data?.schedule?.candidates)?data.schedule.candidates:[];
  candidates.forEach((candidate,index)=>{
   if(candidate?.undecided!==false)return;
   const end=minutes(candidate.eventEnd,candidate.eventEndDay),clear=minutes(candidate.clearEnd,candidate.clearEndDay);
   if(end===null||clear===null||clear>=end)return;
   notices.push({id:'clear-before-end-'+index,level:'check',title:'時刻の確認',reason:'第'+(index+1)+'希望の完全撤収がイベント終了より早くなっています',fix:'撤収時刻をイベント終了以降に',field:'clearEnd',candidateIndex:index,source:{...sources.time}});
  });
  return notices;
 }
 function render(data={}){
  const notices=evaluate(data);
  if(!notices.length)return '<p class="meta admission-neutral">利用可否は運営が確認します。</p>';
  return `<section class="admission-notices" role="status" aria-live="polite" aria-label="入力内容の確認">${notices.map(notice=>`<article class="admission-notice" data-notice-id="${esc(notice.id)}" data-notice-level="${esc(notice.level)}" data-notice-field="${esc(notice.field)}"${notice.candidateIndex===undefined?'':` data-notice-candidate="${esc(notice.candidateIndex)}"`}><h3>${esc(notice.title)}</h3><p>${esc(notice.reason)}</p><p class="admission-fix">${esc(notice.fix)}</p><details><summary>根拠を見る</summary><p>${esc(notice.source.text)}</p><p class="meta">${esc(notice.source.explanation)}</p></details></article>`).join('')}</section>`;
 }
 root.GarrawayNotices={evaluate,render};
})(window);
;
(function(root){
 const stages=['事前申し込み','詳細すり合わせ','承認','開催準備','当日','結果報告'];
 const guidance=[
  {purpose:'企画の目的・対象・概要を共有し、事前確認につなげます。',responsibility:'主催者は、申請フォームの4ステップを入力して申請してください。'},
  {purpose:'事前確認の後に詳細ヒアリングを行い、利用条件に同意します。',responsibility:'主催者は内容・運営体制・必要な機材を具体化し、相談事項を共有してください。'},
  {purpose:'詳細と利用条件を踏まえて責任者が最終判断します。責任者の承認後の通知で、開催が確定します。',responsibility:'主催者は通知された開催条件を確認してください。'},
  {purpose:'事前リハーサルは原則実施します。遠方などの事情がある場合は個別に相談してください。',responsibility:'機材操作・不足品の手配・受付進行・設営撤収は主催者主体です。コンシェルジュの支援は運営代行ではありません。',change:'変更は速やかに申請し、運営側の確認を経て、新たな合意を整えてください。'},
  {purpose:'完全撤収には、原状復帰と全員退館を含みます。延長は他の利用者とスタッフの退勤に影響します。',responsibility:'主催者が受付進行・機材操作・設営撤収を担い、合意した時刻までに全員の退館を確認してください。',change:'変更は速やかに申請し、運営側の確認を経て、新たな合意を整えてください。'},
  {purpose:'開催の結果と振り返りを共有する工程です。',responsibility:'主催者は終了報告を提出し、確認事項があれば対応してください。'}
 ];
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const text=(value,fallback)=>typeof value==='string'&&value.trim()?value:fallback;

 function render(journey,{draft=false}={}){
  const value=draft?{stage:0,complete:false,needsReview:false,nextAction:'申請内容を入力して確認してください',waitingOn:'申請者'}:journey||{};
  const stage=Number.isInteger(value.stage)&&value.stage>=0&&value.stage<stages.length?value.stage:null;
  const needsReview=value.needsReview===true;
  const changePending=value.changePending===true;
  const complete=stage===5&&value.complete===true&&!needsReview&&!changePending;
  const status=stage===null?'工程の確認が必要':complete?'対応完了':`現在：${stages[stage]}`;
  const alerts=[changePending?'変更案は未合意':'',needsReview?'再確認が必要':''].filter(Boolean).map(label=>`<span class="journey-alert">${label}</span>`).join('');
  const nextAction=text(value.nextAction,stage===null?'現在の工程を確認してください':complete?'対応は完了しています':'次に行うことを確認してください');
  const waitingOn=text(value.waitingOn,complete?'なし':'確認が必要');
  const steps=stages.map((label,index)=>{
   const state=stage===null?'unknown':index===stage?'current':index<stage?'past':'future';
   const stateLabel=state==='unknown'?'未確認':state==='past'?'通過':state==='current'?(complete?'対応完了':needsReview?'再確認が必要':'現在'):'これから';
   return `<li class="journey-step" data-state="${state}"${state==='current'?' aria-current="step"':''}><span class="journey-number">${String(index+1).padStart(2,'0')}</span><span class="journey-label">${label}</span><span class="journey-step-state${state==='current'?'':' journey-sr-only'}">${stateLabel}</span></li>`;
  }).join('');
  const current=stage===null?null:guidance[stage];
  const explanation=current?`<section class="journey-guidance" aria-label="${stages[stage]}について"><p class="journey-purpose">${esc(current.purpose)}</p><p class="journey-responsibility"><strong>主催者の対応：</strong>${esc(complete?'終了報告までの対応は完了しています。':current.responsibility)}</p>${current.change?`<p class="journey-note journey-change">${esc(current.change)}</p>`:''}</section>`:'';
  const details=`<details class="journey-details"><summary>この工程で確認すること</summary>${explanation}<p class="journey-note">事前申し込みから結果報告までの全6工程です。事前申し込みでは、4ステップで入力します。</p>${stage!==null&&stage>0?'<p class="journey-note">通過した工程にも確認事項が残る場合があります。</p>':''}</details>`;
  return `<section class="panel journey-panel" aria-label="全体の進み方" data-stage="${stage===null?'unknown':stage}" data-complete="${complete}" data-needs-review="${needsReview}" data-change-pending="${changePending}"><div class="journey-heading"><h2>全体の進み方</h2><p class="journey-status">${status}${alerts}</p></div><ol class="journey-steps">${steps}</ol><dl class="journey-next"><dt>次の対応</dt><dd>${esc(nextAction)}</dd><dt>担当</dt><dd>${esc(waitingOn)}</dd>${value.nextDue?`<dt>自分の期限</dt><dd>${esc(value.nextDue)}</dd>`:''}</dl>${details}</section>`;
 }

 root.GarrawayJourney={render};
})(window);
;
(function(root){
 'use strict';
 const bound=new WeakMap();
 const titles=['基本情報','希望日時・プログラム','確認事項・署名','入力内容の確認'];
 const scheduleTimes=[['setupStart','準備開始','setupDay'],['eventStart','イベント開始','eventStartDay'],['eventEnd','イベント終了','eventEndDay'],['clearEnd','完全撤収','clearEndDay']];
 function bind(form){
  if(!form||form.tagName!=='FORM')return null;
  if(bound.has(form))return bound.get(form);
  const basic=form.querySelector(':scope > .fields');
  const schedule=form.querySelector('#intake-schedule');
  const submit=form.querySelector('button[type="submit"],button.primary:not([type="button"]),input[type="submit"]');
  const cancel=form.querySelector('#cancel-intake');
  if(!basic||!submit)return null;
  const doc=form.ownerDocument,original=[...form.childNodes],scheduleErrors=new Set(),marked=new Map();
  const node=(tag,className,text)=>{const el=doc.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  const button=(className,text)=>{const el=node('button',className,text);el.type='button';return el;};
  const progress=node('ol','intake-progress');progress.setAttribute('aria-label','申請の入力手順');
  const status=node('p','intake-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
  const steps=titles.map((title,i)=>{
   const item=node('li','',['基本情報','日時・内容','確認・署名','最終確認'][i]);item.setAttribute('aria-label',title);item.title=title;item.dataset.step=String(i);progress.append(item);
   const panel=node('section','intake-step');panel.dataset.intakeStep=String(i);panel.id=(form.id||'intake')+'-step-'+(i+1);
   const heading=node('h2','intake-step-heading',title);heading.id=panel.id+'-heading';heading.tabIndex=-1;panel.setAttribute('aria-labelledby',heading.id);panel.append(heading);return panel;
  });
  steps[0].append(basic);
  if(schedule)steps[1].append(schedule);else steps[1].append(node('p','','希望日時は基本情報で入力した内容を確認画面に表示します。'));
  original.forEach(el=>{if(el!==basic&&el!==schedule&&el!==submit&&el!==cancel)steps[2].append(el);});
  const summary=node('div','intake-summary');steps[3].append(node('p','intake-summary-intro','内容を確認し、必要なら「編集」で戻ってください。'),summary);
  const error=node('p','intake-error');error.setAttribute('role','alert');error.hidden=true;
  const navigation=node('div','intake-navigation');
  const previous=button('intake-previous','前へ'),next=button('intake-next primary','次へ');
  previous.dataset.intakePrevious='';next.dataset.intakeNext='';submit.dataset.intakeSubmit='';
  navigation.append(previous,next,submit);if(cancel)navigation.append(cancel);
  form.replaceChildren(progress,status,...steps,error,navigation);
  form.classList.add('intake-wizard');form.noValidate=true;
  let current=0;
  const locked=()=>submit.disabled||Boolean(form.closest('[aria-busy="true"]'));
  const controls=panel=>[...panel.querySelectorAll('input,select,textarea')];
  const labelOf=field=>{
   const label=field.labels?.[0]||field.closest('label');
   if(!label)return field.getAttribute('aria-label')||field.name||'入力項目';
   const copy=label.cloneNode(true);copy.querySelectorAll('input,select,textarea,button,.field-hint,small').forEach(el=>el.remove());return copy.textContent.trim()||field.getAttribute('aria-label')||field.name;
  };
  const displayValue=field=>field.type==='checkbox'?(field.checked?'確認済み':'未確認'):field.tagName==='SELECT'?[...field.selectedOptions].map(x=>x.textContent).join('、'):field.value;
  const pair=(list,label,value)=>{list.append(node('dt','',label),node('dd','',value||'未入力'));};
  const time=(value,key,day)=>value[key]?(Number(value[day])===1?'翌日 ':'当日 ')+value[key]:'未入力';
  function summarySection(title,index){
   const section=node('section','intake-summary-section'),heading=node('div','intake-summary-heading'),edit=button('intake-summary-edit','編集');
   edit.dataset.intakeEdit=String(index);edit.setAttribute('aria-label',title+'を編集');edit.addEventListener('click',()=>{if(!edit.disabled&&!locked())show(index);});
   heading.append(node('h3','',title),edit);section.append(heading);summary.append(section);return section;
  }
  function updateSummary(){
   summary.replaceChildren();
   const basicSummary=summarySection(titles[0],0),basicList=node('dl','intake-summary-list');
   controls(basic).filter(field=>field.type!=='hidden'&&!field.closest('label[hidden]')&&(!field.dataset.reviewKey||field.value.trim()!=='')).forEach(field=>pair(basicList,labelOf(field),displayValue(field)));basicSummary.append(basicList);
   const scheduleSummary=summarySection(titles[1],1);
   if(schedule&&root.GarrawaySchedule){
    const value=root.GarrawaySchedule.collect(schedule);
    value.candidates.forEach((candidate,i)=>{
     scheduleSummary.append(node('h4','','第'+(i+1)+'希望'));
     if(candidate.undecided){scheduleSummary.append(node('p','','日程・時刻は未定'));return;}
     const list=node('dl','intake-summary-list');pair(list,'希望日',candidate.date);scheduleTimes.forEach(([key,label,day])=>pair(list,label,time(candidate,key,day)));scheduleSummary.append(list);
    });
    scheduleSummary.append(node('h4','','イベント内のプログラム'));
    if(!value.program.length)scheduleSummary.append(node('p','','プログラムは未入力'));
    value.program.forEach((program,i)=>{const list=node('dl','intake-summary-list');pair(list,'プログラム '+(i+1),program.title);pair(list,'開始',time(program,'start','startDay'));pair(list,'終了',time(program,'end','endDay'));if(program.note)pair(list,'補足',program.note);scheduleSummary.append(list);});
   }else scheduleSummary.append(node('p','','希望日時は基本情報に表示しています。'));
   const consentSummary=summarySection(titles[2],2),consentList=node('dl','intake-summary-list');
   const groups=[...steps[2].querySelectorAll('fieldset')];const checked=groups.filter(g=>[...g.querySelectorAll('input[type="checkbox"]')].every(x=>x.checked)).length;pair(consentList,'確認事項',checked===groups.length?groups.length+'区分すべて確認済み':checked+' / '+groups.length+'区分を確認');
   controls(steps[2]).filter(field=>!field.closest('fieldset')&&field.type!=='hidden').forEach(field=>pair(consentList,labelOf(field),displayValue(field)));consentSummary.append(consentList);
  }
  function show(index,focus=true){
   current=index;form.dataset.intakeCurrentStep=String(index+1);
   if(index===3)updateSummary();
   steps.forEach((panel,i)=>{panel.hidden=i!==index;if(i===index)progress.children[i].setAttribute('aria-current','step');else progress.children[i].removeAttribute('aria-current');});
   status.textContent='入力手順 '+(index+1)+' / 4　'+titles[index];
   previous.hidden=index===0;next.hidden=index===3;submit.hidden=index!==3;
   next.textContent=index===2?'入力内容を確認する':'次へ';
   error.hidden=true;error.textContent='';
   if(focus)steps[index].querySelector('.intake-step-heading').focus();
  }
  function unmark(field){if(!marked.has(field))return;const previousValue=marked.get(field);if(previousValue===null)field.removeAttribute('aria-invalid');else field.setAttribute('aria-invalid',previousValue);marked.delete(field);}
  function mark(field){if(!marked.has(field))marked.set(field,field.getAttribute('aria-invalid'));field.setAttribute('aria-invalid','true');}
  function clearScheduleErrors(){scheduleErrors.forEach(field=>{field.setCustomValidity('');unmark(field);});scheduleErrors.clear();}
  function scheduleIssueField(issue){
   const candidate=issue.match(/^第(\d+)希望の(.+?)が/);
   if(candidate){const section=schedule.querySelector('[data-candidate="'+(Number(candidate[1])-1)+'"]'),key=scheduleTimes.find(([,label])=>label===candidate[2])?.[0];return section?.querySelector('[data-key="'+(key||'date')+'"]');}
   const program=issue.match(/^プログラム(\d+)/);
   if(program)return schedule.querySelectorAll('.program-row')[Number(program[1])-1]?.querySelector('[data-key="end"]');
   return controls(schedule).find(field=>!field.disabled&&field.type!=='hidden');
  }
  function validate(index){
   let issues=[];
   if(index===1&&schedule&&root.GarrawaySchedule){
    clearScheduleErrors();issues=root.GarrawaySchedule.assess(root.GarrawaySchedule.collect(schedule)).issues;
    issues.forEach(issue=>{const field=scheduleIssueField(issue);if(field&&!field.disabled&&!field.validity.customError){field.setCustomValidity(issue);scheduleErrors.add(field);}});
   }
   const field=controls(steps[index]).find(el=>el.willValidate&&!el.validity.valid);
   if(!field&&!issues.length)return true;
   show(index);
   if(field){
    for(let ancestor=field.parentElement;ancestor&&ancestor!==form;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')ancestor.open=true;
    mark(field);error.textContent=labelOf(field)+'：'+field.validationMessage;error.hidden=false;field.focus();field.reportValidity();
   }else{error.textContent=issues.join('。');error.hidden=false;}
   return false;
  }
  function advance(){
   if(locked()||current>=3)return;
   if(!validate(current))return;
   if(current===2&&!validateAll())return;
   show(current+1);
  }
  function validateAll(){for(let i=0;i<3;i++)if(!validate(i))return false;return true;}
  previous.addEventListener('click',()=>{if(!previous.disabled&&!locked()&&current>0)show(current-1);});
  next.addEventListener('click',()=>{if(!next.disabled)advance();});
  const changed=ev=>{if(locked())return;if(schedule?.contains(ev.target))clearScheduleErrors();if(ev.target.validity?.valid)unmark(ev.target);error.hidden=true;error.textContent='';};
  form.addEventListener('input',changed);form.addEventListener('change',changed);
  form.addEventListener('submit',ev=>{
   const stop=()=>{ev.preventDefault();ev.stopImmediatePropagation();};
   if(locked()){stop();return;}
   if(current!==3){stop();advance();return;}
   if(!validateAll())stop();
  },true);
  const controller={get currentStep(){return current+1;}};
  bound.set(form,controller);show(0,false);return controller;
 }
 root.GarrawayIntake={bind};
})(window);
;
(function (root) {
 'use strict';
 const labels={saved:'自動保存済み',dirty:'未保存・入力後に自動保存',saving:'保存中…',invalid:'未保存・入力内容を確認してください',failed:'未保存・保存できませんでした',conflict:'未保存・他の担当者の更新があります',uncertain:'保存結果が未確認です',paused:'未保存・再ログイン後に続けます'};
 const terminal=new Set(['VALIDATION','FORBIDDEN','NOT_FOUND','CLOSED','DELIVERY_DISABLED','RATE_LIMIT','CAPACITY','IDEMPOTENCY_CONFLICT']);
 const clone=value=>JSON.parse(JSON.stringify(value));
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function create({eventId,version,write,beforeWrite=()=>{},onVersion=()=>{},delay=900}) {
  let forms=[],timer=null,active=null,pending=null,paused=false,disposed=false,blocked=false,conflicted=false;
  const valid=form=>form.checkValidity()&&[...form.querySelectorAll('input,textarea')].every(field=>field.disabled||field.maxLength<0||field.value.length<=field.maxLength);
  const dirty=entry=>!equal(entry.read(),entry.baseline);
  function status(entry,state,detail=''){
   entry.state=state;entry.form.dataset.autosaveState=state;
   entry.label.textContent=labels[state]+(detail?'：'+detail:'');
   entry.retry.hidden=state!=='uncertain';
  }
  const clearTimer=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
  function schedule(){clearTimer();if(!paused&&!disposed&&!blocked&&!pending)timer=setTimeout(()=>{timer=null;void flush();},delay);}
  function register({form,path,read,body,validate=()=>true,accept=()=>{}}){
   if(!form||forms.some(entry=>entry.form===form))return;
   const label=document.createElement('span'),retry=document.createElement('button'),line=document.createElement('p');
   line.className='operational-autosave-status';line.setAttribute('role','status');line.setAttribute('aria-live','polite');
   retry.type='button';retry.textContent='保存結果を確認';retry.hidden=true;
   line.append(label,retry);form.append(line);form.dataset.operationalAutosave='true';
   const entry={form,path,read,body,validate,accept,label,retry,baseline:clone(read()),state:'saved'};
   const changed=event=>{if(disposed||event.target.closest('.operational-autosave-status'))return;if(blocked&&!conflicted)blocked=false;status(entry,paused?'paused':pending&&!active?'uncertain':blocked?'conflict':dirty(entry)?'dirty':'saved');if(!event.isComposing)schedule();};
   const submit=event=>{event.preventDefault();event.stopImmediatePropagation();if(paused||disposed)return;void flush(true);};
   form.addEventListener('input',changed);form.addEventListener('change',changed);form.addEventListener('compositionend',changed);form.addEventListener('submit',submit,true);
   retry.onclick=()=>void flush(true);
   entry.cleanup=()=>{form.removeEventListener('input',changed);form.removeEventListener('change',changed);form.removeEventListener('compositionend',changed);form.removeEventListener('submit',submit,true);};
   forms.push(entry);status(entry,'saved');
  }
  async function run(retry){
   while(!disposed&&!paused){
    if(pending&&!retry)return false;
    if(!pending){
     if(blocked)return false;
     const entry=forms.find(item=>item.form.isConnected&&dirty(item)&&valid(item.form)&&item.validate());
     if(!entry){for(const item of forms)if(dirty(item))status(item,'invalid');return !forms.some(dirty);}
     const values=clone(entry.read());
     const payload=entry.body(values,entry.baseline);
     if(!payload){entry.baseline=values;status(entry,'saved');continue;}
     pending={entry,values,uxValue:root.GarrawayUx?.capture(entry.form),body:{id:eventId,expectedVersion:version,...payload,key:crypto.randomUUID()}};
    }
    const command=pending;status(command.entry,'saving');beforeWrite();
    try{
     const result=await write('/'+eventId+'/'+command.entry.path,command.body);
     if(disposed)return false;
     if(result?.id!==eventId||!Number.isInteger(result.version)||result.version<version)throw Error('保存応答を確認できません');
     version=result.version;onVersion(version);command.entry.accept(command.values);
     command.entry.baseline=command.values;root.GarrawayUx?.markSaved(command.entry.form,command.uxValue);
     pending=null;status(command.entry,dirty(command.entry)?'dirty':'saved');
    }catch(error){
     if(disposed)return false;
     if(error.code==='VERSION_CONFLICT'){pending=null;blocked=true;conflicted=true;status(command.entry,'conflict','入力を保持しています。内容を控えてから最新状態を読み直してください。');}
     else if(terminal.has(error.code)){pending=null;blocked=true;status(command.entry,'failed',error.message||'内容を確認してください');}
     else{status(command.entry,'uncertain',['SESSION_EXPIRED','STAFF_DISABLED','UNAUTHENTICATED'].includes(error.code)?'再ログイン後に同じ操作の結果を確認してください。':'同じ操作の結果を確認してください。');}
     return false;
    }
    retry=false;
   }
   return !hasChanges();
  }
  function flush(retry=false){clearTimer();if(active)return active;if(disposed||paused)return Promise.resolve(false);active=run(retry).finally(()=>{active=null;});return active;}
  function hasChanges(){return Boolean(pending||active||forms.some(dirty));}
  
  
  function beforeGuard(action,options,continueGuard){
   if(disposed)return false;
   if(paused)return true;
   if(pending&&!active){status(pending.entry,'uncertain','保存結果を確認してから移動してください。');return true;}
   if(active||!blocked&&forms.some(entry=>dirty(entry)&&valid(entry.form)&&entry.validate())){
    void flush().then(()=>{if(disposed||paused||pending)return;continueGuard();});return true;
   }
   clearTimer();return false;
  }
  function dispose(){disposed=true;clearTimer();for(const entry of forms)entry.cleanup();forms=[];pending=null;}
  return {register,flush,hasChanges,beforeGuard,dispose,get version(){return version;},eventId,
   hasUnresolved:()=>Boolean(active||pending),pause(){paused=true;clearTimer();},resume(){paused=false;for(const entry of forms)if(dirty(entry))status(entry,pending?'uncertain':blocked?'conflict':'dirty');if(!pending&&!blocked)schedule();},
   manualVersion(id){return id===eventId?version:null;}};
 }
 root.GarrawayOperationalAutosave={create,current:null};
})(window);
;
(()=>{'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={screening:'事前審査フォームを受領・確認した',hearing:'詳細ヒアリングを受領・確認した',consent:'本人が同意した書類を受領した',approval:'開催可の判断を受けた',approvalMail:'主催者へ結果を通知した',restore:'原状復帰・完全撤収の報告を確認した',report:'終了報告・実施資料を受領した'};
 const title=t=>labels[t.id]||t.title;
 function render(event){const op=event.operationalProgress;if(!event.canRecordOperationalFact||!op)return '';const selected=op.nextTaskId||op.tasks[0]?.id;
  return '<section class="operational-progress panel"><div class="operational-progress-heading"><h3>運用の進捗を記録</h3><span class="tag">共有利用者の事実記録</span></div><p class="meta">実際に行ったこと・受け取ったことを記録します。個人の本人確認、アプリからのメール送信、署名の代行は行いません。</p>'+(op.agreement?'<details class="operational-agreement"><summary>共有記録の開催条件'+(op.booking==='reported-confirmed'?'':'（変更後の再確認が必要）')+'</summary><p>第'+(op.agreement.candidateIndex+1)+'希望 ／ '+esc(op.agreement.schedule?.candidates?.[op.agreement.candidateIndex]?.date)+' ／ 通知日 '+esc(op.agreement.reportedOn)+'</p><p class="meta">共有利用者からの報告に基づく記録です。アプリの送信履歴ではありません。</p></details>':'')+'<form id="operational-record"><label>作業<select name="taskId">'+op.stages.map(stage=>'<optgroup label="'+String(stage.index+1).padStart(2,'0')+' '+esc(stage.label)+'">'+stage.ids.map(id=>{const task=op.tasks.find(t=>t.id===id);return '<option value="'+id+'" '+(id===selected?'selected':'')+'>'+esc((task.status==='recorded'?'✓ ':task.status==='needs-review'?'再確認：':'')+title(task))+'</option>';}).join('')+'</optgroup>').join('')+'</select></label><p class="operational-prerequisites" role="status"></p><div class="operational-record-fields"><label>実施・受領日<input name="occurredOn" type="date" required></label><label>状態<select name="result"><option value="completed">実施・受領済みを記録</option><option value="reopened">再確認に戻す</option></select></label></div><div class="operational-approval" hidden><label>実際に判断した人・組織<input name="performerName" maxlength="120" autocomplete="off"><small>入力された情報として保存します。本人認証はしません。</small></label><label>判断の対象となった開催候補<select name="candidateIndex"><option value="">選択してください</option>'+(event.schedule?.candidates||[]).map((c,i)=>'<option value="'+i+'">第'+(i+1)+'希望：'+esc(c.undecided?'未定':c.date+' '+c.eventStart+'〜'+c.eventEnd)+'</option>').join('')+'</select></label></div><div class="operational-notification" hidden><label>実際の通知方法<select name="method"><option value="">選択してください</option><option value="email">メール</option><option value="phone">電話</option><option value="meeting">対面・打合せ</option><option value="other">その他</option></select></label><label>実際の通知先<input name="recipient" maxlength="120" value="'+esc(event.common.responsibleName||'主催者')+'"></label><p class="meta">すでに行った通知の報告です。この操作ではメールを送りません。</p></div><details class="operational-evidence"><summary>確認メモ・証跡</summary><label>確認した内容<textarea name="comment" maxlength="1000" rows="2"></textarea></label><label>証跡リンク（任意）<input name="evidenceUrl" type="url" maxlength="600" placeholder="Googleドライブの共有URL"></label><p class="meta">同意書・終了報告の受領はメモか証跡、再確認に戻す場合は理由のメモが必要です。</p></details><div class="actions"><button class="primary" type="submit">事実を記録する</button></div><p class="operational-record-error" role="alert"></p></form><details class="operational-history"><summary>この作業の直近の記録</summary><div></div></details></section>';
 }
 function bind(event,onSave){const form=document.querySelector('#operational-record');if(!form)return;const op=event.operationalProgress,today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());form.elements.occurredOn.value=today;form.elements.occurredOn.max=today;
  const update=()=>{const task=op.tasks.find(t=>t.id===form.elements.taskId.value),completed=form.elements.result.value==='completed',approval=task.id==='approval'&&completed,notification=task.id==='approvalMail'&&completed;form.querySelector('.operational-approval').hidden=!approval;form.elements.performerName.required=approval;form.elements.candidateIndex.required=approval;form.querySelector('.operational-notification').hidden=!notification;form.elements.method.required=notification;form.elements.recipient.required=notification;const blocked=completed&&task.blockedBy.length>0;form.querySelector('button[type=submit]').disabled=blocked;form.querySelector('.operational-prerequisites').textContent=blocked?'先に確認：'+task.blockedBy.join('・'):task.status==='needs-review'?'内容・先行記録が変わっています。現在の内容で確認してください。':'';const needsEvidence=!completed||['consent','report'].includes(task.id);form.querySelector('.operational-evidence').open=needsEvidence;const history=form.closest('.operational-progress').querySelector('.operational-history div');history.innerHTML=task.record?'<p>'+esc(task.record.occurredOn)+' ／ '+esc(task.record.result==='completed'?'実施・受領の報告':'再確認に戻した記録')+'</p>'+(task.record.performerName?'<p>実施・判断者：'+esc(task.record.performerName)+'（自己申告・本人未確認）</p>':'')+(task.record.comment?'<p>'+esc(task.record.comment)+'</p>':'')+'<p class="meta">記録者：'+esc(task.record.recordedBy)+' ／ 対象版 '+esc(task.record.observedEventVersion)+'</p>':'<p>共有運用の記録はまだありません。</p>';};
  form.elements.taskId.addEventListener('change',()=>{form.elements.comment.value='';form.elements.evidenceUrl.value='';form.elements.performerName.value='';form.elements.candidateIndex.value='';form.elements.method.value='';update();});form.elements.result.addEventListener('change',update);update();
  form.addEventListener('submit',event2=>{event2.preventDefault();if(!form.reportValidity())return;const values=Object.fromEntries(new FormData(form)),fact={taskId:values.taskId,result:values.result,occurredOn:values.occurredOn};for(const key of ['comment','evidenceUrl'])if(values[key])fact[key]=values[key];if(fact.result==='completed'&&fact.taskId==='approval'){fact.performerName=values.performerName;fact.candidateIndex=Number(values.candidateIndex);}if(fact.result==='completed'&&fact.taskId==='approvalMail'){fact.method=values.method;fact.recipient=values.recipient;}if(fact.result==='reopened'&&!fact.comment){form.querySelector('.operational-record-error').textContent='再確認に戻す理由を確認メモに入力してください。';form.querySelector('.operational-evidence').open=true;form.elements.comment.focus();return;}if(fact.result==='completed'&&['consent','report'].includes(fact.taskId)&&!fact.comment&&!fact.evidenceUrl){form.querySelector('.operational-record-error').textContent='確認メモまたは証跡リンクを入力してください。';form.querySelector('.operational-evidence').open=true;form.elements.comment.focus();return;}onSave(fact);});
 }
 window.GarrawayOperationalProgress={render,bind};
})();
;
(()=>{
let root,baseline=new Map(),submitting=null,dialog=null,inertBefore=false,unloadAllowed=false;
const value=form=>JSON.stringify([...form.querySelectorAll('input,textarea,select')].filter(x=>x.type!=='hidden'&&!x.readOnly).map(x=>[x.closest('.program-row')?.dataset.programId||'',x.name||x.dataset.key||'',x.type==='checkbox'?x.checked:x.value]));
const changed=()=>[...baseline].filter(([form,v])=>form.isConnected&&value(form)!==v).map(([form])=>form);
function reveal(node){if(!node)return;for(let p=node.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;node.focus();node.scrollIntoView?.({block:'center',behavior:'instant'});}
function close(){dialog?.remove();dialog=null;if(root)root.inert=inertBefore;}
function guard(action,{saving=false,scope=null,onCancel=()=>{},autosaveReady=false}={}){if(!autosaveReady&&window.GarrawayOperationalAutosave?.current?.beforeGuard(action,{saving,scope,onCancel},()=>guard(action,{saving,scope,onCancel,autosaveReady:true})))return false;const dirty=changed().filter(form=>(!saving||form!==submitting)&&(!scope||scope.contains(form)));if(!dirty.length){action();return true;}if(dialog){reveal(dialog.querySelector('button'));return false;}const previous=document.activeElement;dialog=document.createElement('section');dialog.className='unsaved-dialog panel';dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','unsaved-title');dialog.innerHTML='<h2 id="unsaved-title">未保存の入力があります</h2><p>このまま進むと'+(saving?'別の入力欄の変更':'入力した変更')+'が失われます。先に保存する場合は入力へ戻ってください。</p><div class="actions"><button type="button" class="primary" data-keep>入力へ戻る</button><button type="button" data-discard>未保存の変更を破棄して進む</button></div>';inertBefore=Boolean(root?.inert);if(root)root.inert=true;document.body.append(dialog);dialog.querySelector('[data-keep]').onclick=()=>{close();onCancel();reveal(previous);};dialog.querySelector('[data-discard]').onclick=()=>{close();action();};dialog.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();onCancel();reveal(previous);}if(e.key==='Tab'){const buttons=dialog.querySelectorAll('button');if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[1].focus();}else if(!e.shiftKey&&document.activeElement===buttons[1]){e.preventDefault();buttons[0].focus();}}};reveal(dialog.querySelector('[data-keep]'));return false;}
const snapshot=()=>new Map([...baseline.keys()].filter(f=>f.isConnected).map(f=>[f,value(f)]));
const changedSince=map=>[...map].some(([f,v])=>f.isConnected&&value(f)!==v)||changed().some(f=>!map.has(f));
function indicator(){const box=root?.ownerDocument?.querySelector('#input-state');if(box){const forms=changed();box.textContent=forms.length?(forms.every(form=>form.dataset.operationalAutosave==='true')?'未保存の変更があります。自動保存の状態を確認してください。':'未保存の入力があります。各項目の記録・保存ボタンを確認してください。'):'';}}
function markSaved(form,snapshot){if(baseline.has(form)&&typeof snapshot==='string')baseline.set(form,snapshot);indicator();}
function register(form){if(!form||baseline.has(form))return;baseline.set(form,value(form));form.addEventListener('submit',()=>{submitting=form;setTimeout(()=>{if(submitting===form)submitting=null;},0);},true);}
function bind(node){close();root=node;baseline=new Map();root.querySelectorAll('form').forEach(register);indicator();}
document.addEventListener('invalid',event=>{if(root?.contains(event.target))reveal(event.target);},true);
window.addEventListener('beforeunload',event=>{if(unloadAllowed){unloadAllowed=false;return;}if(changed().length){event.preventDefault();event.returnValue='';}});
for(const type of ['click','submit','keydown'])document.addEventListener(type,event=>{if(dialog&&!dialog.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}},true);
for(const type of ['input','change','click'])document.addEventListener(type,()=>queueMicrotask(indicator));
window.GarrawayUx={bind,register,guard,capture:value,markSaved,lock:close,changed,reveal,snapshot,changedSince,allowUnload:()=>{unloadAllowed=true;}};
})();
;
(function(root){
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const zone='Asia/Tokyo';
 const disabled=disabledReason=>({url:null,disabledReason,basis:null,candidateIndex:null});
 function calendarDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(value+'T00:00:00.000Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?date.getTime():null;
 }
 function minutes(time,day){
  if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||![0,1].includes(day))return null;
  const [h,m]=time.split(':').map(Number);return day*1440+h*60+m;
 }
 function hasConfirmation(value){
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)&&calendarDate(value.slice(0,10))!==null&&Number.isFinite(Date.parse(value));
 }
 const publicTime=(date,value)=>value===null?'未記録':new Date(date+value*60000).toISOString().slice(0,16).replace('T',' ');
 const stamp=(date,value)=>new Date(date+value*60000-9*3600000).toISOString().replace(/[-:]/g,'').replace('.000','');

 function link(event,_options={}){
  if(!event||typeof event!=='object')return disabled('開催の確定情報を確認できません。');
  if(['cancelled','declined'].includes(event.outcome))return disabled('取り消し・開催見送りの予定は追加できません。');
  const pending=event.changePending===true;
  let basis='confirmed',source=event;
  if(pending){
   source=event.agreedConditions;basis='agreedConditions';
   if(!source||!hasConfirmation(source.confirmedAt))return disabled('変更前の開催確定記録を確認できません。運営に確認してください。');
  }else if(event.booking!=='confirmed')return disabled('開催確定の通知後、選択された開催日時で追加できます。');
  const index=source.approvedCandidateIndex;
  if(![0,1].includes(index))return disabled('開催する希望日時が確定していません。運営に確認してください。');
  const candidate=source.schedule?.candidates?.[index];
  if(!candidate||candidate.undecided!==false)return disabled('選択された開催日時は未定です。運営に確認してください。');
  const date=calendarDate(candidate.date);
  if(date===null)return disabled('選択された開催日が未入力、または正しい日付ではありません。');
  const title=typeof source.common?.eventTitle==='string'?source.common.eventTitle.trim():'';
  if(!title)return disabled('イベント名を確認してから追加してください。');
  const start=minutes(candidate.eventStart,candidate.eventStartDay),end=minutes(candidate.eventEnd,candidate.eventEndDay);
  if(start===null||end===null)return disabled('イベント開始・終了と「当日／翌日」を確認してください。');
  if(end<=start)return disabled('イベント終了は開始より後にしてください。「当日／翌日」も確認してください。');
  const hasSetup=candidate.setupStart!==undefined&&candidate.setupStart!=='',hasClear=candidate.clearEnd!==undefined&&candidate.clearEnd!=='';
  const setup=hasSetup?minutes(candidate.setupStart,candidate.setupDay):null,clear=hasClear?minutes(candidate.clearEnd,candidate.clearEndDay):null;
  if(hasSetup&&setup===null||hasClear&&clear===null)return disabled('準備開始・完全撤収の時刻と「当日／翌日」を確認してください。');
  if(setup!==null&&setup>start||clear!==null&&clear<end)return disabled('準備開始 → イベント開始 → イベント終了 → 完全撤収の順番を確認してください。');
  
  
  const details=[
   'Garraway F の開催予定（日本時間）',
   '開催：'+publicTime(date,start)+' ～ '+publicTime(date,end),
   '準備開始：'+publicTime(date,setup),
   '完全撤収：'+publicTime(date,clear),
   'カレンダーの開始・終了はイベントの開催時間です。準備・完全撤収は上記を確認してください。',
   'ユーザーがGoogleの画面で内容を確認して保存してください。',
   '保存した予定は自動更新されません。変更時は保存済みの予定も確認してください。'
  ].join('\n');
  const startStamp=stamp(date,start),endStamp=stamp(date,end);
  if(!/^\d{8}T\d{6}Z$/.test(startStamp)||!/^\d{8}T\d{6}Z$/.test(endStamp))return disabled('カレンダーに使える日付の範囲を超えています。');
  const url=new URL('https://calendar.google.com/calendar/r/eventedit');
  url.search=new URLSearchParams({action:'TEMPLATE',text:title,dates:startStamp+'/'+endStamp,ctz:zone,stz:zone,etz:zone,location:'Garraway F',details}).toString();
  return {url:url.toString(),disabledReason:null,basis,candidateIndex:index};
 }

 function render(event,{applicant=false}={}){
  const result=link(event,{applicant});
  const note=result.basis==='agreedConditions'?'変更案は未合意のため、変更前に確定した開催日時を使います。':result.url?'確定した第'+(result.candidateIndex+1)+'希望の開催時間を使います。':result.disabledReason;
  const action=result.url?`<a class="button calendar-link" data-calendar-link href="${esc(result.url)}" target="_blank" rel="noopener noreferrer">Googleカレンダーで予定を確認</a>`:'<button type="button" class="calendar-link" disabled>Googleカレンダーで予定を確認</button>';
  return `<section class="panel calendar-panel" aria-label="Googleカレンダー用の予定"><h2>カレンダーに予定を控える</h2><p class="calendar-basis">${esc(note)}</p>${action}<p class="meta">ユーザーがGoogleの画面で内容を確認して保存します。イベント名・開催日時・準備開始・完全撤収・会場名がGoogleに渡ります。保存後の予定は自動更新されません。</p></section>`;
 }
 root.GarrawayCalendar={render,link};
})(window);
;
(() => {
  
  var SHARED_STAFF_LABELS = Object.freeze({ concierge: "\u30B3\u30F3\u30B7\u30A7\u30EB\u30B8\u30E5", okami: "\u5973\u5C06", toyota: "\u30C8\u30E8\u30BF" });
  function sharedStaffEvidence(event = {}, role) {
    if (!Object.hasOwn(SHARED_STAFF_LABELS, role)) return { known: false, status: "unknown", label: "\u5BFE\u8C61\u306E\u8A18\u9332\u306A\u3057" };
    const records = Array.isArray(event.decisionRecords) ? event.decisionRecords : [];
    const record = records.map((value2, index) => ({ value: value2, index })).filter(({ value: value2 }) => value2?.target === role && ["pending", "ok", "revision", "declined"].includes(value2.result) && typeof value2.decisionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value2.decisionDate)).sort((a, b) => b.value.decisionDate.localeCompare(a.value.decisionDate) || String(b.value.recordedAt ?? "").localeCompare(String(a.value.recordedAt ?? "")) || b.index - a.index)[0]?.value;
    if (record) return { known: true, status: record.result === "pending" ? "pending" : "recorded", label: { pending: "\u78BA\u8A8D\u5F85\u3061\u30FB\u76F8\u8AC7\u4E2D\uFF08\u8A18\u9332\uFF09", ok: "OK\u8A18\u9332\u3042\u308A", revision: "\u8981\u4FEE\u6B63\u306E\u8A18\u9332\u3042\u308A", declined: "\u898B\u9001\u308A\u306E\u8A18\u9332\u3042\u308A" }[record.result] };
    const route = event.staffRouting?.[role], status = route?.status;
    if (role === "toyota" && route?.required === true && ["requested", "not-requested", "approved", "rejected"].includes(status)) return { known: true, status: status === "requested" ? "pending" : status === "not-requested" ? "assigned" : "recorded", label: { requested: "\u5224\u65AD\u4F9D\u983C\u3042\u308A\uFF08\u8A18\u9332\uFF09", "not-requested": "\u5224\u65AD\u304C\u5FC5\u8981\u30FB\u672A\u4F9D\u983C\uFF08\u8A18\u9332\uFF09", approved: "\u904E\u53BB\u306E\u5224\u65AD\u8A18\u9332\u3042\u308A", rejected: "\u904E\u53BB\u306E\u898B\u9001\u308A\u8A18\u9332\u3042\u308A" }[status] };
    if (role !== "toyota" && ["requested", "planned", "resolved"].includes(status)) return { known: true, status: status === "requested" ? "pending" : status === "resolved" ? "recorded" : "assigned", label: { requested: "\u76F8\u8AC7\u4F9D\u983C\u3042\u308A\uFF08\u8A18\u9332\uFF09", planned: "\u76F8\u8AC7\u4E88\u5B9A\u306E\u8A18\u9332\u3042\u308A", resolved: "\u5BFE\u5FDC\u306E\u8A18\u9332\u3042\u308A" }[status] };
    if (role === "concierge" && typeof event.caseHandler === "string" && event.caseHandler.trim()) return { known: true, status: "assigned", label: "\u62C5\u5F53\u306E\u8A18\u9332\u3042\u308A" };
    const sourceRole = { "\u30B3\u30F3\u30B7\u30A7\u30EB\u30B8\u30E5": "concierge", "\u304A\u304B\u307F": "okami", "\u5973\u5C06": "okami", "\u30C8\u30E8\u30BF": "toyota" }[typeof event.source?.handlerRaw === "string" ? event.source.handlerRaw.trim() : ""];
    if (sourceRole === role) return { known: true, status: "assigned", label: "\u539F\u7968\u62C5\u5F53\u306E\u8A18\u9332\u3042\u308A" };
    return { known: false, status: "unknown", label: "\u5BFE\u8C61\u306E\u8A18\u9332\u306A\u3057" };
  }

  
  var INQUIRY_SLA_POLICY = Object.freeze({
    timeZone: "Asia/Tokyo",
    businessDays: 3,
    excludedWeekdays: Object.freeze([0, 6]),
    publicHolidaysExcluded: false,
    receiptDayCounted: false,
    deadlineInclusive: true,
    deadlineBasis: "end-of-third-weekday-date"
  });
  var inquiryDayMs = 864e5;
  var inquiryTokyoFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: INQUIRY_SLA_POLICY.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  function inquiryUtcWall(year, month, day, hour, minute, second, millisecond) {
    const date =   new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, millisecond);
    return date;
  }
  function inquiryParseInstant(value2) {
    if (typeof value2 !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value2);
    if (!match) return null;
    const [, y, mo, d, h, mi, s = "0", fraction = "", zone] = match;
    const year = Number(y), month = Number(mo), day = Number(d);
    const hour = Number(h), minute = Number(mi), second = Number(s);
    const millisecond = Number(fraction.padEnd(3, "0"));
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
    const wall = inquiryUtcWall(year, month, day, hour, minute, second, millisecond);
    if (wall.getUTCFullYear() !== year || wall.getUTCMonth() + 1 !== month || wall.getUTCDate() !== day) return null;
    let offset = 0;
    if (zone !== "Z") {
      const offsetHours = Number(zone.slice(1, 3)), offsetMinutes = Number(zone.slice(4, 6));
      if (offsetHours > 23 || offsetMinutes > 59 || zone === "-00:00") return null;
      offset = (offsetHours * 60 + offsetMinutes) * 6e4 * (zone[0] === "-" ? -1 : 1);
    }
    const epoch = wall.getTime() - offset;
    const utcYear = new Date(epoch).getUTCFullYear();
    return Number.isFinite(epoch) && utcYear >= 1 && utcYear <= 9999 ? epoch : null;
  }
  function inquiryTokyoWall(epoch) {
    const fields = {};
    for (const part of inquiryTokyoFormatter.formatToParts(new Date(epoch))) {
      if (part.type !== "literal") fields[part.type] = Number(part.value);
    }
    const millisecond = (epoch % 1e3 + 1e3) % 1e3;
    return inquiryUtcWall(fields.year, fields.month, fields.day, fields.hour, fields.minute, fields.second, millisecond).getTime();
  }
  function inquiryTokyoOffset(epoch) {
    return inquiryTokyoWall(epoch) - epoch;
  }
  function inquiryInstantFromTokyoWall(wall) {
    const offsets = new Set([-2, 0, 2].map((days) => inquiryTokyoOffset(wall + days * inquiryDayMs)));
    const matches = [...offsets].map((offset) => wall - offset).filter((epoch) => inquiryTokyoWall(epoch) === wall);
    return matches.length ? Math.min(...matches) : null;
  }
  function inquiryFormatTokyo(epoch) {
    const offset = inquiryTokyoOffset(epoch);
    const local = new Date(epoch + offset).toISOString();
    if (offset % 6e4 || !/^\d{4}-/.test(local)) return new Date(epoch).toISOString();
    const minutes = Math.abs(offset / 6e4);
    const zone = (offset < 0 ? "-" : "+") + String(Math.floor(minutes / 60)).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
    return local.slice(0, -1) + zone;
  }
  function calculateInquiryDeadline(receivedAt) {
    const received = inquiryParseInstant(receivedAt);
    if (received === null) return null;
    const date = new Date(inquiryTokyoWall(received));
    let remaining = INQUIRY_SLA_POLICY.businessDays;
    while (remaining > 0) {
      date.setUTCDate(date.getUTCDate() + 1);
      if (!INQUIRY_SLA_POLICY.excludedWeekdays.includes(date.getUTCDay())) remaining -= 1;
    }
    if (date.getUTCFullYear() > 9999) return null;
    date.setUTCHours(23, 59, 59, 999);
    const deadline2 = inquiryInstantFromTokyoWall(date.getTime());
    return deadline2 === null ? null : inquiryFormatTokyo(deadline2);
  }
  function evaluateInquirySla(record, { now } = {}) {
    const result = {
      status: "unknown",
      deadlineAt: null,
      deadlineDate: null,
      latestIncomingAt: null,
      cycleStartedAt: null,
      receivedAt: null,
      lastResponseAt: null,
      evaluatedAt: null,
      trackingKnown: false,
      reason: "invalid_record",
      timeZone: INQUIRY_SLA_POLICY.timeZone,
      businessDays: INQUIRY_SLA_POLICY.businessDays,
      overdue: false,
      respondedWithinSla: null
    };
    const unknown = (reason) => ({ ...result, reason });
    if (!record || typeof record !== "object" || Array.isArray(record)) return result;
    const clock = inquiryParseInstant(now);
    if (clock === null) return unknown("invalid_now");
    result.evaluatedAt = inquiryFormatTokyo(clock);
    const received = inquiryParseInstant(record.receivedAt);
    if (received === null) return unknown(record.receivedAt == null ? "missing_received_at" : "invalid_received_at");
    result.receivedAt = inquiryFormatTokyo(received);
    const incoming = record.incomingAt === void 0 ? received : inquiryParseInstant(record.incomingAt);
    if (incoming === null) return unknown("invalid_incoming_at");
    if (incoming < received) return unknown("incoming_before_receipt");
    if (incoming > clock) return unknown("incoming_in_future");
    result.latestIncomingAt = inquiryFormatTokyo(incoming);
    result.cycleStartedAt = result.receivedAt;
    result.deadlineAt = calculateInquiryDeadline(result.cycleStartedAt);
    if (result.deadlineAt === null) return unknown("deadline_unavailable");
    result.deadlineDate = new Date(inquiryTokyoWall(inquiryParseInstant(result.deadlineAt))).toISOString().slice(0, 10);
    if (record.lastResponseAt === void 0) return unknown("reply_tracking_unknown");
    const response = record.lastResponseAt === null ? null : inquiryParseInstant(record.lastResponseAt);
    if (record.lastResponseAt !== null && response === null) return unknown("invalid_last_response_at");
    if (response !== null && response < received) return unknown("response_before_receipt");
    if (response !== null && response > clock) return unknown("response_in_future");
    if (response !== null && record.lastResponseKind !== "human") return unknown("human_response_unverified");
    if (response !== null && record.lastResponseVerified !== true) return unknown("response_evidence_unverified");
    if (response !== null && record.threadMatch !== true) return unknown("response_thread_unverified");
    result.lastResponseAt = response === null ? null : inquiryFormatTokyo(response);
    if (response !== null && response < incoming) {
      if (record.incomingStartsNewCycle !== true) return unknown("new_cycle_evidence_unknown");
      result.cycleStartedAt = result.latestIncomingAt;
      result.deadlineAt = calculateInquiryDeadline(result.cycleStartedAt);
      if (result.deadlineAt === null) return unknown("deadline_unavailable");
      result.deadlineDate = new Date(inquiryTokyoWall(inquiryParseInstant(result.deadlineAt))).toISOString().slice(0, 10);
    }
    result.trackingKnown = true;
    const deadline2 = inquiryParseInstant(result.deadlineAt);
    if (response !== null && response >= incoming) {
      const onTime = response <= deadline2;
      return { ...result, status: "replied", reason: onTime ? "reply_recorded" : "reply_recorded_late", respondedWithinSla: onTime };
    }
    if (clock > deadline2) return { ...result, status: "overdue", reason: "reply_deadline_passed", overdue: true };
    const sameLocalDate = new Date(inquiryTokyoWall(inquiryParseInstant(result.cycleStartedAt))).toISOString().slice(0, 10) === new Date(inquiryTokyoWall(clock)).toISOString().slice(0, 10);
    return { ...result, status: sameLocalDate ? "new" : "unanswered", reason: response === null ? "no_response_recorded" : "new_inquiry_after_response" };
  }
  var INQUIRY_NOTIFICATION_ROLES = Object.freeze([
    Object.freeze({ role: "concierge", label: "\u30B3\u30F3\u30B7\u30A7\u30EB\u30B8\u30E5" }),
    Object.freeze({ role: "okami", label: "\u5973\u5C06" }),
    Object.freeze({ role: "toyota", label: "\u30C8\u30E8\u30BF" })
  ]);
  var INQUIRY_NOTIFICATION_DELIVERY = Object.freeze({
    mode: "dry-run",
    enabled: false,
    canEnableDelivery: false,
    accountVerified: false,
    recipientsVerified: false,
    provider: null,
    sender: null,
    recipientDirectory: null,
    reason: "\u9001\u4FE1\u5143\u30A2\u30AB\u30A6\u30F3\u30C8\u30FB\u5B9B\u5148\u306F\u672A\u78BA\u8A8D\u3067\u3059\u3002\u901A\u77E5\u306F\u672A\u63A5\u7D9A\u306E\u8A66\u7B97\u3067\u3001\u9001\u4FE1\u30FB\u4E88\u7D04\u306F\u3067\u304D\u307E\u305B\u3093\u3002"
  });
  function inquiryOneLine(value2, max = 180) {
    return typeof value2 === "string" ? value2.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
  }
  function planInquiryNotifications(records, { now } = {}) {
    const plan = {
      mode: "dry-run",
      deliveryEnabled: false,
      canEnableDelivery: false,
      accountVerified: false,
      recipientsVerified: false,
      evaluatedAt: inquiryParseInstant(now) === null ? null : inquiryFormatTokyo(inquiryParseInstant(now)),
      blockers: ["delivery_adapter_disabled", "sender_account_unverified", "recipients_unverified"],
      notifications: [],
      skipped: []
    };
    if (!Array.isArray(records)) {
      plan.skipped.push({ recordId: null, reason: "invalid_records" });
      return plan;
    }
    const idCounts =   new Map();
    for (const record of records) {
      const id = inquiryOneLine(record?.id, 120);
      if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
    }
    for (const record of records) {
      const id = inquiryOneLine(record?.id, 120);
      if (!id || idCounts.get(id) > 1) {
        plan.skipped.push({ recordId: id || null, reason: id ? "duplicate_record_id" : "missing_record_id" });
        continue;
      }
      const sla = evaluateInquirySla(record, { now });
      if (sla.status === "unknown" || sla.status === "replied") {
        plan.skipped.push({ recordId: id, status: sla.status, reason: sla.reason });
        continue;
      }
      const kind = sla.overdue ? "overdue" : "pending";
      const title = inquiryOneLine(record.title) || id;
      for (const recipient of INQUIRY_NOTIFICATION_ROLES) {
        plan.notifications.push({
          
          id: JSON.stringify(["inquiry-sla", id, sla.cycleStartedAt, recipient.role, kind]),
          recordId: id,
          recipientRole: recipient.role,
          recipientLabel: recipient.label,
          recipientAddress: null,
          status: "disabled",
          inquiryStatus: sla.status,
          kind,
          latestIncomingAt: sla.latestIncomingAt,
          cycleStartedAt: sla.cycleStartedAt,
          deadlineAt: sla.deadlineAt,
          deadlineDate: sla.deadlineDate,
          timeZone: INQUIRY_SLA_POLICY.timeZone,
          subject: "[Garraway F\u30FB\u8A66\u7B97\u30FB\u672A\u9001\u4FE1] " + (sla.overdue ? "\u554F\u3044\u5408\u308F\u305B\u8FD4\u4FE1\u671F\u9650\u8D85\u904E\uFF1A" : "\u554F\u3044\u5408\u308F\u305B\u8FD4\u4FE1\u5F85\u3061\uFF1A") + title,
          body: [
            "\u901A\u77E5\u8A08\u753B\u306E\u78BA\u8A8D\u7528\u3067\u3059\u3002\u9001\u4FE1\u30FB\u4E88\u7D04\u306F\u3055\u308C\u307E\u305B\u3093\u3002",
            "\u5BFE\u8C61\uFF1A" + title,
            "\u5BFE\u5FDC\u958B\u59CB\u306E\u554F\u3044\u5408\u308F\u305B\uFF1A" + sla.cycleStartedAt,
            "\u6700\u65B0\u53D7\u4FE1\uFF1A" + sla.latestIncomingAt,
            "\u8FD4\u4FE1\u671F\u9650\u65E5\uFF1A" + sla.deadlineDate + "\uFF08Asia/Tokyo\u30FB\u5F53\u65E5\u4E2D\uFF09",
            "\u53D7\u4FE1\u65E5\u30920\u65E5\u76EE\u3068\u3057\u3066\u5E73\u65E5\u30923\u65E5\u52A0\u7B97\u3057\u3001\u671F\u9650\u65E5\u5F53\u65E5\u4E2D\u307E\u3067\u3068\u3057\u307E\u3059\u3002\u571F\u65E5\u306E\u307F\u9664\u5916\u3057\u3001\u795D\u65E5\u306F\u542B\u307F\u307E\u3059\u3002",
            "\u5B9B\u5148\u306E\u672C\u4EBA\u30FB\u30A2\u30C9\u30EC\u30B9\u3068\u9001\u4FE1\u30A2\u30AB\u30A6\u30F3\u30C8\u306F\u672A\u78BA\u8A8D\u3067\u3059\u3002"
          ].join("\n")
        });
      }
    }
    return plan;
  }
  var inquiryNotificationAdapters = Object.freeze({
    email: Object.freeze({
      configuration: INQUIRY_NOTIFICATION_DELIVERY,
      send(_notification) {
        return { status: "blocked", sent: false, reason: INQUIRY_NOTIFICATION_DELIVERY.reason };
      }
    }),
    scheduler: Object.freeze({
      configuration: INQUIRY_NOTIFICATION_DELIVERY,
      schedule(_plan) {
        return { status: "blocked", scheduled: false, reason: INQUIRY_NOTIFICATION_DELIVERY.reason };
      }
    })
  });
  var INQUIRY_SAMPLE_RECORDS = Object.freeze([
    Object.freeze({ id: "inquiry-sample-new", title: "\u67B6\u7A7A\u306E\u5F53\u65E5\u554F\u3044\u5408\u308F\u305B", receivedAt: "2026-10-09T10:00:00+09:00", lastResponseAt: null, sample: true }),
    Object.freeze({ id: "inquiry-sample-pending", title: "\u67B6\u7A7A\u306E\u8FD4\u4FE1\u5F85\u3061\u554F\u3044\u5408\u308F\u305B", receivedAt: "2026-10-08T10:00:00+09:00", lastResponseAt: null, sample: true }),
    Object.freeze({ id: "inquiry-sample-overdue", title: "\u67B6\u7A7A\u306E\u671F\u9650\u8D85\u904E\u554F\u3044\u5408\u308F\u305B", receivedAt: "2026-10-05T10:00:00+09:00", lastResponseAt: null, sample: true }),
    Object.freeze({ id: "inquiry-sample-unknown", title: "\u67B6\u7A7A\u306E\u5C65\u6B74\u672A\u78BA\u8A8D\u554F\u3044\u5408\u308F\u305B", receivedAt: null, sample: true })
  ]);

  
  var DEFINITIONS = [
    { id: "reportInquiry", title: "\u554F\u3044\u5408\u308F\u305B\u3092\u5973\u5C06\u30FB\u30C8\u30E8\u30BF\u3078\u5831\u544A", phase: 0, role: "\u904B\u55B6", internal: true },
    { id: "sendPack", title: "\u540C\u610F\u66F8\u30FB\u5BE9\u67FB\u30D5\u30A9\u30FC\u30E0\u30FB\u30D2\u30A2\u30EA\u30F3\u30B0\u3092\u6848\u5185", phase: 0, role: "\u904B\u55B6" },
    { id: "sendCooperation", title: "\u30A2\u30F3\u30B1\u30FC\u30C8\u30FB\u65BD\u8A2D\u7D39\u4ECB\u3078\u306E\u5354\u529B\u3092\u6848\u5185", phase: 0, role: "\u904B\u55B6" },
    { id: "screening", title: "\u4E8B\u524D\u5BE9\u67FB\u30D5\u30A9\u30FC\u30E0\u3092\u53D7\u9818", phase: 0, role: "\u4E3B\u50AC\u8005" },
    { id: "hearing", title: "\u8A73\u7D30\u30D2\u30A2\u30EA\u30F3\u30B0\u3092\u53D7\u9818", phase: 0, role: "\u4E3B\u50AC\u8005" },
    { id: "consent", title: "\u4E3B\u50AC\u8005\u304C\u624B\u52D5\u540C\u610F\u3057\u305F\u540C\u610F\u66F8\u3092\u53D7\u9818", phase: 0, role: "\u4E3B\u50AC\u8005" },
    { id: "doubleCheck", title: "\u30D2\u30A2\u30EA\u30F3\u30B0\u3092\u4E8C\u91CD\u30C1\u30A7\u30C3\u30AF", phase: 1, role: "\u904B\u55B6", internal: true, deps: ["hearing"] },
    { id: "approval", title: "\u8CAC\u4EFB\u8005\u306E\u6700\u7D42\u627F\u8A8D\u3092\u8A18\u9332\uFF08\u958B\u50AC\u53EF\uFF09", phase: 1, role: "\u8CAC\u4EFB\u8005", internal: true, deps: ["screening", "hearing", "consent", "doubleCheck"] },
    { id: "approvalMail", title: "\u627F\u8A8D\u30E1\u30FC\u30EB\u306E\u9001\u4FE1\u3092\u8A18\u9332", phase: 1, role: "\u904B\u55B6", deps: ["approval"] },
    { id: "sendGuides", title: "\u539F\u72B6\u5FA9\u5E30\u30FB\u30A2\u30D7\u30EA\u30FB\u30EC\u30A4\u30A2\u30A6\u30C8\u3092\u6848\u5185", phase: 2, role: "\u904B\u55B6", offset: -7, deps: ["approvalMail"] },
    { id: "sendQr", title: "\u65BD\u8A2D\u7D39\u4ECB\u753B\u50CF\u30FB\u6587\u7AE0\u30FB\u30A2\u30F3\u30B1\u30FC\u30C8QR\u3092\u6848\u5185", phase: 2, role: "\u904B\u55B6", offset: -7, deps: ["approvalMail"] },
    { id: "space", title: "\u5229\u7528\u30B9\u30DA\u30FC\u30B9\u30FB\u30EC\u30A4\u30A2\u30A6\u30C8\u3092\u78BA\u8A8D", phase: 2, role: "\u4E3B\u50AC\u8005", offset: -5, deps: ["approvalMail"] },
    { id: "meeting", title: "\u4E8B\u524D\u6253\u5408\u305B\u30FB\u4F1A\u5834\u30EA\u30CF\u30FC\u30B5\u30EB", phase: 2, role: "\u904B\u55B6", offset: -3, deps: ["space"] },
    { id: "meetingShare", title: "\u6253\u5408\u305B\u5185\u5BB9\u3092\u30C1\u30FC\u30E0\u306B\u5171\u6709", phase: 2, role: "\u904B\u55B6", internal: true, offset: -3, deps: ["meeting"] },
    { id: "slides", title: "\u6295\u5F71\u8CC7\u6599\u3092\u4E8B\u524D\u5171\u6709", phase: 2, role: "\u4E3B\u50AC\u8005", offset: -3, deps: ["approvalMail"] },
    { id: "promo", title: "\u544A\u77E5\u753B\u50CF\u30FB\u6587\u7AE0\u30FB\u7533\u8FBC\u30D5\u30A9\u30FC\u30E0\u3092\u53D7\u9818", phase: 2, role: "\u4E3B\u50AC\u8005", offset: -7, deps: ["approvalMail"] },
    { id: "facebook", title: "FB\u30A4\u30D9\u30F3\u30C8\u30DA\u30FC\u30B8\u3092\u4F5C\u6210", phase: 2, role: "\u904B\u55B6", offset: -7, deps: ["promo"] },
    { id: "website", title: "HP\u30A4\u30D9\u30F3\u30C8\u60C5\u5831\u3092\u66F4\u65B0", phase: 2, role: "\u904B\u55B6", offset: -7, deps: ["promo"] },
    { id: "calendar", title: "Google\u30AB\u30EC\u30F3\u30C0\u30FC\u306B\u544A\u77E5\u30BF\u30B9\u30AF\u3092\u767B\u9332", phase: 2, role: "\u904B\u55B6", internal: true, offset: -7, deps: ["approvalMail"] },
    { id: "roles", title: "\u5F79\u5272\u5206\u62C5\u8868\u3092\u4F5C\u6210\u30FB\u5370\u5237", phase: 2, role: "\u904B\u55B6", internal: true, offset: -5, deps: ["approvalMail"] },
    { id: "announce3", title: "3\u65E5\u524D\u306E\u30A4\u30D9\u30F3\u30C8\u544A\u77E5", phase: 2, role: "\u904B\u55B6", offset: -3, deps: ["facebook", "website"] },
    { id: "announce1", title: "1\u65E5\u524D\u306E\u30A4\u30D9\u30F3\u30C8\u544A\u77E5", phase: 2, role: "\u904B\u55B6", offset: -1, deps: ["facebook", "website"] },
    { id: "hours", title: "\u55B6\u696D\u6642\u9593\u5909\u66F4\u306E\u304A\u77E5\u3089\u305B", phase: 2, role: "\u904B\u55B6", offset: -1, deps: ["approvalMail"] },
    { id: "pop", title: "\u30A4\u30D9\u30F3\u30C8\u30DC\u30FC\u30C9\u30FBPOP\u3092\u63B2\u793A", phase: 2, role: "\u904B\u55B6", offset: -1, deps: ["approvalMail"] },
    { id: "checkin", title: "\u5F53\u65E5\u306E\u53D7\u4ED8\u30FB\u5165\u9928\u3092\u78BA\u8A8D", phase: 3, role: "\u904B\u55B6", offset: 0, deps: ["approvalMail"] },
    { id: "restore", title: "\u539F\u72B6\u5FA9\u5E30\u30FB\u5B8C\u5168\u64A4\u53CE\u3092\u5831\u544A", phase: 3, role: "\u4E3B\u50AC\u8005", offset: 0, deps: ["checkin"] },
    { id: "restoreCheck", title: "\u539F\u72B6\u5FA9\u5E30\u3092\u78BA\u8A8D", phase: 3, role: "\u904B\u55B6", internal: true, offset: 0, deps: ["restore"] },
    { id: "restoreReport", title: "\u539F\u72B6\u5FA9\u5E30\u306E\u78BA\u8A8D\u7D50\u679C\u3092\u8CAC\u4EFB\u8005\u3078\u5831\u544A", phase: 3, role: "\u904B\u55B6", internal: true, offset: 0, deps: ["restoreCheck"] },
    { id: "report", title: "\u7D42\u4E86\u5831\u544A\u30FB\u5B9F\u65BD\u8CC7\u6599\u3092\u63D0\u51FA", phase: 4, role: "\u4E3B\u50AC\u8005", offset: 3, deps: ["restore"] },
    { id: "photos", title: "\u5199\u771F\u30FB\u5E83\u5831\u5229\u7528\u6761\u4EF6\u3092\u78BA\u8A8D", phase: 4, role: "\u4E3B\u50AC\u8005", offset: 3, deps: ["restore"] },
    { id: "archive", title: "\u5831\u544A\u78BA\u8A8D\u30FB\u5E83\u5831\u30FB\u5C65\u6B74\u5171\u6709\u3092\u5B8C\u4E86", phase: 4, role: "\u904B\u55B6", internal: true, offset: 5, deps: ["restoreReport", "report", "photos"] }
  ];

  
  var freezeStage = (stage, index) => Object.freeze({ ...stage, index, taskIds: Object.freeze(stage.substeps.flatMap((step) => step.taskIds)), substeps: Object.freeze(stage.substeps.map((step) => Object.freeze({ ...step, taskIds: Object.freeze([...step.taskIds]) }))) });
  var WORKFLOW_STAGES = Object.freeze([
    { id: "application", label: "\u4E8B\u524D\u7533\u3057\u8FBC\u307F", goal: "\u4F01\u753B\u306E\u5185\u5BB9\u3092\u7533\u8ACB\u3057\u3001\u554F\u3044\u5408\u308F\u305B\u3092\u5973\u5C06\u30FB\u30C8\u30E8\u30BF\u3078\u5171\u6709\u3059\u308B", substeps: [
      { id: "inquiry-sharing", label: "\u4F01\u753B\u76F8\u8AC7\u306E\u5171\u6709", taskIds: ["reportInquiry"] }
    ] },
    { id: "screening-documents", label: "\u8A73\u7D30\u3059\u308A\u5408\u308F\u305B", goal: "\u4E8B\u524D\u5BE9\u67FB\u30D5\u30A9\u30FC\u30E0\u30FB\u30D2\u30A2\u30EA\u30F3\u30B0\u30B7\u30FC\u30C8\u30FB\u540C\u610F\u66F8\u3092\u56DE\u53CE\u3057\u3001\u5185\u5BB9\u306E\u4E8C\u91CD\u30C1\u30A7\u30C3\u30AF\u3092\u7D42\u3048\u308B", substeps: [
      { id: "document-guidance", label: "\u66F8\u985E\u6848\u5185", taskIds: ["sendPack", "sendCooperation"] },
      { id: "screening-receipt", label: "\u4E8B\u524D\u5BE9\u67FB\u30D5\u30A9\u30FC\u30E0\u306E\u53D7\u9818\u30FB\u78BA\u8A8D", taskIds: ["screening"] },
      { id: "hearing-consent-collection", label: "\u30D2\u30A2\u30EA\u30F3\u30B0\u30FB\u540C\u610F\u66F8\u306E\u56DE\u53CE", taskIds: ["hearing", "consent"] },
      { id: "document-check", label: "\u56DE\u53CE\u5185\u5BB9\u306E\u78BA\u8A8D", taskIds: ["doubleCheck"] }
    ] },
    { id: "decision-notification", label: "\u627F\u8A8D", goal: "\u5973\u5C06\u30FB\u30C8\u30E8\u30BF\u306E\u6700\u7D42\u5224\u65AD\u3092\u8A18\u9332\u3057\u3001\u4E3B\u50AC\u8005\u3078\u306E\u7D50\u679C\u901A\u77E5\u3092\u78BA\u8A8D\u3059\u308B", substeps: [
      { id: "final-decision", label: "\u5973\u5C06\u30FB\u30C8\u30E8\u30BF\u306E\u6700\u7D42\u5224\u65AD", taskIds: ["approval"] },
      { id: "result-notification", label: "\u7D50\u679C\u901A\u77E5", taskIds: ["approvalMail"] }
    ] },
    { id: "preparation", label: "\u958B\u50AC\u6E96\u5099", goal: "\u5FC5\u8981\u306A\u6848\u5185\u30FB\u4F1A\u5834\u6E96\u5099\u30FB\u4E8B\u524D\u6253\u5408\u305B\u30FB\u30EA\u30CF\u30FC\u30B5\u30EB\u30FB\u544A\u77E5\u30FB\u5F79\u5272\u5206\u62C5\u3092\u6574\u3048\u308B", substeps: [
      { id: "preparation-guidance", label: "\u5229\u7528\u6848\u5185", taskIds: ["sendGuides", "sendQr"] },
      { id: "venue-roles", label: "\u4F1A\u5834\u30FB\u5F79\u5272\u78BA\u8A8D", taskIds: ["space", "roles"] },
      { id: "meeting-rehearsal", label: "\u4E8B\u524D\u30EA\u30CF\u30FC\u30B5\u30EB\u30FB\u8CC7\u6599\u5171\u6709", taskIds: ["meeting", "meetingShare", "slides"] },
      { id: "publicity-preparation", label: "\u544A\u77E5\u6E96\u5099", taskIds: ["promo", "facebook", "website", "calendar"] },
      { id: "publicity-announcements", label: "\u76F4\u524D\u544A\u77E5\u30FB\u63B2\u793A", taskIds: ["announce3", "announce1", "hours", "pop"] }
    ] },
    { id: "event-restoration", label: "\u5F53\u65E5", goal: "\u5F53\u65E5\u306E\u53D7\u4ED8\u30FB\u5165\u9928\u3092\u78BA\u8A8D\u3057\u3001\u539F\u72B6\u5FA9\u5E30\u30FB\u5B8C\u5168\u64A4\u53CE\u306E\u78BA\u8A8D\u3068\u8CAC\u4EFB\u8005\u3078\u306E\u5831\u544A\u3092\u7D42\u3048\u308B", substeps: [
      { id: "event-reception", label: "\u5F53\u65E5\u306E\u53D7\u4ED8\u30FB\u5165\u9928", taskIds: ["checkin"] },
      { id: "restoration-report", label: "\u539F\u72B6\u5FA9\u5E30\u30FB\u5B8C\u5168\u64A4\u53CE\u306E\u5831\u544A", taskIds: ["restore"] },
      { id: "restoration-verification", label: "\u539F\u72B6\u5FA9\u5E30\u306E\u78BA\u8A8D\u30FB\u8CAC\u4EFB\u8005\u5831\u544A", taskIds: ["restoreCheck", "restoreReport"] }
    ] },
    { id: "reporting", label: "\u7D50\u679C\u5831\u544A", goal: "\u7D42\u4E86\u5831\u544A\u30FB\u5B9F\u65BD\u8CC7\u6599\u3068\u5199\u771F\u306E\u5229\u7528\u6761\u4EF6\u3092\u78BA\u8A8D\u3057\u3001\u5E83\u5831\u30FB\u5C65\u6B74\u5171\u6709\u3092\u7D42\u3048\u308B", substeps: [
      { id: "report-submission", label: "\u7D42\u4E86\u5831\u544A\u30FB\u5B9F\u65BD\u8CC7\u6599\u30FB\u5199\u771F\u78BA\u8A8D", taskIds: ["report", "photos"] },
      { id: "report-archive", label: "\u5831\u544A\u78BA\u8A8D\u30FB\u5E83\u5831\u30FB\u5C65\u6B74\u5171\u6709", taskIds: ["archive"] }
    ] }
  ].map(freezeStage));
  var STAGE_LABELS = Object.freeze(WORKFLOW_STAGES.map((stage) => stage.label));
  var ROLE_LABELS = Object.freeze({ concierge: "\u30B3\u30F3\u30B7\u30A7\u30EB\u30B8\u30E5", reviewer: "\u5973\u5C06\u30FB\u30C8\u30E8\u30BF", applicant: "\u7533\u8ACB\u8005" });
  var definitions = new Map(DEFINITIONS.map((definition) => [definition.id, definition]));
  var taskLocations = new Map(WORKFLOW_STAGES.flatMap((stage) => stage.substeps.flatMap((step) => step.taskIds.map((id) => [id, { stageIndex: stage.index, substepId: step.id }]))));
  var memberId = (member) => member?.id ?? member?.subject ?? "";
  var memberFor = (members, id) => id ? members.find((member) => memberId(member) === id) : null;
  var validRole = (role) => Object.hasOwn(ROLE_LABELS, role) ? role : "unknown";
  var roleLabel = (role) => ROLE_LABELS[role] ?? "\u5F79\u5272\u672A\u78BA\u8A8D";
  var operationalDisplayTasks = (event) => event?.operationalProgress?.tasks ? event.operationalProgress.tasks.map((task) => ({ ...(event.tasks || []).find((t) => t.id === task.id) || {}, id: task.id, title: task.title, state: task.status === "recorded" ? "done" : "pending", needsReview: task.status === "needs-review", mine: event.canRecordOperationalFact === true, blockedBy: task.blockedBy, due: task.due, completedAt: task.completedAt, provenance: task.provenance })) : Array.isArray(event?.tasks) ? event.tasks : [];
  var taskList = operationalDisplayTasks;
  var pending = (task) => task?.state !== "done" || task?.needsReview === true || Boolean(task?.blockedBy?.length);
  var ready = (task) => Array.isArray(task?.blockedBy) && task.blockedBy.length === 0;
  var done = (task) => Boolean(task && task.state === "done" && task.needsReview !== true && ready(task));
  var taskDisplayTitles = Object.freeze({ screening: "\u4E8B\u524D\u5BE9\u67FB\u30D5\u30A9\u30FC\u30E0\u306E\u53D7\u9818\u30FB\u78BA\u8A8D" });
  function taskActorDetails(task, event = {}, members = []) {
    if (!task) return { id: "", label: "\u78BA\u8A8D\u304C\u5FC5\u8981", role: "unknown", roleLabel: roleLabel("unknown"), known: false, mine: false };
    if (event.operationalProgress && task.provenance) return { id: "", label: event.operationalStaff?.join("\u30FB") || "\u5171\u6709\u5229\u7528\u8005", role: "concierge", roleLabel: "\u5171\u6709\u904B\u7528", known: false, mine: task.mine === true };
    const definition = definitions.get(task.id);
    const submitted = definition?.role === "\u4E3B\u50AC\u8005" && task.state === "submitted";
    const id = (submitted ? event.caseHandler : event.taskAssignments?.[task.id]) || "";
    const member = memberFor(members, id);
    const role = member ? validRole(member.role) : definition?.role === "\u4E3B\u50AC\u8005" && !submitted ? "applicant" : definition?.role === "\u8CAC\u4EFB\u8005" ? "reviewer" : submitted || definition?.role === "\u904B\u55B6" ? "concierge" : "unknown";
    const label = member?.label || member?.name || "";
    const mine = task.mine === true;
    let display = label ? `${label}\uFF08${roleLabel(role)}\uFF09` : mine ? "\u3042\u306A\u305F" : !id ? role === "applicant" ? "\u7533\u8ACB\u8005" : `${roleLabel(role)}\uFF08\u62C5\u5F53\u672A\u8A2D\u5B9A\uFF09` : `${roleLabel(role)}\uFF08\u6C0F\u540D\u672A\u78BA\u8A8D\uFF09`;
    if (!label && !mine && task.ownerLabel === "\u904B\u55B6\u304B\u3089\u306E\u78BA\u8A8D\u5F85\u3061") display = task.ownerLabel;
    if (label && mine) display += "\u30FB\u3042\u306A\u305F";
    return { id, label: display, role, roleLabel: roleLabel(role), known: Boolean(member), mine };
  }
  function taskActor(task, event = {}, members = []) {
    return taskActorDetails(task, event, members).label;
  }
  function eventActors(event = {}, members = []) {
    const assignments = event.taskAssignments ?? {}, ids = new Set([event.caseHandler, ...Object.values(assignments)].filter((id) => typeof id === "string" && id));
    return [...ids].map((id) => {
      const member = memberFor(members, id), role = member ? validRole(member.role) : "unknown";
      return { id, label: member?.label || member?.name || "\u6C0F\u540D\u672A\u78BA\u8A8D", role, roleLabel: roleLabel(role), taskIds: Object.entries(assignments).filter(([taskId, subject]) => subject === id && definitions.has(taskId)).map(([taskId]) => taskId), isCaseHandler: id === event.caseHandler, known: Boolean(member) };
    });
  }
  function presentWorkflow(event = {}, { members = [] } = {}) {
    const journey = event.journey ?? {};
    const unknown = !Number.isInteger(journey.stage) || journey.stage < 0 || journey.stage >= WORKFLOW_STAGES.length || event.source?.authenticatedWorkflow === false && !event.operationalProgress;
    const stageIndex = unknown ? null : journey.stage;
    const closed = Boolean(event.outcome && event.outcome !== "active" || event.source?.excludedFromActive === true);
    const needsReview = Boolean(journey.needsReview || event.changePending || taskList(event).some((task) => task.needsReview));
    const byId = new Map(taskList(event).filter((task) => definitions.has(task.id)).map((task) => [task.id, task]));
    const projectTask = (id) => {
      const task = byId.get(id);
      if (!task) return null;
      const definition = definitions.get(id), actorDetails = taskActorDetails(task, event, members);
      const source = event.source?.taskObservations?.[id];
      return { ...task, title: event.operationalProgress ? task.title : taskDisplayTitles[id] ?? task.title ?? definition.title, canonicalTitle: definition.title, sourceTitle: definition.title, ...taskLocations.get(id), actor: actorDetails.label, actorDetails, complete: !unknown && done(task), actionable: !unknown && !closed && pending(task) && ready(task), sourceHasField: task.sourceStatus !== void 0 || source !== void 0, sourceStatus: task.sourceStatus ?? source?.raw ?? "", sourceObservedState: task.sourceObservedState ?? source?.state ?? "unknown", sourceCombined: task.sourceCombined ?? source?.combined ?? false };
    };
    const stages = WORKFLOW_STAGES.map((stage) => {
      const substeps = stage.substeps.map((step) => {
        const tasks2 = step.taskIds.map(projectTask).filter(Boolean), completedCount2 = tasks2.filter((task) => task.complete).length, totalCount2 = step.taskIds.length, missingCount = totalCount2 - tasks2.length;
        const status = unknown || missingCount ? "unknown" : completedCount2 === totalCount2 ? "complete" : tasks2.some((task) => task.needsReview) ? "needs-review" : tasks2.some((task) => task.actionable) ? "pending" : "blocked";
        return { ...step, tasks: tasks2, status, completedCount: completedCount2, totalCount: totalCount2, missingCount, complete: status === "complete", current: false };
      });
      const completedCount = substeps.reduce((total, step) => total + step.completedCount, 0), totalCount = stage.taskIds.length;
      const complete2 = !unknown && substeps.every((step) => step.complete);
      return { ...stage, substeps, completedCount, totalCount, complete: complete2, current: stage.index === stageIndex, status: unknown ? "unknown" : complete2 ? "complete" : stage.index === stageIndex ? "current" : stage.index < stageIndex ? "incomplete" : "upcoming" };
    });
    const currentStage = stageIndex === null ? null : stages[stageIndex];
    const currentSubstep = currentStage?.substeps.find((step) => !step.complete) ?? null;
    if (currentSubstep) currentSubstep.current = true;
    const tasks = DEFINITIONS.map((definition) => projectTask(definition.id)).filter(Boolean);
    const actionableTasks = tasks.filter((task) => task.actionable);
    const outstandingEarlierTasks = stageIndex === null ? [] : tasks.filter((task) => task.stageIndex < stageIndex && !task.complete);
    const nextTask = actionableTasks.find((task) => task.mine) ?? actionableTasks[0] ?? null;
    const complete = Boolean(!unknown && !closed && !needsReview && journey.complete === true && stages.every((stage) => stage.complete));
    const nextAction = closed ? "\u3053\u306E\u6848\u4EF6\u306E\u5BFE\u5FDC\u306F\u7D42\u4E86\u3057\u3066\u3044\u307E\u3059" : unknown ? "\u539F\u7968\u3068\u30A2\u30D7\u30EA\u306E\u5DE5\u7A0B\u30FB\u62C5\u5F53\u3092\u7167\u5408\u3059\u308B" : complete ? "\u3059\u3079\u3066\u306E\u78BA\u8A8D\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F" : nextTask ? `${event.changePending ? "\u5909\u66F4\u6848\uFF1A" : ""}${nextTask.title}` : "\u5148\u306B\u5FC5\u8981\u306A\u78BA\u8A8D\u30FB\u62C5\u5F53\u3092\u78BA\u8A8D\u3059\u308B";
    const nextActor = nextTask?.actor ?? (closed || complete ? "" : unknown ? "\u5DE5\u7A0B\u30FB\u62C5\u5F53\u672A\u78BA\u8A8D" : journey.waitingOn || "\u78BA\u8A8D\u304C\u5FC5\u8981");
    return { stageIndex, stageLabel: currentStage?.label ?? "\u539F\u7968\u30FB\u5DE5\u7A0B\u672A\u78BA\u8A8D", stageGoal: currentStage?.goal ?? "\u539F\u7968\u306E\u8A18\u9332\u3068\u8A8D\u8A3C\u6E08\u307F\u306E\u5DE5\u7A0B\u30FB\u62C5\u5F53\u3092\u7167\u5408\u3059\u308B", stages, currentStage, currentSubstep, tasks, nextTask, nextAction, nextActor, actionableTasks, outstandingEarlierTasks, actors: eventActors(event, members), complete, unknown, closed, needsReview };
  }

  
  var EVENT_TIME_ZONE = "Asia/Tokyo";
  var EVENT_SPACES = ["\u30EA\u30D3\u30F3\u30B0\u30E9\u30DC", "\u3082\u306E\u3065\u304F\u308A\u30E9\u30DC", "\u7CBE\u795E\u3068\u6642\u306E\u90E8\u5C4B"];
  var STAGE_LABELS2 = ["\u4E8B\u524D\u7533\u3057\u8FBC\u307F", "\u8A73\u7D30\u3059\u308A\u5408\u308F\u305B", "\u627F\u8A8D", "\u958B\u50AC\u6E96\u5099", "\u5F53\u65E5", "\u7D50\u679C\u5831\u544A"];
  var dateValid = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + "T00:00:00Z")) && (  new Date(s + "T00:00:00Z")).toISOString().slice(0, 10) === s;
  var normalizeSpace = (s) => ({ "\u30EA\u30D3\u30F3\u30B0": "\u30EA\u30D3\u30F3\u30B0\u30E9\u30DC", "\u30E2\u30CE\u3065\u304F\u308A": "\u3082\u306E\u3065\u304F\u308A\u30E9\u30DC" })[s] || (EVENT_SPACES.includes(s) ? s : "");
  function eventSlots(e) {
    if (["cancelled", "declined"].includes(e.outcome) || e.source?.excludedFromActive === true) return [];
    const out = [];
    const add = (c, basis2, index) => {
      if (c?.undecided || !dateValid(c?.date)) return;
      out.push({ ...c, eventId: e.id, title: e.common?.eventTitle || "", space: normalizeSpace(c.space), basis: basis2, candidateIndex: index });
    };
    const operational = e.operationalProgress;
    if (operational?.booking === "reported-confirmed" && [0, 1].includes(operational.candidateIndex)) {
      add(e.schedule?.candidates?.[operational.candidateIndex], "reported-confirmed", operational.candidateIndex);
      return out;
    }
    const priorReported = operational?.agreement;
    if (priorReported && [0, 1].includes(priorReported.candidateIndex)) add(priorReported.schedule?.candidates?.[priorReported.candidateIndex], "reported-prior", priorReported.candidateIndex);
    const agreed = e.changePending ? e.agreedConditions : null;
    if (agreed && [0, 1].includes(agreed.approvedCandidateIndex)) add(agreed.schedule?.candidates?.[agreed.approvedCandidateIndex], "confirmed", agreed.approvedCandidateIndex);
    if (e.booking === "confirmed" && [0, 1].includes(e.approvedCandidateIndex)) add(e.schedule?.candidates?.[e.approvedCandidateIndex], "confirmed", e.approvedCandidateIndex);
    else (e.schedule?.candidates || []).forEach((c, i) => add(c, e.changePending || priorReported ? "proposed" : "requested", i));
    return out;
  }
  function slotInterval(c) {
    if (!dateValid(c?.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.setupStart || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.clearEnd || "")) return null;
    if (![0, 1].includes(c.setupDay ?? 0) || ![0, 1].includes(c.clearEndDay ?? 0)) return null;
    const start = Date.parse(c.date + "T" + c.setupStart + ":00+09:00") + (c.setupDay || 0) * 864e5, end = Date.parse(c.date + "T" + c.clearEnd + ":00+09:00") + (c.clearEndDay || 0) * 864e5;
    return end > start ? { start, end } : null;
  }
  function conflictingSlots(a, b) {
    const x = slotInterval(a), y = slotInterval(b);
    return a.eventId !== b.eventId && Boolean(a.space && b.space && a.space === b.space && x && y && x.start < y.end && y.start < x.end);
  }
  function dayReservations(events, date, reservations = []) {
    if (!dateValid(date)) return [];
    const day = { start: Date.parse(date + "T00:00:00+09:00"), end: Date.parse(date + "T00:00:00+09:00") + 864e5 };
    const slots = [...events.flatMap(eventSlots), ...reservations.map((r) => ({ ...r, space: normalizeSpace(r.space), basis: r.basis === "confirmed" ? "confirmed" : "requested", eventId: r.eventId || r.id }))];
    return slots.filter((s) => {
      const i = slotInterval(s);
      return i ? i.start < day.end && day.start < i.end : s.date === date;
    }).map((s) => ({ ...s, conflicts: slots.filter((t) => conflictingSlots(s, t)).map((t) => ({ eventId: t.eventId, title: t.title, basis: t.basis })), checkNeeded: !s.space || !slotInterval(s) })).sort((a, b) => (slotInterval(a)?.start ?? Infinity) - (slotInterval(b)?.start ?? Infinity) || a.title.localeCompare(b.title, "ja"));
  }
  function taskActor2(t, e, members = []) {
    if (!t) return "\u78BA\u8A8D\u304C\u5FC5\u8981";
    const d = taskActorDetails(t, e, members), m = members.find((x) => (x.id || x.subject) === d.id);
    if (m) return m.label || d.roleLabel;
    if (d.role === "applicant") return "\u7533\u8ACB\u8005";
    if (d.role === "reviewer") return d.id ? "\u5973\u5C06\u30FB\u30C8\u30E8\u30BF" : "\u5973\u5C06\u30FB\u30C8\u30E8\u30BF\uFF08\u672A\u8A2D\u5B9A\uFF09";
    return d.id ? "\u30B3\u30F3\u30B7\u30A7\u30EB\u30B8\u30E5" : "\u62C5\u5F53\u672A\u8A2D\u5B9A";
  }
  function summarizeEvent(e, { now = (  new Date()).toISOString(), members = [] } = {}) {
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: EVENT_TIME_ZONE }).format(new Date(now));
    const slots = eventSlots(e), main = slots.find((s) => ["confirmed", "reported-confirmed", "reported-prior"].includes(s.basis)) || slots.find((s) => s.candidateIndex === 0) || slots[0] || null;
    const tasks = operationalDisplayTasks(e), open = tasks.filter((t) => t.state !== "done" || t.needsReview), ready2 = open.filter((t) => !t.blockedBy?.length), next = ready2[0] || open[0] || null, myNext = ready2.find((t) => t.mine) || null;
    const inquiry = e.inquiry ? evaluateInquirySla(e.inquiry, { now }) : { status: "unknown", reason: "\u30E1\u30FC\u30EB\u672A\u63A5\u7D9A\u30FB\u5FDC\u5BFE\u8A18\u9332\u306A\u3057", deadlineAt: null, receivedAt: null, lastResponseAt: null, trackingKnown: false };
    const overdue = open.filter((t) => dateValid(t.due) && t.due < today);
    const needsCheck = Boolean(e.changePending || e.journey?.needsReview || e.journey?.stage === null || tasks.some((t) => t.needsReview));
    const missingDue = open.some((t) => !dateValid(t.due)), missingOwner = open.some((t) => {
      const a = taskActorDetails(t, e, members);
      return a.role !== "applicant" && !a.id;
    });
    const verified = Boolean(tasks.length && !missingDue && !missingOwner && e.operationsReview?.checkedAt && e.operationsReview?.eventVersion === e.version && inquiry.trackingKnown && inquiry.status === "replied");
    const flags2 = [];
    if (overdue.length || inquiry.status === "overdue") flags2.push({ key: "delayed", label: "\u671F\u9650\u8D85\u904E" });
    if (needsCheck) flags2.push({ key: "review", label: "\u8981\u78BA\u8A8D" });
    if (["new", "unanswered", "overdue"].includes(inquiry.status)) flags2.push({ key: "unanswered", label: "\u8FD4\u4FE1\u5F85\u3061" });
    if (!verified && !needsCheck && !overdue.length && !["new", "unanswered", "overdue"].includes(inquiry.status)) flags2.push({ key: "unknown", label: "\u672A\u78BA\u8A8D" });
    if (missingDue) flags2.push({ key: "unknown", label: "\u671F\u9650\u672A\u8A2D\u5B9A" });
    if (missingOwner) flags2.push({ key: "unknown", label: "\u62C5\u5F53\u672A\u8A2D\u5B9A" });
    if (!flags2.length) flags2.push({ key: "ontrack", label: "\u78BA\u8A8D\u6E08\u30FB\u9806\u8ABF" });
    const health = flags2[0], stage = Number.isInteger(e.journey?.stage) ? STAGE_LABELS2[e.journey.stage] : "\u539F\u7968\u30FB\u5DE5\u7A0B\u672A\u78BA\u8A8D";
    return { id: e.id, title: e.common?.eventTitle || "\u540D\u79F0\u672A\u8A18\u5165", organizer: e.common?.responsibleName || "\u4E3B\u50AC\u8005\u672A\u8A18\u5165", attendance: e.common?.attendance || "\u672A\u78BA\u8A8D", space: main?.space || e.source?.spaceLabel || "\u30B9\u30DA\u30FC\u30B9\u672A\u78BA\u8A8D", main, slots, flags: flags2, health, stage, next, myNext, actor: e.operationalProgress && e.operationalStaff?.length ? e.operationalStaff.join("\u30FB") : e.source?.handlerRaw ? "\u539F\u7968\u62C5\u5F53\uFF1A" + e.source.handlerRaw + "\uFF08\u672A\u7167\u5408\uFF09" : taskActor2(next, e, members), inquiry, comment: e.internalNote || "\u30B3\u30E1\u30F3\u30C8\u306A\u3057", event: e, today };
  }
  function sortEvents(rows, order = "date", today = new Intl.DateTimeFormat("sv-SE", { timeZone: EVENT_TIME_ZONE }).format(  new Date())) {
    const rank = { delayed: 0, review: 1, unanswered: 2, unknown: 3, ontrack: 4 };
    return [...rows].sort((a, b) => {
      const ad = a.main?.date || "", bd = b.main?.date || "";
      if (order === "status") {
        const r = (rank[a.health.key] ?? 9) - (rank[b.health.key] ?? 9);
        if (r) return r;
      }
      if (order === "date-desc") return !ad && !bd ? a.title.localeCompare(b.title, "ja") : !ad ? 1 : !bd ? -1 : bd.localeCompare(ad) || a.title.localeCompare(b.title, "ja");
      const category = (d) => !d ? 2 : d >= today ? 0 : 1;
      return category(ad) - category(bd) || (category(ad) === 1 ? bd.localeCompare(ad) : ad.localeCompare(bd)) || a.title.localeCompare(b.title, "ja");
    });
  }

  
  var EVENT_SORT_COLUMNS = [["title", "\u30A4\u30D9\u30F3\u30C8\u540D"], ["organizer", "\u4E3B\u50AC\u8005"], ["date", "\u958B\u50AC\u65E5\u6642"], ["space", "\u30B9\u30DA\u30FC\u30B9"], ["attendance", "\u4EBA\u6570"], ["progress", "\u9032\u6357"], ["actor", "\u62C5\u5F53"], ["deadline", "\u671F\u9650"], ["next", "\u6B21\u306E\u884C\u52D5"], ["comment", "\u6CE8\u610F\u4E8B\u9805\u30FB\u5F15\u7D99\u304E"]];
  var collator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });
  function validDate(x) {
    return typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x + "T00:00:00Z")) && (  new Date(x + "T00:00:00Z")).toISOString().slice(0, 10) === x;
  }
  function value(row, key) {
    switch (key) {
      case "date":
        return validDate(row.main?.date) ? row.main.date + "T" + (row.main.eventStart || "00:00") : null;
      case "attendance":
        return /^\d+$/.test(String(row.attendance)) ? Number(row.attendance) : null;
      case "progress":
        return Number.isInteger(row.event.journey?.stage) ? row.event.journey.stage : null;
      case "deadline": {
        const d = row.inquiry.status !== "replied" && row.inquiry.deadlineDate ? row.inquiry.deadlineDate : row.next?.due;
        return validDate(d) ? d : null;
      }
      case "next":
        return row.myNext?.title || row.next?.title || null;
      case "comment":
        return row.event.internalNote?.trim() || null;
      case "space":
        return row.space === "\u30B9\u30DA\u30FC\u30B9\u672A\u78BA\u8A8D" ? null : row.space;
      case "actor":
        return /未設定|未確認/.test(row.actor) ? null : row.actor;
      default:
        return row[key] || null;
    }
  }
  function sortEventColumns(rows, key, direction = "ascending") {
    if (!EVENT_SORT_COLUMNS.some(([k]) => k === key)) return [...rows];
    const sign = direction === "descending" ? -1 : 1;
    return rows.map((row, index) => ({ row, index })).sort((a, b) => {
      const av = value(a.row, key), bv = value(b.row, key);
      if (av === null && bv === null) return a.index - b.index;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : collator.compare(String(av), String(bv));
      return sign * cmp || a.index - b.index;
    }).map((x) => x.row);
  }
  function nextColumnSort(current, key) {
    return { key, direction: current.key === key && current.direction === "ascending" ? "descending" : "ascending" };
  }

  
  var esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var stamp = (x) => x && Number.isFinite(Date.parse(x)) ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(x)) : "\u672A\u78BA\u8A8D";
  var shortDate = (d) => d ? d.slice(5).replace("-", "/") : "\u65E5\u4ED8\u672A\u78BA\u8A8D";
  var state = { staffView: "", q: "", sort: "date", columnSort: { key: "date", direction: "upcoming" }, health: "", period: "", space: "", actor: "", includeClosed: false, toolsOpen: false };
  var basis = (s) => s?.basis === "reported-prior" ? "\u4EE5\u524D\u306E\u78BA\u5B9A\u5831\u544A\u30FB\u518D\u78BA\u8A8D\u4E2D" : s?.basis === "reported-confirmed" ? "\u78BA\u5B9A\u306E\u5171\u6709\u8A18\u9332" : s?.basis === "confirmed" ? "\u78BA\u5B9A" : s?.basis === "proposed" ? "\u5909\u66F4\u5E0C\u671B" : "\u7B2C" + ((s?.candidateIndex ?? 0) + 1) + "\u5E0C\u671B";
  function sortMark(key) {
    return state.columnSort.key !== key ? "\u2195" : state.columnSort.direction === "upcoming" ? "\u8FD1\u3044\u9806" : state.columnSort.direction === "ascending" ? "\u2191" : "\u2193";
  }
  function sortButton(key, label) {
    return '<button type="button" data-sort-column="' + key + '" aria-label="' + label + "\u3067" + (state.columnSort.key === key && state.columnSort.direction === "ascending" ? "\u964D\u9806" : "\u6607\u9806") + '\u306B\u4E26\u3079\u66FF\u3048">' + label + ' <span aria-hidden="true">' + sortMark(key) + "</span></button>";
  }
  function badge(flag) {
    return '<span class="list-badge ' + flag.key + '">' + esc(flag.label) + "</span>";
  }
  function flags(row) {
    return (row.event.source ? '<span class="list-badge review">\u539F\u7968\uFF1A' + esc(row.event.source.statusRaw || "\u7A7A\u6B04") + "</span> " : "") + row.flags.map(badge).join(" ");
  }
  function deadline(row) {
    const reply = row.inquiry.deadlineAt;
    return (reply && row.inquiry.status !== "replied" ? '<span class="deadline-kind">\u8FD4\u4FE1</span> ' + esc(shortDate(row.inquiry.deadlineDate || reply.slice(0, 10))) : '<span class="deadline-kind">\u4F5C\u696D</span> ' + esc(row.next?.due ? shortDate(row.next.due) : "\u672A\u8A2D\u5B9A")) + (row.event.source?.decisionDueRaw ? "<small>\u539F\u7968\u306E\u53EF\u5426\u5224\u65AD " + esc(row.event.source.decisionDueRaw) + "</small>" : "");
  }
  function eventRow(row) {
    const s = row.main;
    const stageShort = row.event.journey?.complete ? "\u5B8C\u4E86" : ["\u4E8B\u524D\u7533\u3057\u8FBC\u307F", "\u8A73\u7D30\u3059\u308A\u5408\u308F\u305B", "\u627F\u8A8D", "\u958B\u50AC\u6E96\u5099", "\u5F53\u65E5", "\u7D50\u679C\u5831\u544A"][row.event.journey?.stage] || "\u539F\u7968\u78BA\u8A8D";
    const count = /^\d+$/.test(row.attendance) ? row.attendance + "\u4EBA" : row.attendance;
    return '<div role="row" class="event-row" data-open-event="' + esc(row.id) + '" tabindex="0" aria-label="' + esc(row.title) + ' \u306E\u8A73\u7D30"><div role="cell" class="event-title-cell"><button class="event-title" type="button" data-open-event="' + esc(row.id) + '" title="' + esc(row.title) + '">' + esc(row.title) + '</button></div><div role="cell" class="event-organizer-cell" title="' + esc(row.organizer) + '">' + esc(row.organizer) + '</div><div role="cell" class="event-schedule-cell">' + (s ? '<button type="button" class="date-button" aria-label="' + esc(s.date + " " + (s.eventStart || "\u672A\u5B9A") + "\u301C" + (s.eventEnd || "\u672A\u5B9A") + " " + basis(s) + "\uFF1A\u540C\u65E5\u306E\u5229\u7528\u3092\u78BA\u8A8D") + '" data-event-date="' + esc(s.date) + '" data-event-id="' + esc(row.id) + '"><b>' + shortDate(s.date) + '</b><span class="event-time"> ' + esc(s.eventStart || "\u672A\u5B9A") + "\u2013" + esc(s.eventEnd || "\u672A\u5B9A") + '</span></button><span class="date-basis ' + s.basis + '">' + basis(s) + "</span>" : '<span class="raw-date" title="' + esc(row.event.source?.scheduleRaw || "") + '">' + esc(row.event.source?.scheduleRaw || "\u65E5\u6642\u672A\u78BA\u8A8D") + "</span>") + '</div><div role="cell" class="event-space-cell" title="' + esc(row.space) + '">' + esc(row.space) + '</div><div role="cell" class="event-count-cell">' + esc(count) + '</div><div role="cell" class="event-progress-cell" title="' + esc(row.stage + " / " + row.flags.map((f) => f.label).join("\u30FB")) + '"><span class="stage-short">' + esc(stageShort) + "</span> " + flags(row) + '</div><div role="cell" class="event-actor-cell" title="' + esc(row.actor) + '">' + esc(row.actor) + '</div><div role="cell" class="event-deadline-cell">' + deadline(row) + '</div><div role="cell" class="event-next-cell"><span title="' + esc(row.myNext?.title || row.next?.title || "\u73FE\u5728\u306E\u62C5\u5F53\u3092\u78BA\u8A8D") + '">' + esc(row.myNext?.title || row.next?.title || "\u73FE\u5728\u306E\u62C5\u5F53\u3092\u78BA\u8A8D") + '</span></div><div role="cell" class="event-comment-cell"><span title="' + esc(row.comment) + '">' + (row.staffEvidence ? '<span class="staff-evidence-badge">' + esc(row.staffEvidence.label) + "</span> " : "") + esc(row.event.internalNote?.trim() || "\u2014") + "</span></div></div>";
  }
  function periodMatch(row, today) {
    if (!state.period) return true;
    const d = row.main?.date;
    if (!d) return false;
    if (state.period === "month") return d.slice(0, 7) === today.slice(0, 7);
    const start =   new Date(today + "T00:00:00Z");
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return d >= start.toISOString().slice(0, 10) && d < end.toISOString().slice(0, 10);
  }
  function render(events, config = {}) {
    events = events.filter((event) => event.isExercise !== true);
    const now = config.referenceTime || (  new Date()).toISOString(), rows = events.map((e) => summarizeEvent(e, { now, members: config.members })), today = rows[0]?.today || new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(now));
    const counts = Object.fromEntries(["delayed", "review", "unanswered", "unknown", "ontrack"].map((k) => [k, rows.filter((r) => r.flags.some((f) => f.key === k)).length])), q = state.q.normalize("NFKC").toLowerCase();
    const staffView = config.capabilities?.recordDecision === true ? state.staffView : "";
    const filteredInput = rows.filter((r) => (!staffView || sharedStaffEvidence(r.event, staffView).known) && (state.includeClosed || !["cancelled", "declined"].includes(r.event.outcome) && r.event.source?.excludedFromActive !== true) && (!state.health || r.flags.some((f) => f.key === state.health)) && periodMatch(r, today) && (!state.space || r.space === state.space) && (!state.actor || r.actor === state.actor) && (!q || (r.title + " " + r.organizer + " " + r.space).normalize("NFKC").toLowerCase().includes(q)));
    const filtered = state.columnSort.direction === "upcoming" ? sortEvents(filteredInput, "date", today) : sortEventColumns(filteredInput, state.columnSort.key, state.columnSort.direction);
    if (staffView) filtered.forEach((row) => row.staffEvidence = sharedStaffEvidence(row.event, staffView));
    const actors = [...new Set(rows.map((r) => r.actor))], countLabel = filtered.length === rows.length ? "\u5168" + rows.length + "\u4EF6" : filtered.length + "\uFF0F" + rows.length + "\u4EF6";
    const staffFilters = config.capabilities?.recordDecision === true ? '<div class="shared-staff-filters" aria-label="\u5BFE\u8C61\u306E\u8868\u793A\u5207\u66FF">' + [["", "\u5168\u4EF6"], ...Object.entries(SHARED_STAFF_LABELS)].map(([role, label]) => '<button type="button" data-staff-view="' + role + '" aria-pressed="' + (staffView === role) + '">' + label + "</button>").join("") + "</div>" : "";
    const staffFilterHelp = config.capabilities?.recordDecision === true ? '<details class="staff-view-help"><summary>\u8868\u793A\u5207\u66FF\u306E\u8AAC\u660E</summary><p class="meta staff-filter-status" role="status">\u8868\u793A\u3060\u3051\u3092\u5207\u308A\u66FF\u3048\u307E\u3059\u3002' + (staffView ? SHARED_STAFF_LABELS[staffView] + "\uFF1A\u78BA\u8A8D\u5F85\u3061\u30FB\u4F9D\u983C\u306E\u8A18\u9332 " + rows.filter((row) => sharedStaffEvidence(row.event, staffView).status === "pending").length + "\u4EF6 \uFF0F \u7D50\u679C\u306E\u8A18\u9332\u3042\u308A " + rows.filter((row) => sharedStaffEvidence(row.event, staffView).status === "recorded").length + "\u4EF6\u3002" : "") + "\u5BFE\u8C61\u306E\u8A18\u9332\u306A\u3057 " + rows.filter((row) => !Object.keys(SHARED_STAFF_LABELS).some((role) => sharedStaffEvidence(row.event, role).known)).length + "\u4EF6\u306F\u300C\u5168\u4EF6\u300D\u3067\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002</p></details>" : "";
    return '<section class="event-dashboard" aria-label="\u30A4\u30D9\u30F3\u30C8\u4E00\u89A7">' + staffFilters + (events.some((e) => e.loadError) ? '<p class="list-load-error" role="alert">' + events.filter((e) => e.loadError).length + "\u4EF6\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u8868\u793A\u306F\u4E00\u90E8\u306E\u307F\u3067\u3059\u3002\u300C\u518D\u8AAD\u307F\u8FBC\u307F\u300D\u3067\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002</p>" : "") + '<div class="list-summary"><strong>' + countLabel + "</strong>" + [["delayed", "\u671F\u9650\u8D85\u904E"], ["unanswered", "\u672A\u8FD4\u4FE1"], ["review", "\u8981\u78BA\u8A8D"], ["unknown", "\u672A\u78BA\u8A8D"], ["ontrack", "\u9806\u8ABF"]].map(([k, label]) => '<button type="button" data-health-filter="' + k + '" ' + (state.health === k ? 'aria-pressed="true"' : 'aria-pressed="false"') + ">" + label + " <b>" + counts[k] + "</b></button>").join("") + '</div><div class="list-tools" data-expanded="' + state.toolsOpen + '"><button class="list-tools-toggle" type="button" aria-expanded="' + state.toolsOpen + '" data-toggle-list-tools>\u7D5E\u308A\u8FBC\u307F\u30FB\u4E26\u3073\u66FF\u3048 <span>' + esc(EVENT_SORT_COLUMNS.find(([k]) => k === state.columnSort.key)?.[1] || "\u958B\u50AC\u65E5\u6642") + '</span></button><div class="list-tools-content"><div class="click-filter-bar"><div class="period-filters" aria-label="\u958B\u50AC\u6642\u671F">' + [["", "\u3059\u3079\u3066"], ["week", "\u4ECA\u9031"], ["month", "\u4ECA\u6708"]].map(([k, l]) => '<button type="button" data-period-filter="' + k + '" aria-pressed="' + (state.period === k) + '">' + l + "</button>").join("") + '</div><label>\u5834\u6240<select id="event-space-filter"><option value="">\u3059\u3079\u3066\u306E\u5834\u6240</option>' + EVENT_SPACES.map((x) => "<option " + (state.space === x ? "selected" : "") + ">" + x + "</option>").join("") + '</select></label><label>\u62C5\u5F53<select id="event-actor-filter"><option value="">\u3059\u3079\u3066\u306E\u62C5\u5F53</option>' + actors.map((x) => "<option " + (state.actor === x ? "selected" : "") + ">" + esc(x) + "</option>").join("") + '</select></label><button type="button" data-clear-list-filters>\u7D5E\u8FBC\u3092\u89E3\u9664</button><button type="button" data-notification-preview>\u901A\u77E5\u30D7\u30EC\u30D3\u30E5\u30FC</button></div><div class="secondary-filters"><details class="compact-sort-options"><summary>\u4E26\u3073\u66FF\u3048\uFF1A' + esc(EVENT_SORT_COLUMNS.find(([k]) => k === state.columnSort.key)?.[1] || "\u958B\u50AC\u65E5\u6642") + " " + sortMark(state.columnSort.key) + '</summary><div class="compact-sort-buttons">' + EVENT_SORT_COLUMNS.map(([key, label]) => sortButton(key, label)).join("") + "</div></details><details " + (state.q ? "open" : "") + '><summary>\u6587\u5B57\u3067\u691C\u7D22</summary><label>\u30A4\u30D9\u30F3\u30C8\u540D\u30FB\u4E3B\u50AC\u8005<input id="event-list-search" type="search" value="' + esc(state.q) + '"></label></details><label class="closed-toggle"><input type="checkbox" id="include-closed" ' + (state.includeClosed ? "checked" : "") + '>\u53D6\u6D88\u30FB\u898B\u9001\u308A\u3082\u8868\u793A</label></div></div></div><div class="event-table-wrap" role="region" aria-label="\u30A4\u30D9\u30F3\u30C8\u4E00\u89A7\u30FB\u30B9\u30AF\u30ED\u30FC\u30EB" tabindex="0"><div class="event-table one-line-table" role="table" aria-label="\u30A4\u30D9\u30F3\u30C8\u4E00\u89A7"><div class="event-table-header" role="row">' + EVENT_SORT_COLUMNS.map(([key, label]) => '<div role="columnheader" aria-sort="' + (key === state.columnSort.key ? state.columnSort.direction === "upcoming" ? "other" : state.columnSort.direction : "none") + '">' + sortButton(key, label) + "</div>").join("") + '</div><div role="rowgroup">' + filtered.map(eventRow).join("") + "</div></div></div>" + (filtered.length ? "" : '<p class="list-empty">\u6761\u4EF6\u306B\u5408\u3046\u30A4\u30D9\u30F3\u30C8\u306F\u3042\u308A\u307E\u305B\u3093\u3002</p>') + '<p class="list-explainer">' + (config.referenceTime ? "\u67B6\u7A7A\u30C7\u30FC\u30BF \u00B7 10/10 09:00 \u6642\u70B9 \u00B7 " : "") + "JST \u00B7 \u65E5\u4ED8\u304B\u3089\u540C\u65E5\u306E\u5229\u7528\u3092\u78BA\u8A8D \u00B7 \u5E0C\u671B\u306F\u672A\u78BA\u5B9A" + (state.health ? ' \u00B7 <button type="button" data-clear-health>\u72B6\u614B\u306E\u7D5E\u8FBC\u3092\u89E3\u9664</button>' : "") + "</p>" + staffFilterHelp + '<p class="list-footnote">\u672A\u78BA\u8A8D\u306F\u9806\u8ABF\u3068\u5224\u5B9A\u3057\u307E\u305B\u3093\u3002\u30E1\u30FC\u30EB\u30FB\u5916\u90E8\u4E88\u7D04\u306F\u672A\u63A5\u7D9A\u3067\u3059\u3002</p></section>';
  }
  function modal(title, body, onClose) {
    const node = document.createElement("div");
    node.className = "list-modal-backdrop";
    node.innerHTML = '<section class="list-modal" role="dialog" aria-modal="true" aria-labelledby="list-modal-title"><div class="modal-heading"><h2 id="list-modal-title">' + esc(title) + '</h2><button type="button" data-close-modal aria-label="\u9589\u3058\u308B">\u9589\u3058\u308B</button></div>' + body + "</section>";
    const previous = document.activeElement;
    function close() {
      node.remove();
      document.removeEventListener("keydown", key);
      previous?.focus();
      onClose?.();
    }
    function key(e) {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const controls = [...node.querySelectorAll("button,a,input,select")];
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    node.querySelector("[data-close-modal]").onclick = close;
    node.onclick = (e) => {
      if (e.target === node) close();
    };
    document.addEventListener("keydown", key);
    document.body.append(node);
    node.querySelector("button").focus();
    return node;
  }
  function showDay(events, date, config, eventId) {
    events = events.filter((event) => event.isExercise !== true || event.id === eventId);
    const rows = dayReservations(events, date, config.spaceReservations || []);
    const name = { confirmed: "\u78BA\u5B9A", requested: "\u5E0C\u671B\u30FB\u672A\u78BA\u5B9A", proposed: "\u5909\u66F4\u6848\u30FB\u672A\u5408\u610F" };
    modal(date + " \u306E\u30B9\u30DA\u30FC\u30B9\u5229\u7528", '<p class="modal-note">\u3053\u306E\u30A2\u30D7\u30EA\u306B\u767B\u9332\u3055\u308C\u305F\u4E88\u5B9A\u3092\u3001\u6E96\u5099\u958B\u59CB\u304B\u3089\u5B8C\u5168\u64A4\u53CE\u307E\u3067\u3067\u6BD4\u8F03\u3057\u307E\u3059\u3002\u5E0C\u671B\u540C\u58EB\u306E\u91CD\u306A\u308A\u3082\u8981\u8ABF\u6574\u3067\u3059\u3002Google\u30AB\u30EC\u30F3\u30C0\u30FC\u30FB\u5916\u90E8\u4E88\u7D04\u53F0\u5E33\u306F\u672A\u63A5\u7D9A\u306E\u305F\u3081\u3001\u7A7A\u304D\u306E\u78BA\u5B9A\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002</p><div class="space-key">' + EVENT_SPACES.map((s) => "<span>" + s + "</span>").join("") + '</div><div class="reservation-rows">' + rows.map((r) => '<article class="reservation-row ' + (r.eventId === eventId ? "selected" : "") + '"><div><b>' + esc(r.title) + '</b><span class="date-basis ' + r.basis + '">' + name[r.basis] + "</span></div><div>" + esc(r.space || "\u30B9\u30DA\u30FC\u30B9\u672A\u78BA\u8A8D") + " \u00B7 \u6E96\u5099 " + (r.setupDay ? "\u7FCC\u65E5 " : "") + esc(r.setupStart || "\u672A\u78BA\u8A8D") + " \u2192 \u958B\u50AC " + (r.eventStartDay ? "\u7FCC\u65E5 " : "") + esc(r.eventStart || "\u672A\u78BA\u8A8D") + "\u2013" + (r.eventEndDay ? "\u7FCC\u65E5 " : "") + esc(r.eventEnd || "\u672A\u78BA\u8A8D") + " \u2192 \u5B8C\u5168\u64A4\u53CE " + (r.clearEndDay ? "\u7FCC\u65E5 " : "") + esc(r.clearEnd || "\u672A\u78BA\u8A8D") + '</div><p class="' + (r.conflicts.length ? "conflict-note" : "") + '">' + (r.conflicts.length ? "\u91CD\u8907\u5019\u88DC\uFF1A" + r.conflicts.map((c) => esc(c.title) + "\uFF08" + name[c.basis] + "\uFF09").join("\u3001") : r.checkNeeded ? "\u6642\u523B\u30FB\u30B9\u30DA\u30FC\u30B9\u4E0D\u8DB3\u306E\u305F\u3081\u91CD\u8907\u3092\u5224\u5B9A\u3067\u304D\u307E\u305B\u3093" : "\u8868\u793A\u4E2D\u306E\u8A18\u9332\u3068\u306E\u91CD\u8907\u306A\u3057\uFF08\u5916\u90E8\u672A\u7167\u5408\uFF09") + "</p></article>").join("") + "</div>" + (rows.length ? "" : "<p>\u8868\u793A\u3067\u304D\u308B\u540C\u65E5\u306E\u8A18\u9332\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u5916\u90E8\u4E88\u7D04\u306E\u6709\u7121\u306F\u672A\u78BA\u8A8D\u3067\u3059\u3002</p>"));
  }
  function notificationPreview(events, config) {
    const result = planInquiryNotifications(events.map((e) => ({ id: e.id, title: e.common?.eventTitle, ...e.inquiry })), { now: config.referenceTime || (  new Date()).toISOString() });
    modal("\u554F\u3044\u5408\u308F\u305B\u30FB\u901A\u77E5\u306E\u30D7\u30EC\u30D3\u30E5\u30FC", '<p class="preview-off"><b>\u81EA\u52D5\u9001\u4FE1\u30FB\u5B9A\u671F\u901A\u77E5\u306F\u505C\u6B62\u4E2D</b><br>\u30E1\u30FC\u30EB\u30A2\u30AB\u30A6\u30F3\u30C8\u30FB\u53D7\u4FE1\u7BB1\u30FB\u9001\u4FE1\u5148\u30FB\u901A\u77E5\u6642\u523B\u3092\u78BA\u8A8D\u3057\u3066\u304B\u3089\u63A5\u7D9A\u3057\u307E\u3059\u3002\u3053\u3053\u3067\u958B\u3044\u3066\u3082\u9001\u4FE1\u3084\u4E88\u7D04\u306F\u884C\u3044\u307E\u305B\u3093\u3002</p><p>\u5BFE\u8C61\u5F79\u5272\uFF1A\u30B3\u30F3\u30B7\u30A7\u30EB\u30B8\u30E5\uFF0F\u5973\u5C06\uFF0F\u30C8\u30E8\u30BF\u3002\u672A\u8FD4\u4FE1\u3092\u53D7\u4FE1\u304B\u3089\u571F\u65E5\u3092\u9664\u304F3\u55B6\u696D\u65E5\u3067\u5224\u5B9A\u3057\u307E\u3059\u3002\u53EF\u5426\u5224\u65AD\u306E\u671F\u9650\u3068\u306F\u5225\u3067\u3059\u3002</p><div class="inquiry-preview-rows">' + events.map((e) => {
      const r = summarizeEvent(e, { now: config.referenceTime || (  new Date()).toISOString() });
      return "<p><b>" + esc(r.title) + "</b><span>" + esc({ new: "\u7533\u8ACB\u8005\u304B\u3089\u306E\u9023\u7D61\uFF1A\u8FD4\u4FE1\u5F85\u3061", unanswered: "\u7533\u8ACB\u8005\u304B\u3089\u306E\u9023\u7D61\uFF1A\u8FD4\u4FE1\u5F85\u3061", overdue: "\u8FD4\u4FE1\u671F\u9650\u8D85\u904E", replied: "\u8FD4\u4FE1\u6E08", unknown: "\u5FDC\u5BFE\u8A18\u9332\u672A\u78BA\u8A8D" }[r.inquiry.status]) + " \u00B7 \u53D7\u4FE1 " + stamp(r.inquiry.latestIncomingAt || r.inquiry.receivedAt) + " \u00B7 \u6700\u7D42\u8FD4\u4FE1 " + stamp(r.inquiry.lastResponseAt) + " \u00B7 \u8FD4\u4FE1\u671F\u9650 " + shortDate(r.inquiry.deadlineDate) + "</span></p>";
    }).join("") + "</div><details><summary>\u8A08\u7B97\u6761\u4EF6\u30FB\u63A5\u7D9A\u524D\u306E\u78BA\u8A8D</summary><p>Asia/Tokyo\u3002\u53D7\u4FE1\u65E5\u30920\u65E5\u76EE\u3068\u3057\u3066\u3001\u6B21\u306E\u5E73\u65E5\u304B\u3089\u6570\u3048\u305F3\u65E5\u76EE\u306E\u65E5\u4ED8\u304C\u671F\u9650\u3067\u3059\u3002\u571F\u65E5\u3060\u3051\u3092\u9664\u304D\u3001\u795D\u65E5\u306F\u9664\u5916\u3057\u3066\u3044\u307E\u305B\u3093\u3002\u671F\u9650\u65E5\u306E\u65E5\u672C\u6642\u959323:59\u307E\u3067\u304C\u671F\u9650\u5185\u3067\u3059\u3002</p><p>\u5B9F\u30E1\u30FC\u30EB\u306E\u53D7\u4FE1\u30FB\u8FD4\u4FE1\u8A18\u9332\u3001\u9001\u4FE1\u51483\u5F79\u5272\u306E\u5B9F\u30A2\u30C9\u30EC\u30B9\u3001\u901A\u77E5\u6642\u523B\u30FB\u983B\u5EA6\u3001OAuth\u3068\u5B9F\u884C\u6A29\u9650\u304C\u672A\u78BA\u8A8D\u3067\u3059\u3002\u8FD4\u4FE1\u6642\u523B\u4E0D\u660E\u306F\u8FD4\u4FE1\u6E08\u306B\u3082\u9806\u8ABF\u306B\u3082\u6271\u3044\u307E\u305B\u3093\u3002</p><p>\u30D7\u30EC\u30D3\u30E5\u30FC\u65B9\u5F0F\uFF1A" + esc(result.mode || "dry-run") + "\u3002\u5B9F\u9001\u4FE1\u306F\u7121\u52B9\u3067\u3059\u3002</p></details>");
  }
  function bind(container, events, config, onSelect, rerender) {
    container.querySelectorAll("[data-staff-view]").forEach((button) => button.onclick = () => {
      state.staffView = button.dataset.staffView;
      rerender();
      container.querySelector('[data-staff-view="' + state.staffView + '"]')?.focus();
    });
    events = events.filter((event) => event.isExercise !== true);
    container.querySelector("[data-toggle-list-tools]")?.addEventListener("click", () => {
      state.toolsOpen = !state.toolsOpen;
      const box = container.querySelector(".list-tools");
      box.dataset.expanded = String(state.toolsOpen);
      box.querySelector("button").setAttribute("aria-expanded", String(state.toolsOpen));
    });
    container.querySelectorAll("[data-open-event]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-event-date]")) return;
        ev.stopPropagation();
        onSelect(el.dataset.openEvent);
      });
      if (el.getAttribute("role") === "row") el.addEventListener("keydown", (ev) => {
        if (ev.target === el && ["Enter", " "].includes(ev.key)) {
          ev.preventDefault();
          onSelect(el.dataset.openEvent);
        }
      });
    });
    container.querySelectorAll("[data-event-date]").forEach((el) => el.onclick = (ev) => {
      ev.stopPropagation();
      showDay(events, el.dataset.eventDate, config, el.dataset.eventId);
    });
    container.querySelector("#event-space-filter").onchange = (e) => {
      state.space = e.target.value;
      rerender();
    };
    container.querySelector("#event-actor-filter").onchange = (e) => {
      state.actor = e.target.value;
      rerender();
    };
    container.querySelectorAll("[data-period-filter]").forEach((el) => el.onclick = () => {
      state.period = el.dataset.periodFilter;
      rerender();
    });
    container.querySelector("[data-clear-list-filters]").onclick = () => {
      state.staffView = "";
      state.period = "";
      state.space = "";
      state.actor = "";
      state.health = "";
      state.q = "";
      rerender();
    };
    container.querySelectorAll("[data-sort-column]").forEach((el) => el.onclick = () => {
      state.columnSort = nextColumnSort(state.columnSort, el.dataset.sortColumn);
      const key = el.dataset.sortColumn, compact = Boolean(el.closest(".compact-sort-options"));
      rerender();
      if (compact) container.querySelector(".compact-sort-options").open = true;
      container.querySelector((compact ? ".compact-sort-options" : ".event-table-header") + ' [data-sort-column="' + key + '"]')?.focus();
    });
    container.querySelector("#event-list-search").oninput = (e) => {
      state.q = e.target.value;
      const start = e.target.selectionStart;
      rerender();
      const field = container.querySelector("#event-list-search");
      field.focus();
      field.setSelectionRange(start, start);
    };
    container.querySelector("#include-closed").onchange = (e) => {
      state.includeClosed = e.target.checked;
      rerender();
    };
    container.querySelectorAll("[data-health-filter]").forEach((el) => el.onclick = () => {
      state.health = state.health === el.dataset.healthFilter ? "" : el.dataset.healthFilter;
      rerender();
    });
    container.querySelector("[data-clear-health]")?.addEventListener("click", () => {
      state.health = "";
      rerender();
    });
    container.querySelector("[data-notification-preview]").onclick = () => notificationPreview(events, config);
  }
  function taskRows(e, config) {
    if (e.operationalProgress) {
      const projected = operationalDisplayTasks(e);
      return '<section class="panel task-list-panel"><h2>\u904B\u7528\u4E8B\u5B9F\u306E\u8A18\u9332</h2><p class="meta">\u5171\u6709\u5229\u7528\u8005\u304C\u8A18\u9332\u3057\u305F\u4E8B\u5B9F\u3067\u3059\u3002\u5B9F\u65BD\u8005\u306E\u672C\u4EBA\u8A8D\u8A3C\u3084\u30A2\u30D7\u30EA\u306E\u9001\u4FE1\u8A3C\u660E\u306F\u3042\u308A\u307E\u305B\u3093\u3002</p><div class="sheet-record-rows">' + projected.map((t) => "<div><b>" + esc(t.title) + "</b><span>" + esc(t.needsReview ? "\u518D\u78BA\u8A8D\u304C\u5FC5\u8981" : t.state === "done" ? t.provenance === "shared-reported" ? "\u5171\u6709\u306E\u4E8B\u5B9F\u8A18\u9332\u3042\u308A" : "\u65E2\u5B58\u306E\u78BA\u8A8D\u6E08\u8A18\u9332" : "\u672A\u8A18\u9332") + "</span><span>" + esc(t.due || "\u671F\u9650\u672A\u8A2D\u5B9A") + "</span></div>").join("") + "</div></section>";
    }
    return '<section class="panel task-list-panel"><div class="task-list-heading"><h2>\u5168\u4F5C\u696D <span>' + e.tasks.length + '</span></h2><span>\u62C5\u5F53\u30FB\u671F\u9650\u30FB\u6B21\u306E\u884C\u52D5\u3092\u6A2A\u4E26\u3073\u3067\u78BA\u8A8D</span></div><div class="task-table-wrap"><table class="task-table"><thead><tr><th>\u4F5C\u696D</th><th>\u72B6\u614B</th><th>\u62C5\u5F53</th><th>\u671F\u9650</th><th>\u6B21\u306E\u884C\u52D5</th><th>\u30B3\u30E1\u30F3\u30C8\uFF0F\u539F\u7968\u306E\u8A18\u9332</th></tr></thead><tbody>' + e.tasks.map((t) => {
      const done2 = t.state === "done" && !t.needsReview;
      const comment = t.request || (t.sourceStatus !== void 0 ? "\u539F\u7968\uFF1A" + (t.sourceStatus || "\u7A7A\u6B04") + (t.sourceCombined ? "\uFF08\u5408\u7B97\u6B04\uFF09" : "") : "\u30B3\u30E1\u30F3\u30C8\u306A\u3057");
      const sourceDone = t.sourceObservedState === "done-recorded";
      const next = e.source ? sourceDone ? "\u539F\u7968\u4E0A\u306F\u8A18\u9332\u6E08" : "\u539F\u7968\u306E\u8A18\u9332\u3092\u53C2\u7167" : done2 ? "\u5B8C\u4E86" : t.blockedBy?.length ? "\u5148\u306B " + t.blockedBy[0] : t.mine ? "\u3053\u306E\u4F5C\u696D\u306B\u5BFE\u5FDC" : taskActor2(t, e, config.members) + "\u306E\u5BFE\u5FDC\u5F85\u3061";
      return '<tr data-task-row="' + t.id + '"><td><button type="button" ' + (e.source ? "data-source-task" : "data-focus-work") + '="' + t.id + '" title="' + esc(t.title) + '">' + esc(t.title) + "</button></td><td>" + esc(e.source ? t.sourceStatus === void 0 ? "\u539F\u7968\uFF1A\u72EC\u7ACB\u6B04\u306A\u3057" : "\u539F\u7968\uFF1A" + (t.sourceStatus || "\u7A7A\u6B04") + (t.sourceCombined ? "\uFF08\u5408\u7B97\uFF09" : "") : t.needsReview ? "\u8981\u518D\u78BA\u8A8D" : done2 ? "\u5B8C\u4E86" : t.state === "submitted" ? "\u53D7\u9818\u78BA\u8A8D\u5F85\u3061" : "\u672A\u5B8C\u4E86") + "</td><td>" + esc(taskActor2(t, e, config.members)) + "</td><td>" + esc(t.due || "\u672A\u8A2D\u5B9A") + '</td><td><span title="' + esc(next) + '">' + esc(next) + '</span></td><td><span title="' + esc(comment) + '">' + esc(comment) + "</span></td></tr>";
    }).join("") + "</tbody></table></div></section>";
  }
  function sheetReply(r) {
    const q = r.inquiry;
    if (!["new", "unanswered", "overdue"].includes(q.status)) return "";
    return '<div class="sheet-alert ' + (q.status === "overdue" ? "urgent" : "") + '"><strong>\u7533\u8ACB\u8005\u304B\u3089\u306E\u9023\u7D61\uFF1A\u8FD4\u4FE1\u5F85\u3061' + (q.status === "overdue" ? "\uFF08\u671F\u9650\u8D85\u904E\uFF09" : "") + "</strong><span>\u8FD4\u4FE1\u671F\u9650 " + esc(q.deadlineDate || "\u672A\u78BA\u8A8D") + " \uFF0F \u53D7\u4FE1 " + stamp(q.cycleStartedAt || q.receivedAt) + " \uFF0F \u6700\u7D42\u8FD4\u4FE1 " + stamp(q.lastResponseAt) + "</span></div>";
  }
  function flowShape(state2 = "pending") {
    const colors = { current: ["#b62d70", "#942057"], complete: ["#edf5ef", "#8aa894"], incomplete: ["#fff3d9", "#c79130"], pending: ["#fbf8fa", "#d8c8d1"] }, [fill, stroke] = colors[state2] || colors.pending;
    return '<svg class="flow-shape" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M1 1H182L199 50L182 99H1L18 50Z" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.1" vector-effect="non-scaling-stroke"/></svg>';
  }
  function flowConnector(kind = "stage", second = false) {
    const end = kind === "substep" ? 75 : 84, start = kind === "substep" ? 25 : 16;
    return '<svg class="flow-return' + (second ? " second" : "") + '" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M' + end + " 0V10H" + start + 'V19" fill="none" stroke="#ad8b9e" stroke-width="1.3" vector-effect="non-scaling-stroke" stroke-linejoin="round"/><path d="M' + (start - 1.2) + " 16.5L" + start + " 21L" + (start + 1.2) + ' 16.5" fill="none" stroke="#97627e" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>';
  }
  function stageState(stage) {
    return stage.current ? "\u73FE\u5728" : stage.complete ? "\u5B8C\u4E86" : stage.status === "incomplete" ? "\u6B8B\u4F5C\u696D\u3042\u308A" : stage.status === "unknown" ? "\u672A\u78BA\u8A8D" : stage.completedCount ? "\u4E00\u90E8\u78BA\u8A8D\u6E08" : "\u672A\u7740\u624B";
  }
  function detailSummary(e, config) {
    const r = summarizeEvent(e, { now: config.referenceTime || (  new Date()).toISOString(), members: config.members }), flow = presentWorkflow(e, { members: config.members }), team = eventActors(e, config.members).filter((x) => x.role === "concierge");
    const teamText = e.operationalStaff?.length ? e.operationalStaff.join(" \uFF0F ") + "\uFF08\u904B\u7528\u4E0A\u306E\u8A18\u9332\uFF09" : team.length ? team.map((x) => (x.isCaseHandler ? "\u4E3B\u62C5\u5F53 " : "\u4F5C\u696D\u62C5\u5F53 ") + x.label).join(" \uFF0F ") : e.source?.handlerRaw ? "\u539F\u7968\u306E\u62C5\u5F53 " + e.source.handlerRaw + "\uFF08\u30A2\u30AB\u30A6\u30F3\u30C8\u672A\u7167\u5408\uFF09" : "\u30B3\u30F3\u30B7\u30A7\u30EB\u30B8\u30E5\u672A\u8A2D\u5B9A";
    const slotHTML = (x, index) => '<span class="sheet-date ' + (index ? "sheet-extra-date" : "sheet-main-date") + '"><span class="date-basis ' + x.basis + '">' + basis(x) + '</span><button type="button" class="date-button" data-event-date="' + esc(x.date) + '" data-event-id="' + esc(e.id) + '">' + esc(x.date) + " " + esc(x.eventStart || "\u672A\u5B9A") + "\u2013" + esc(x.eventEnd || "\u672A\u5B9A") + "</button><span>" + esc(x.space || "\u30B9\u30DA\u30FC\u30B9\u672A\u78BA\u8A8D") + "</span></span>";
    const schedule = r.slots.length ? slotHTML(r.slots[0], 0) + (r.slots.length > 1 ? '<details class="sheet-more-dates"><summary>\u4ED6\u306E\u5E0C\u671B\u65E5\u6642 ' + (r.slots.length - 1) + "\u4EF6</summary>" + r.slots.slice(1).map((x, i) => slotHTML(x, i + 1)).join("") + "</details>" : "") : "<span>" + esc(e.source?.scheduleRaw || "\u958B\u50AC\u65E5\u6642\u672A\u78BA\u8A8D") + "</span>";
    const earlier = (flow.outstandingEarlierTasks || flow.tasks.filter((t) => t.stageIndex < flow.stageIndex && !t.complete)).filter((t) => t.id !== config.focusedTaskId), errors = earlier.length ? '<div class="earlier-work"><b>\u524D\u5DE5\u7A0B\u306E\u672A\u5B8C\u4E86 ' + earlier.length + "\u4EF6</b>" + earlier.map((t) => '<button type="button" data-focus-work="' + t.id + '">' + esc(t.title) + "</button>").join("") + "</div>" : "";
    const stepState = (step) => step.complete ? "\u78BA\u8A8D\u6E08" : step.status === "unknown" ? "\u672A\u78BA\u8A8D" : step.status === "blocked" ? "\u5FC5\u8981\u306A\u78BA\u8A8D\u5F85\u3061" : "\u672A\u7740\u624B";
    const substeps = flow.currentStage ? '<div class="sheet-substeps-header"><h3>' + esc(flow.stageLabel) + ' \u306E\u5C0F\u624B\u9806</h3><span>\u4E26\u884C\u3067\u304D\u308B\u4F5C\u696D\u306F\u4E26\u884C\u3057\u3066\u9032\u3081\u307E\u3059</span></div><div class="substep-flow-wrap" data-count="' + flow.currentStage.substeps.length + '">' + flowConnector("substep") + (flow.currentStage.substeps.length > 4 ? flowConnector("substep", true) : "") + '<ol class="sheet-substeps" data-count="' + flow.currentStage.substeps.length + '">' + flow.currentStage.substeps.map((step, i) => {
      const actors = [...new Set(step.tasks.filter((t) => !t.complete).map((t) => t.actor.replace(/（コンシェルジュ）/g, "").replace(/・あなた/g, "")))];
      const target = step.tasks.find((t) => !t.complete && (t.mine || e.canManage));
      const content = "<b>" + esc(step.label) + '</b><span class="substep-state">' + (step.current ? "\u73FE\u5728 \u00B7 " : "") + stepState(step) + "</span><small>" + esc(actors.join(" \uFF0F ") || "\u78BA\u8A8D\u6E08") + "</small>";
      return '<li data-substep="' + step.id + '" data-state="' + (step.current ? "current" : step.complete ? "complete" : "pending") + '" ' + (step.current ? 'aria-current="step"' : "") + ' data-alert="' + (step.status === "needs-review") + '">' + flowShape(step.current ? "current" : step.complete ? "complete" : step.status === "needs-review" ? "incomplete" : "pending") + '<span class="substep-number">' + (step.complete ? "\u2713" : i + 1) + "</span>" + (target ? '<button type="button" class="substep-action" data-focus-work="' + target.id + '" title="' + esc(target.title) + '">' + content + "</button>" : "<div>" + content + "</div>") + "</li>";
    }).join("") + '</ol></div><details class="sheet-goal-details"><summary>\u3053\u306E\u5DE5\u7A0B\u306E\u5230\u9054\u70B9</summary><p class="sheet-stage-goal">' + esc(flow.stageGoal) + "</p></details>" : '<p class="source-evidence">\u539F\u7968\u306E\u5DE5\u7A0B\u306F\u672A\u78BA\u8A8D\u3067\u3059\u3002\u539F\u7968\u306E\u53EF\u5426\uFF1A' + esc(e.source?.statusRaw || "\u7A7A\u6B04") + "\u3002\u8A18\u9332\u6E08\u307F\u306E\u4F5C\u696D\u306E\u518D\u5165\u529B\u306F\u6C42\u3081\u307E\u305B\u3093\u3002</p>";
    return '<div class="detail-navigation"><button type="button" data-back-list>\u2190 \u30A4\u30D9\u30F3\u30C8\u4E00\u89A7\u3078</button><button type="button" data-sheet-refresh>\u518D\u8AAD\u307F\u8FBC\u307F</button></div><div class="sheet-event-heading"><p class="sheet-eyebrow">\u30A4\u30D9\u30F3\u30C8\u7BA1\u7406\u7968</p><h2>' + esc(r.title) + '</h2><details class="sheet-basic-details"><summary>\u4E3B\u50AC\u8005\u30FB\u62C5\u5F53\u306A\u3069</summary><div class="sheet-basic"><span><b>\u4E3B\u50AC\u8005</b> ' + esc(r.organizer) + "</span><span><b>\u4EBA\u6570</b> " + esc(r.attendance) + (/^\d+$/.test(r.attendance) ? "\u4EBA" : "") + "</span><span><b>\u30B3\u30F3\u30B7\u30A7\u30EB\u30B8\u30E5</b> " + esc(teamText) + '</span></div></details><div class="sheet-dates">' + schedule + "</div>" + (e.changePending ? '<p class="sheet-change">\u65E5\u7A0B\u30FB\u5185\u5BB9\u306E\u5909\u66F4\u6848\u3092\u78BA\u8A8D\u4E2D\u3067\u3059\u3002\u65E7\u78BA\u5B9A\u67A0\u306F\u3001\u65B0\u305F\u306A\u5408\u610F\u307E\u3067\u4FDD\u6301\u3057\u307E\u3059\u3002</p>' : "") + '</div><section class="sheet-process" aria-label="\u7533\u8ACB\u304B\u3089\u7D42\u4E86\u307E\u3067\u306E6\u5DE5\u7A0B"><div class="process-flow-wrap">' + flowConnector() + '<ol class="process-flow">' + flow.stages.map((stage, i) => '<li data-stage="' + i + '" data-state="' + stage.status + '" ' + (stage.current ? 'aria-current="step"' : "") + '><span class="journey-sr-only">\u5DE5\u7A0B' + (i + 1) + "</span>" + flowShape(stage.current ? "current" : stage.status) + '<span class="process-number">' + String(i + 1).padStart(2, "0") + '</span><strong><span class="stage-full-label">' + esc(stage.label) + '</span><span class="stage-mobile-label">' + esc(String(i + 1).padStart(2, "0") + stage.label) + "</span></strong><small>" + esc(stageState(stage)) + "</small></li>").join("") + "</ol></div>" + substeps + "</section>" + errors;
  }
  function sheetNotes(e, config) {
    const r = summarizeEvent(e, { now: config.referenceTime || (  new Date()).toISOString(), members: config.members });
    return sheetReply(r) + (e.internalNote?.trim() ? '<details class="sheet-handover"><summary>\u6CE8\u610F\u4E8B\u9805\u30FB\u5F15\u7D99\u304E</summary><p>' + esc(e.internalNote.trim()) + "</p></details>" : "");
  }
  function sheetRecords(e, config) {
    const flow = presentWorkflow(e, { members: config.members });
    return '<div class="sheet-record-selector"><label>\u78BA\u8A8D\u3059\u308B\u5DE5\u7A0B<select id="sheet-record-stage">' + flow.stages.map((x) => '<option value="' + x.index + '" ' + (x.index === (flow.stageIndex ?? 0) ? "selected" : "") + ">" + String(x.index + 1) + " " + esc(x.label) + "</option>").join("") + '</select></label></div><div id="sheet-stage-records">' + stageRecords(e, config, flow.stageIndex ?? 0) + "</div>";
  }
  function stageRecords(e, config, index) {
    const stage = presentWorkflow(e, { members: config.members }).stages[index];
    return '<div class="sheet-record-rows">' + (stage?.substeps.flatMap((s) => s.tasks) || []).map((t) => "<div><b>" + esc(t.title) + "</b><span>" + esc(e.operationalProgress ? t.needsReview ? "\u518D\u78BA\u8A8D\u304C\u5FC5\u8981" : t.complete ? t.provenance === "shared-reported" ? "\u5171\u6709\u306E\u4E8B\u5B9F\u8A18\u9332\u3042\u308A" : "\u65E2\u5B58\u306E\u78BA\u8A8D\u6E08\u8A18\u9332" : "\u672A\u8A18\u9332" : e.source ? "\u539F\u7968\uFF1A" + (t.sourceHasField === false ? "\u72EC\u7ACB\u6B04\u306A\u3057" : t.sourceStatus || "\u7A7A\u6B04") + (t.sourceCombined ? "\uFF08\u5408\u7B97\uFF09" : "") : t.complete ? "\u78BA\u8A8D\u6E08" : t.state === "submitted" ? "\u53D7\u9818\u78BA\u8A8D\u5F85\u3061" : t.needsReview ? "\u518D\u78BA\u8A8D\u304C\u5FC5\u8981" : "\u672A\u5B8C\u4E86") + "</span><span>" + esc(t.actor) + "</span>" + (!t.complete && !e.source ? '<button type="button" data-focus-work="' + t.id + '">\u3053\u306E\u4F5C\u696D\u3092\u898B\u308B</button>' : "") + "</div>").join("") + "</div>";
  }
  function focusContext(e, config, taskId) {
    const f = presentWorkflow(e, { members: config.members });
    const t = f.tasks.find((x) => x.id === taskId);
    return t && t.stageIndex < f.stageIndex ? "\u524D\u5DE5\u7A0B\u306E\u6B8B\u4F5C\u696D\u304B\u3089\u5BFE\u5FDC\u3057\u307E\u3059" : t && t.stageIndex > f.stageIndex ? "\u5148\u884C\u3057\u3066\u5BFE\u5FDC\u3067\u304D\u308B\u4F5C\u696D\u3067\u3059" : "";
  }
  function preparationDetails(e, config) {
    const r = summarizeEvent(e, { now: config.referenceTime || (  new Date()).toISOString(), members: config.members }), context = e.reviewContext || {}, flow = presentWorkflow(e, { members: config.members }), meeting = flow.tasks.find((t) => t.id === "meeting");
    const time = (slot, key, day) => slot[key] ? (slot[day] === 1 ? "\u7FCC\u65E5 " : "") + slot[key] : "\u672A\u78BA\u8A8D";
    const times = r.slots.map((slot) => '<div class="preparation-slot"><div><b>' + basis(slot) + "</b> " + esc(slot.date) + " \uFF0F " + esc(slot.space || "\u30B9\u30DA\u30FC\u30B9\u672A\u78BA\u8A8D") + '</div><ol class="day-timing"><li><span>\u6E96\u5099\u958B\u59CB</span><b>' + esc(time(slot, "setupStart", "setupDay")) + "</b></li><li><span>\u672C\u756A\u958B\u59CB</span><b>" + esc(time(slot, "eventStart", "eventStartDay")) + "</b></li><li><span>\u672C\u756A\u7D42\u4E86</span><b>" + esc(time(slot, "eventEnd", "eventEndDay")) + "</b></li><li><span>\u5B8C\u5168\u64A4\u53CE</span><b>" + esc(time(slot, "clearEnd", "clearEndDay")) + "</b></li></ol></div>").join("");
    const program = (items, label) => '<section class="preparation-section"><h4>' + label + "</h4>" + (items?.length ? '<ol class="day-program">' + items.map((p) => "<li><b>" + esc(time(p, "start", "startDay")) + "\u2013" + esc(time(p, "end", "endDay")) + "</b><span>" + esc(p.title || "\u5185\u5BB9\u672A\u78BA\u8A8D") + (p.note ? "<small>" + esc(p.note) + "</small>" : "") + "</span></li>").join("") + "</ol>" : '<p class="meta">\u5F53\u65E5\u306E\u9032\u884C\u306F\u672A\u78BA\u8A8D\u3067\u3059\u3002</p>') + "</section>";
    return '<div class="preparation-overview"><h4>\u4F1A\u5834\u3092\u4F7F\u3046\u6642\u9593</h4>' + (times || "<p>\u65E5\u4ED8\u30FB\u6642\u523B\u306F\u672A\u78BA\u8A8D\u3067\u3059\u3002</p>") + '<p class="meta">\u5E0C\u671B\u30FB\u5909\u66F4\u6848\u306F\u672A\u78BA\u5B9A\u3067\u3059\u3002\u6E96\u5099\u958B\u59CB\u304B\u3089\u5B8C\u5168\u64A4\u53CE\u307E\u3067\u3092\u78BA\u8A8D\u3057\u307E\u3059\u3002</p><dl class="preparation-facts"><dt>\u5FC5\u8981\u306A\u6A5F\u6750\u30FB\u8A2D\u55B6</dt><dd>' + esc(context.equipmentNote || "\u672A\u78BA\u8A8D") + "</dd><dt>\u4EBA\u54E1\u30FB\u652F\u63F4\u306E\u76F8\u8AC7</dt><dd>" + esc(context.supportNote || "\u672A\u78BA\u8A8D") + "</dd><dt>\u4E8B\u524D\u6253\u5408\u305B\u30FB\u30EA\u30CF\u30FC\u30B5\u30EB</dt><dd>\u4E88\u5B9A\u65E5\u6642\uFF1A\u672A\u78BA\u8A8D" + (meeting ? " \uFF0F \u5BFE\u5FDC\uFF1A" + esc(meeting.actor) + " \uFF0F \u4F5C\u696D\u306E\u8A18\u9332\uFF1A" + (e.source ? "\u539F\u7968\uFF1A" + (meeting.sourceHasField === false ? "\u72EC\u7ACB\u6B04\u306A\u3057" : esc(meeting.sourceStatus || "\u7A7A\u6B04")) : meeting.complete ? "\u78BA\u8A8D\u6E08" : meeting.needsReview ? "\u518D\u78BA\u8A8D\u304C\u5FC5\u8981" : "\u672A\u5B8C\u4E86") + (meeting.due ? " \uFF0F \u4F5C\u696D\u671F\u9650\uFF1A" + esc(meeting.due) : "") : "") + "</dd><dt>\u5F53\u65E5\u306E\u6CE8\u610F\u4E8B\u9805</dt><dd>" + esc(context.safetyNote || "\u672A\u78BA\u8A8D") + "</dd></dl>" + (e.changePending ? program(e.agreedConditions?.schedule?.program, "\u73FE\u5728\u306E\u5408\u610F\u306B\u57FA\u3065\u304F\u5F53\u65E5\u306E\u9032\u884C") : "") + program(e.schedule?.program, e.changePending ? "\u5909\u66F4\u6848\u306E\u5F53\u65E5\u306E\u9032\u884C\uFF08\u672A\u5408\u610F\uFF09" : "\u5F53\u65E5\u306E\u9032\u884C") + '<section class="preparation-section"><h4>\u672C\u756A\u307E\u3067\u306E\u6E96\u5099\u4E8B\u9805</h4>' + stageRecords(e, config, 3) + "</section></div>";
  }
  function showTaskRecord(t, e) {
    modal(t.title, "<p><b>\u539F\u7968\uFF1A" + esc(t.sourceStatus === void 0 ? "\u72EC\u7ACB\u6B04\u306A\u3057" : t.sourceStatus || "\u7A7A\u6B04") + (t.sourceCombined ? "\uFF08\u5408\u7B97\u6B04\uFF09" : "") + "</b></p><p>\u5143\u30B7\u30FC\u30C8\u306B\u6B8B\u308B\u8A18\u9332\u3092\u305D\u306E\u307E\u307E\u8868\u793A\u3057\u3066\u3044\u307E\u3059\u3002\u8A18\u9332\u6E08\u307F\u306E\u4F5C\u696D\u306E\u518D\u5B9F\u65BD\u3084\u518D\u5165\u529B\u3092\u6C42\u3081\u308B\u3082\u306E\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002</p><p>\u30A2\u30D7\u30EA\u4E0A\u306E\u8A18\u9332\uFF1A" + esc(t.state === "done" ? "\u78BA\u8A8D\u6E08" : "\u79FB\u884C\u30FB\u78BA\u8A8D\u30ED\u30B0\u306A\u3057") + "\u3002\u5143\u306E\u8A18\u9332\u3068\u533A\u5225\u3057\u3066\u4FDD\u6301\u3057\u307E\u3059\u3002</p><p>\u539F\u62C5\u5F53\uFF1A" + esc(e.source?.handlerRaw || "\u7A7A\u6B04") + "</p>");
  }
  window.GarrawayDashboard = { preparationDetails, sheetNotes, sheetRecords, stageRecords, focusContext, presentWorkflow, taskActor, showTaskRecord, render, bind, detailSummary, taskRows, showDay, summarizeEvent, sortEvents, dayReservations };
})();
;
function createApplicantTransport({runner,timeoutMs=58000}={}){
 const send=request=>new Promise((resolve,reject)=>{
 if(!runner){const e=Error('本番接続未設定');e.code='NOT_CONNECTED';reject(e);return;}
 let settled=false;const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};const timer=setTimeout(()=>{const e=Error('保存結果を確認できません。同じ操作として再確認してください');e.code='OUTCOME_UNKNOWN';finish(reject,e);},timeoutMs);
 runner.withSuccessHandler(result=>{if(result?.ok===true)finish(resolve,result.data);else{const e=Error(result?.error?.message||'処理できませんでした');e.code=result?.error?.code||'UNAVAILABLE';finish(reject,e);}}).withFailureHandler(()=>{const e=Error('接続できず、保存結果を確認できません。同じ操作として再確認してください');e.code='OUTCOME_UNKNOWN';finish(reject,e);}).workflowRpc(request);
 });
 
 
 
 let queue=Promise.resolve();
 const invoke=request=>{const result=queue.then(()=>send(request));queue=result.catch(()=>{});return result;};
 const transport=(path='',body)=>{
  const parts=path.split('/').filter(Boolean);const request=body?{...body,action:parts[1]||'submit',...(parts[0]?{id:parts[0]}:{}),key:body.key||crypto.randomUUID()}:{action:parts.length?'read':'list',...(parts[0]?{id:parts[0]}:{})};
  return invoke(request);
 };
 transport.readMany=ids=>invoke({action:'read-many',ids});
 transport.listSnapshot=()=>invoke({action:'list-snapshot'});
 return transport;
}

window.gfStartApplicantApp_=function(bootstrap,runner){document.querySelector("#config").textContent=JSON.stringify(bootstrap);window.garrawayTransport=createApplicantTransport({runner});
const config=JSON.parse(document.querySelector('#config').textContent);const app=document.querySelector('#app'),message=document.querySelector('#message');let selected=null,adminListOpen=true,adminEvents=[],busy=false,loading=false,readActivity=null,pendingCommand=null,renderGeneration=0,consentController=null,consentPending=false;const applicant=config.role==='applicant',sharedStaff=config.role==='shared-concierge';if(config.fields)config.fields.responsibleName='主催者のお名前';if(config.notice)document.querySelector('.notice').textContent=config.notice;document.body.classList.toggle('applicant',applicant);document.querySelector('#role').textContent=applicant?'申請者':config.role==='reviewer'?'女将・トヨタ':'コンシェルジュ';document.querySelector('#heading').textContent=applicant?'あなたの申請':config.role==='reviewer'?'イベント一覧・開催判断':'イベント一覧';document.querySelector('#nav').innerHTML=!applicant&&config.adminRoleUrls?Object.entries(config.adminRoleUrls).map(([role,url])=>'<a href="'+escHeader(url)+'" '+(config.role===role?'aria-current="page"':'')+'>'+ (role==='reviewer'?'女将・トヨタ':'コンシェルジュ')+'</a>').join(''):'';if(applicant)document.querySelector('#nav').innerHTML='<a href="./index.html">新しい申し込み</a><a href="./catalog/applicant.html">申請者向けカタログ</a>';function escHeader(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

if(typeof config.pageTitle==='string'&&config.pageTitle.length<=120)document.title=config.pageTitle;
if(typeof config.roleLabel==='string'&&config.roleLabel.length<=120)document.querySelector('#role').textContent=config.roleLabel;
if(typeof config.headingLabel==='string'&&config.headingLabel.length<=120)document.querySelector('#heading').textContent=config.headingLabel;
if(typeof config.auditIdentityNotice==='string'&&config.auditIdentityNotice.length<=1000){const identityNotice=document.createElement('p');identityNotice.id='authenticated-identity-notice';identityNotice.className='meta';identityNotice.textContent=config.auditIdentityNotice;document.querySelector('#message').before(identityNotice);}


if(sharedStaff){
 const header=document.querySelector('header'),notice=document.querySelector('.notice'),identity=document.querySelector('#authenticated-identity-notice'),logout=document.querySelector('#staff-logout');
 if(header){const help=document.createElement('details');help.className='staff-guidance';const summary=document.createElement('summary');summary.textContent='デモ・注意';help.append(summary);if(notice)help.append(notice);if(identity)help.append(identity);header.append(help);if(logout)header.append(logout);}
}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));


function initialEventHint(){
 const valid=value=>typeof value==='string'&&/^[A-Za-z0-9-]{1,80}$/.test(value)?value:null;
 if(Object.prototype.hasOwnProperty.call(config,'initialEventId'))return valid(config.initialEventId);
 try{const url=new URL(window.location.href);if(url.search.length>2048)return null;const values=url.searchParams.getAll('event');return values.length===1?valid(values[0]):null;}catch{return null;}
}
let initialEventId=initialEventHint(),initialEventResolved=false,openedInitialEvent=false;
const isOperating=e=>e.canProvideOperationalDetails===true;
function applicationControl(key,value){const long=['summary','purpose','understanding','impact'].includes(key);const max=key==='summary'?200:long?1000:key==='email'?254:120;return long?`<textarea name="${key}" rows="3" maxlength="${max}" required>${esc(value)}</textarea>`:`<input name="${key}" value="${esc(value)}" type="${key==='email'?'email':key==='phone'?'tel':key==='attendance'?'number':'text'}" ${key==='attendance'?'min="1" max="9999" step="1" inputmode="numeric"':''} maxlength="${max}" required>`;}
async function api(path='',body){if(typeof window.garrawayTransport!=='function')throw Error('接続を利用できません。');return window.garrawayTransport(path,body);}
const status=t=>t.needsReview?'再確認が必要':({done:'完了',submitted:'相手の確認待ち',pending:'未完了'}[t.state]);
const actionName=x=>({'hearing-updated':'詳細ヒアリングを保存','conditions-explained':'利用条件の説明を記録','applicant-consent-recorded':'申請者が原文と条件への同意を記録','contact-confirmed':'運営が連絡先を確認',submitted:'申請を提出',assignment:'担当を設定','common-updated':'申請者が共通情報を更新','internal-note':'内部メモを更新','operational-staff-updated':'運用担当者を更新','operational-fact-recorded':'実施・受領の事実を記録','decision-recorded':'判断・相談の事実を記録','review-context-updated':applicant?'申請の補足を更新':'受入判断の参考情報を更新'}[x]||x.replace('task-completed:','完了：').replace('applicant-submitted:','提出：').replace('returned:','差戻し：').replace('deadline:','期限変更：'));
function listReadStatus(generation,text){
 if(generation!==renderGeneration)return;
 let node=document.querySelector('#list-read-status');
 if(!node){node=document.createElement('p');node.id='list-read-status';node.className='meta';node.setAttribute('role','status');node.setAttribute('aria-live','polite');app.before(node);}
 node.hidden=!text;node.textContent=text;
}
function validListResults(cases,results){return Array.isArray(results)&&results.length===cases.length&&results.every((result,i)=>result&&['fulfilled','rejected'].includes(result.status)&&(result.status!=='fulfilled'||result.value?.id===cases[i].id));}
function validListSnapshot(snapshot){return snapshot&&Array.isArray(snapshot.cases)&&snapshot.cases.length<=100&&snapshot.cases.every(row=>row&&typeof row.id==='string'&&/^[A-Za-z0-9-]{1,80}$/.test(row.id))&&new Set(snapshot.cases.map(row=>row.id)).size===snapshot.cases.length&&validListResults(snapshot.cases,snapshot.results);}
async function loadListEvents(cases,generation){
 const loaded=[],transport=config.mode!=='local-fixture'?window.garrawayTransport:null;
 // Apps Script reads every table under one lock. Batch at most ten authorized
 // IDs at a time; other transports fall back to one read at a time, never 76.
 const batchSize=typeof transport?.readMany==='function'?10:1;
 for(let offset=0;offset<cases.length;offset+=batchSize){
  if(generation!==renderGeneration)return null;
  listReadStatus(generation,'イベント一覧を読み込んでいます… '+offset+' / '+cases.length+'件');
  const batch=cases.slice(offset,offset+batchSize);
  try{
   const results=batchSize===1?await Promise.allSettled([api('/'+batch[0].id)]):await transport.readMany(batch.map(row=>row.id));
   if(!validListResults(batch,results))throw Error('一覧の読込結果を確認できませんでした');
   loaded.push(...results);
  }catch(error){loaded.push(...batch.map(()=>({status:'rejected',reason:error})));}
 }
 return generation===renderGeneration?loaded:null;
}
function cancelRead(){readActivity?.cancel();readActivity=null;loading=false;listReadStatus(renderGeneration,'');document.querySelector('#refresh').disabled=busy||Boolean(pendingCommand)||consentPending;}
async function render(){
 if(consentPending){message.textContent='前の記録結果を、同じ操作として確認してから移動してください。';return;}
 const generation=++renderGeneration,inputSnapshot=window.GarrawayUx?.snapshot();
 readActivity?.cancel();loading=true;document.querySelector('#refresh').disabled=true;const activity=readActivity=window.GarrawayAsyncFeedback.begin('申請の最新状態を読み込んでいます…',{buttons:[document.querySelector('#refresh')],slow:'申請の読み込み結果を待っています。現在の入力は変えていません。'});
 listReadStatus(generation,'イベントを読み込んでいます…');
 try{
 let snapshot=null;
 // Deep links keep the existing authenticated-list-then-single-read path.
 const snapshotReader=config.mode!=='local-fixture'&&!applicant&&window.GarrawayDashboard&&adminListOpen&&!initialEventId&&window.garrawayTransport?.listSnapshot;
 if(typeof snapshotReader==='function'){
  try{snapshot=await snapshotReader();if(!validListSnapshot(snapshot))throw Error('一覧の読込結果を確認できませんでした');}
  catch(error){if(error.code!=='SNAPSHOT_LIMIT')throw error;listReadStatus(generation,'一覧を分けて読み込んでいます…');}
  if(generation!==renderGeneration)return;
 }
 const cases=snapshot?snapshot.cases:await api();if(generation!==renderGeneration)return;
 if(!initialEventResolved){initialEventResolved=true;if(initialEventId){if(cases.some(row=>row.id===initialEventId)){selected=initialEventId;adminListOpen=false;openedInitialEvent=true;}else message.textContent='指定の案件を表示できません。一覧から確認してください。';}initialEventId=null;}
 if(!applicant&&window.GarrawayDashboard&&adminListOpen){
  const loaded=snapshot?snapshot.results:await loadListEvents(cases,generation);if(!loaded||generation!==renderGeneration)return;adminEvents=loaded.map((r,i)=>r.status==='fulfilled'?r.value:{id:cases[i].id,version:cases[i].version,common:{eventTitle:cases[i].title,responsibleName:cases[i].organizerName},tasks:[],journey:{stage:null},loadError:true,internalNote:'この案件を読み込めません。再読み込みしてください。'});
  const paint=()=>{window.GarrawayOperationalAutosave?.current?.dispose();consentController?.dispose();consentController=null;document.querySelector('#heading').textContent=typeof config.headingLabel==='string'&&config.headingLabel.length<=120?config.headingLabel:'イベント一覧';app.classList.remove('event-detail');document.body.classList.remove('sheet-open');app.innerHTML=window.GarrawayDashboard.render(adminEvents,config);window.GarrawayDashboard.bind(app,adminEvents,config,id=>{if(adminEvents.find(e=>e.id===id)?.loadError){message.textContent='案件の読込に失敗しています。「再読み込み」で再試行してください。';return;}selected=id;focusedWork=null;adminListOpen=false;render().catch(error=>message.textContent=error.message);},paint);};paint();activity.finish('success','一覧を読み込みました。');return;
 }
 if(!selected&&cases.length)selected=(config.role==='reviewer'?cases.find(c=>c.myTasks?.some(t=>t.id==='approval')):null)?.id||cases[0].id;
 const eventId=selected,row=cases.find(x=>x.id===eventId);
 if(!row){const empty=()=>{app.innerHTML='<section class="panel empty-state"><h2>'+(applicant?'新しいイベントを申請する':'表示できる案件はありません')+'</h2><p>'+(applicant?'企画・希望日時・確認事項を4つの手順で入力します。':'担当案件が登録されると、次にする作業がここに表示されます。')+'</p></section>';if(applicant&&config.capabilities?.submit!==false){const b=document.createElement('button');b.className='primary';b.textContent='申請をはじめる';b.onclick=newApplication;app.append(b);}window.GarrawayUx?.bind(app);activity.finish('success','表示できる申請を確認しました。');};if(inputSnapshot&&window.GarrawayUx.changedSince(inputSnapshot))window.GarrawayUx.guard(empty);else empty();return;}
 const e=await api('/'+eventId);if(generation!==renderGeneration||selected!==eventId)return;
 const commit=()=>{if(generation!==renderGeneration)return;window.GarrawayOperationalAutosave?.current?.dispose();consentController?.dispose();consentController=null;selected=e.id;adminEvents=adminEvents.map(x=>x.id===e.id?e:x);app.classList.toggle('event-detail',!applicant&&Boolean(window.GarrawayDashboard));document.body.classList.toggle('sheet-open',!applicant&&Boolean(window.GarrawayDashboard));if(!applicant&&window.GarrawayDashboard)document.querySelector('#heading').textContent=typeof config.detailHeadingLabel==='string'&&config.detailHeadingLabel.length<=120?config.detailHeadingLabel:'イベント管理票';app.innerHTML=renderRolePage(e,row,cases);bind(e);bindRolePage(e);bindCaseSearch(cases);activity.finish('success','申請の最新状態を読み込みました。');};
 if(inputSnapshot&&window.GarrawayUx.changedSince(inputSnapshot))window.GarrawayUx.guard(commit,{onCancel:()=>{selected=document.querySelector('#case-select')?.value||selected;}});else commit();
 }catch(error){if(generation===renderGeneration){activity.finish('error','読み込めませんでした。現在の入力は残しています。再読み込みで確認してください。');throw error;}}finally{activity.cancel();if(generation===renderGeneration){loading=false;lockForSave();}listReadStatus(generation,'');}
}
let focusedWork=null;const caseFilters={q:"",date:"",status:"",owner:""};
const ownOpen=e=>e.tasks.filter(t=>t.mine&&(t.state!=='done'||t.needsReview));
const availableWork=e=>ownOpen(e).filter(t=>!t.blockedBy.length);
function casePicker(e,cases){const row=cases.find(c=>c.id===e.id)||{};return'<div class="case-context"><label for="case-select">'+(applicant?'確認する申請':'いま対応する案件')+'</label><select id="case-select">'+cases.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===e.id?'selected':'')+'>'+esc(c.title)+'</option>').join('')+'</select><p class="meta">'+esc((row.dateBasis==='confirmed'?'確定日：':'希望日：')+(row.eventDate||'未定'))+' ／ '+esc(e.common.attendance)+'人'+(e.isExercise?' ／ 架空の操作練習':'')+'</p></div>'+caseSearch(cases);}
function caseSearch(cases){const statuses=[...new Set(cases.map(c=>c.status).filter(Boolean))];return '<details class="case-search" '+(Object.values(caseFilters).some(Boolean)?'open':'')+'><summary>案件を探す・絞り込む</summary><label class="search-label" for="case-keyword">案件を探す</label><input id="case-keyword" type="search" placeholder="イベント名・主催者で検索" value="'+esc(caseFilters.q)+'"><details class="case-filter-panel"><summary>日付'+(applicant?'':'・担当')+'・状態で絞り込む</summary><div class="case-filter-fields"><label>開催日・希望日<input id="case-date" type="date" value="'+esc(caseFilters.date)+'"></label><label>状態<select id="case-status"><option value="">すべて</option>'+statuses.map(x=>'<option '+(caseFilters.status===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>'+(!applicant?'<label>対応する人<select id="case-owner"><option value="">すべて</option>'+[['mine','自分が対応'],['applicant','申請者待ち'],['concierge','コンシェルジュ待ち'],['reviewer','女将・トヨタ待ち'],['unassigned','担当未設定']].map(([value,label])=>'<option value="'+value+'" '+(caseFilters.owner===value?'selected':'')+'>'+label+'</option>').join('')+'</select></label>':'')+'</div></details><div id="case-results" class="case-results" aria-live="polite" hidden></div></details>';}
function bindCaseSearch(cases){const q=app.querySelector('#case-keyword'),date=app.querySelector('#case-date'),status=app.querySelector('#case-status'),owner=app.querySelector('#case-owner'),results=app.querySelector('#case-results');if(!q)return;const normalized=x=>String(x??'').normalize('NFKC').toLocaleLowerCase().trim();const update=()=>{caseFilters.q=q.value;caseFilters.date=date.value;caseFilters.status=status.value;caseFilters.owner=owner?.value||'';const active=Object.values(caseFilters).some(Boolean);results.hidden=!active;if(!active){results.replaceChildren();return;}const words=normalized(caseFilters.q).split(/\s+/).filter(Boolean),matches=cases.filter(c=>words.every(w=>normalized(c.title+' '+(c.organizerName||'')).includes(w))&&(!caseFilters.date||c.eventDate===caseFilters.date)&&(!caseFilters.status||c.status===caseFilters.status)&&(!caseFilters.owner||c.ownerCategory===caseFilters.owner));results.innerHTML='<div class="search-count"><strong>'+matches.length+'件</strong><button type="button" data-clear-search>条件をクリア</button></div>'+(matches.length?matches.map(c=>'<button type="button" class="case-result" data-select-case="'+esc(c.id)+'"><strong>'+esc(c.title)+'</strong><small>'+esc(c.organizerName||'主催者未記入')+' ／ '+esc(c.eventDate||'日時未定')+(c.dateBasis==='requested'?'（希望日）':'')+' ／ '+esc(c.status||'確認中')+'</small></button>').join(''):'<p>該当する案件がありません。キーワードや条件を変えてください。</p>');results.querySelector('[data-clear-search]').onclick=()=>{q.value='';date.value='';status.value='';if(owner)owner.value='';update();q.focus();};results.querySelectorAll('[data-select-case]').forEach(b=>b.onclick=()=>{const select=app.querySelector('#case-select');select.value=b.dataset.selectCase;select.dispatchEvent(new Event('change',{bubbles:true}));});};for(const control of [q,date,status,owner].filter(Boolean)){control.addEventListener(control===q?'input':'change',update);}update();}
function applicantStatus(e){
 const publicLabels=['事前申し込み','詳細すり合わせ','承認','開催準備','当日','結果報告'];
 const stage=Number.isInteger(e.journey?.stage)?e.journey.stage:1;
 const title=e.changePending?'変更した内容を確認中':e.booking==='confirmed'?(stage>=4?publicLabels[stage]:'開催が決まりました'):publicLabels[stage]||'申請の状況を確認中';
 return '<section class="panel applicant-progress" data-stage="'+stage+'"><p class="eyebrow">申請の状況</p><p class="public-status">'+esc(e.changePending?'変更した内容を確認中':e.applicantProgress?.status||title)+'</p><p>'+(e.booking==='confirmed'?'合意した内容と日程を確認して、準備を進めてください。':'ご案内が届くまでは、予約・開催は確定していません。')+'</p>'+(e.changePending?'<p class="change-review">変更案はまだ合意前です。以前の合意内容を下で確認できます。</p>':'')+'<details><summary>申請から終了までの流れ</summary><ol class="public-steps">'+publicLabels.map((label,i)=>'<li'+(i===stage?' aria-current="step"':'')+'><span class="public-step-number">'+String(i+1).padStart(2,'0')+'</span>'+label+'</li>').join('')+'</ol></details></section>';
}
function ownerName(t,e){if(!applicant&&window.GarrawayDashboard)return window.GarrawayDashboard.taskActor(t,e,config.members);if(t.mine)return 'あなた';if(applicant)return '運営からの確認待ち';if(t.ownerLabel==='申請者')return '申請者';const id=e.taskAssignments?.[t.id],member=config.members?.find(m=>m.id===id);if(t.id==='approval'||member?.role==='reviewer')return '女将・トヨタ';if(!id&&!e.caseHandler)return '担当未設定';return 'コンシェルジュ';}
function nextWork(e){const available=availableWork(e);return e.tasks.find(t=>t.id===focusedWork&&(t.mine||e.canManage)&&(t.state!=='done'||t.needsReview))||available[0]||null;}
function adminFocus(e){
 const reviewer=config.role==='reviewer',ready=availableWork(e),open=ownOpen(e),t=reviewer?(focusedWork?nextWork(e):open.find(t=>t.id==='approval')||nextWork(e)):nextWork(e);
 if(reviewer&&!t&&e.tasks.some(t=>t.id==='approval'&&t.state==='done'&&!t.needsReview))return '<section class="panel focus-panel"><p class="eyebrow">女将・トヨタの確認</p><h2>最終承認を記録しました</h2><p>'+(e.booking==='confirmed'?'承認通知が記録され、開催が確定しています。':'次はコンシェルジュの承認通知です。通知前のため、まだ開催は確定していません。')+'</p><button type="button" class="primary" data-show-followup>次に動く担当を確認する</button></section>';
 if(reviewer&&t?.id==='approval'){
  const blocked=t.blockedBy.length>0;
  if(!blocked)return '<section class="panel focus-panel" aria-label="あなたの次の対応"><p class="eyebrow">女将・トヨタとして、いまやること</p><button type="button" data-open-materials>判断材料を見る</button>'+task(t,e)+'</section>';
  return '<section class="panel focus-panel" aria-label="あなたの次の対応"><p class="eyebrow">女将・トヨタの確認</p><h2>'+(blocked?'開催判断の準備中':'この案件の開催を判断する')+'</h2><dl class="action-ownership"><dt>担当</dt><dd>あなた（女将・トヨタ）</dd><dt>期限</dt><dd>'+esc(t.due||'未設定')+'</dd></dl>'+(blocked?'<p class="request"><strong>まだ承認できません。</strong> 次の確認が必要です。</p><ul class="missing-checks">'+t.blockedBy.map(x=>'<li>'+esc(x)+'<small>'+esc(ownerName(e.tasks.find(y=>y.title===x)||{},e))+'の確認待ち</small></li>').join('')+'</ul><div class="actions approval-wait-actions"><button type="button" class="primary" data-open-materials>申請内容・判断材料を見る</button><button type="button" disabled aria-describedby="approval-wait-reason">最終承認（準備中）</button></div><p id="approval-wait-reason" class="meta">必要な確認が完了すると、開催候補を選んで判断できます。</p><button type="button" data-show-followup>誰の確認待ちかを見る</button>':'<p>申請内容と利用条件を確認し、開催する候補を選んでください。最終承認だけでは開催確定になりません。</p><button type="button" data-open-materials>判断材料を見る</button>'+task(t,e))+'</section>';
 }
 return '<section class="panel focus-panel" aria-label="あなたの次の対応"><p class="eyebrow">今やること（'+(reviewer?'女将・トヨタ':'コンシェルジュ')+'）</p>'+(t?(window.GarrawayDashboard?.focusContext(e,config,t.id)?'<p class="focus-context">'+esc(window.GarrawayDashboard.focusContext(e,config,t.id))+'</p>':'')+'<div class="focus-count"><span>今できる作業</span><b>'+ready.length+'</b><span>件</span></div>'+task(t,e):'<h2>いま行う作業はありません</h2><p>必要な提出・確認が届くと、ここに次の作業が表示されます。</p><button type="button" class="primary" data-show-followup>待っている作業を確認する</button>')+'</section>';
}
function applicantFocus(e){const t=nextWork(e);if(t?.id==='hearing'&&e.consentWorkflow?.version===1)return window.GarrawayConsent.hearingFocus(e,t);if(e.consentWorkflow?.version===1&&(!t||t.id==='consent')&&e.booking!=='confirmed'&&e.journey?.complete!==true)return '<section class="panel focus-panel" aria-label="あなたの次の対応"><p class="eyebrow">次に進むための対応</p>'+window.GarrawayConsent.readinessNotice(e)+'<button type="button" data-open-application>申請内容を確認する</button></section>';if(t&&((t.id==='screening'&&t.request)||t.id==='hearing'))return '<section class="panel focus-panel" aria-label="あなたの次の対応"><p class="eyebrow">あなたが次にすること</p><h2>'+(t.id==='hearing'?'当日の詳しい内容を入力する':'申請内容を修正する')+'</h2>'+(t.request?'<p class="request">'+esc(t.request)+'</p>':'<p>機材・人員・準備と撤収について入力し、保存してから提出してください。</p>')+'<dl class="action-ownership"><dt>担当</dt><dd>あなた</dd><dt>期限</dt><dd>'+esc(t.due||'未設定')+'</dd></dl><div class="actions"><button type="button" class="primary" '+(t.id==='hearing'?'data-open-details':'data-open-application')+'>'+(t.id==='hearing'?'詳細を入力する':'申請内容を修正する')+'</button><button type="button" data-action="submit-task" data-id="'+t.id+'">'+(t.id==='hearing'?'入力を保存したら提出':'修正を保存したら再提出')+'</button></div><p class="meta">入力欄で保存してから、提出してください。提出後は運営の確認を待ちます。</p></section>';return '<section class="panel focus-panel" aria-label="あなたの次の対応"><p class="eyebrow">あなたが次にすること</p>'+(t?task(t,e):'<h2>いまはご案内をお待ちください</h2><p>追加の入力や提出が必要な場合は、この画面に表示します。</p><button type="button" class="primary" data-open-application>申請内容を確認する</button>')+'</section>';}
function workList(e){const current=nextWork(e),ready=availableWork(e).filter(t=>t.id!==current?.id),wait=e.tasks.filter(t=>(t.state!=='done'||t.needsReview)&&(!t.mine||t.blockedBy.length));return '<section class="work-list"><h2>ほかにできる作業 <span class="inline-count">'+ready.length+'</span></h2><div class="work-rows">'+ready.map(t=>'<button type="button" class="work-row" data-focus-work="'+t.id+'"><span class="work-row-title">'+esc(t.title)+'</span><span class="meta">あなた ／ '+esc(t.due||'期限未設定')+'</span><span aria-hidden="true">→</span></button>').join('')+(ready.length?'':'<p>今できる担当作業はありません。</p>')+'</div></section><details id="followup" class="panel"><summary>いま誰の対応待ち？ <span class="inline-count">'+wait.length+'</span></summary><div class="wait-rows">'+wait.map(t=>'<div class="wait-row"><strong>'+esc(t.title)+'</strong><span>次に動く人：'+esc(ownerName(t,e))+'</span><span>期限 '+esc(t.due||'未設定')+'</span>'+(t.blockedBy.length?'<small>先に必要：'+esc(t.blockedBy.join('、'))+'</small>':'')+(e.canManage?'<button type="button" data-focus-work="'+t.id+'">内容を確認・調整</button>':'')+'</div>').join('')+'</div></details>';}
function applicationDetails(e){
 const imported=Boolean(e.source&&!e.isExercise);
 return '<details id="application-content" class="panel"><summary>'+(applicant||sharedStaff?'申請内容・連絡先を確認／変更する':'申請内容・連絡先を確認する')+'</summary><section class="application-record"><span class="tag">'+(imported?'元台帳の記録':e.changePending?'変更案・新合意待ち':e.operationalProgress?.booking==='reported-confirmed'?'開催確定の共有記録あり':e.booking==='confirmed'?'開催確定':'開催未確定')+'</span><h2>'+(e.changePending?'変更案：':'')+esc(e.common.eventTitle)+'</h2><p class="meta">'+esc(e.common.firstDate)+' '+esc(e.common.firstStart)+'〜'+esc(e.common.firstEnd)+' ／ '+esc(e.common.attendance)+'人</p>'+(applicant||sharedStaff?'<form id="common"><p class="process-help">変更は運営の再確認が必要です。保存だけでは、新しい条件での開催は確定しません。</p><div class="fields">'+Object.entries(e.common).filter(([k])=>e.consentWorkflow?.version===1||!['organization','understanding'].includes(k)&&(k!=='phone'||isOperating(e))).map(([k,v])=>'<label>'+esc(config.fields[k])+'<input name="'+k+'" value="'+esc(v)+'"'+(e.consentWorkflow?.version===1&&['organization','understanding','phone'].includes(k)?'':' required')+'></label>').join('')+'</div><button class="primary">変更を保存して確認を依頼</button></form>':'<dl>'+Object.entries(e.common).filter(([k])=>['responsibleName','organization','phone','email'].includes(k)).map(([k,v])=>'<dt>'+esc(config.fields[k])+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl>')+'</section></details>';
}
function reviewDetails(e){return window.GarrawayReview?'<details class="panel review-overview"><summary>申請内容・判断材料を見る</summary>'+window.GarrawayReview.summary(e)+'</details>':'';}
function consentFlow(e){return window.GarrawayConsent?.render(e,{applicant})||'';}
function calendarSection(e){return window.GarrawayCalendar?'<details class="panel"><summary>日程をGoogleカレンダーに追加</summary>'+window.GarrawayCalendar.render(e,{applicant})+'</details>':'';}
function selfService(e){return (e.canEditReviewContext&&window.GarrawayReview?'<details class="panel"><summary>'+(isOperating(e)&&e.consentWorkflow?.version!==1?'詳細ヒアリング・運営への相談':'参加条件・確認したいこと')+'</summary><form id="review-context-form">'+window.GarrawayReview.fields(e.reviewContext,{operating:isOperating(e)&&e.consentWorkflow?.version!==1})+'<button class="primary">参考情報を保存する</button></form></details>':'')+(applicant?'<details class="panel"><summary>希望日時・プログラム／終了後の報告</summary>'+(window.GarrawaySchedule?.render(e,{applicant})||'')+'</details>':'<details class="panel"><summary>開催後の実績を見る</summary>'+(window.GarrawaySchedule?.render(e,{applicant,plan:!window.GarrawayReview||Boolean(e.canEditSchedule)})||'')+'</details>');}
function internalTools(e){return (sharedStaff?'<details class="panel"><summary>コンシェルジュ担当者</summary><form id="operational-staff"><label>現在の担当者・チーム（複数可）<textarea name="staff" rows="2" maxlength="971" placeholder="1行に1名・1チーム">'+esc((e.operationalStaff||[]).join('\n'))+'</textarea></label><small>12名・チームまで。表示用の記録です。ログイン権限や承認権限は変更しません。</small><button type="submit">今すぐ保存</button></form></details>':'')+'<details class="panel"><summary>注意事項・引継ぎメモ</summary><p>申請者には表示されません。</p><form id="note"><textarea name="note" maxlength="2000">'+esc(e.internalNote)+'</textarea><button>内部メモを保存</button></form></details>'+(config.role==='reviewer'&&config.capabilities?.assign!==false?'<details class="panel"><summary>作業の担当を割り当てる</summary><form id="assign"><label>作業<select name="taskId">'+e.tasks.filter(t=>!['screening','hearing','consent'].includes(t.id)).map(t=>'<option value="'+t.id+'">'+esc(t.title)+'</option>').join('')+'</select></label><label>担当<select name="subject">'+(config.members||[]).filter(m=>m.role!=='applicant').map(m=>'<option value="'+esc(m.id)+'">'+esc(m.label)+'</option>').join('')+'</select></label><button>担当を変更</button></form></details>':'');}
const decisionTargets={toyota:'トヨタの判断結果',okami:'女将への相談結果'};
const decisionResults={pending:'確認待ち・相談中',ok:'OK',revision:'要修正',declined:'見送り'};
const safeDecisionEvidence=value=>typeof value==='string'&&/^https:\/\/(?:docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/|drive\.google\.com\/file\/d\/)[A-Za-z0-9_-]{10,200}(?:\/(?:edit|view|preview))?(?:\?usp=(?:sharing|drive_link))?(?:#[A-Za-z0-9_=&-]{1,100})?$/.test(value);
function decisionRecordsSection(e){
 if(applicant||config.capabilities?.recordDecision!==true)return '';
 const records=Array.isArray(e.decisionRecords)?e.decisionRecords:[];
 const history=records.slice().reverse().map(record=>'<li><strong>'+esc(decisionTargets[record.target]||'判断・相談')+'：'+esc(decisionResults[record.result]||'記録を確認')+'</strong><p>判断・相談日：'+esc(record.decisionDate)+'</p>'+(record.decisionMakerName?'<p>判断・相談相手：'+esc(record.decisionMakerName)+'（入力された氏名・本人確認なし）</p>':'')+(record.comment?'<p class="decision-comment">'+esc(record.comment)+'</p>':'')+(safeDecisionEvidence(record.evidenceUrl)?'<p><a href="'+esc(record.evidenceUrl)+'" target="_blank" rel="noopener noreferrer">根拠リンクを開く</a>（内容未検証）</p>':'')+'<p class="meta">記録アカウント：'+esc(record.recordedBy)+' ／ 記録日時：'+esc(record.recordedAt)+'</p></li>').join('');
 return '<details class="panel decision-records"><summary>判断・相談の記録'+(records.length?'（'+records.length+'件）':'')+'</summary><p class="meta">共有アカウントで確認した事実を追記します。個人の本人確認や最終承認・通知の完了を示すものではありません。原票と過去の記録を保持します。</p><div class="actions">'+Object.entries(decisionTargets).map(([target,label])=>'<button type="button" data-decision-target="'+target+'">'+label+'を記録</button>').join('')+'</div><form id="decision-record" hidden><h3 id="decision-record-heading"></h3><input type="hidden" name="target"><div class="fields"><label>結果<select name="result" required><option value="">選択してください</option>'+Object.entries(decisionResults).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+'</select></label><label>実際に判断・相談した日<input name="decisionDate" type="date" required></label></div><details><summary>補足（任意）</summary><label>判断した人・相談相手の氏名<input name="decisionMakerName" maxlength="120" autocomplete="off"><small>入力された氏名として保存します。本人認証は行いません。</small></label><label>根拠・相談内容<textarea name="comment" maxlength="1000" rows="2"></textarea></label><label>根拠リンク<input name="evidenceUrl" type="url" maxlength="600" placeholder="Googleドライブ・ドキュメントの共有URL"><small>リンク先は読み取らず、共有権限も変更しません。</small></label></details><div class="actions"><button class="primary" type="submit">記録を保存</button><button type="button" data-cancel-decision>キャンセル</button></div></form>'+(history?'<details><summary>これまでの記録（'+records.length+'件）</summary><ol class="decision-record-history">'+history+'</ol></details>':'<p class="meta">このアプリでの記録はまだありません。</p>')+'</details>';
}
function bindDecisionRecord(e){
 const form=app.querySelector('#decision-record');if(!form)return;
 const cancel=()=>{form.reset();form.hidden=true;app.querySelector('[data-decision-target]')?.focus();};
 app.querySelectorAll('[data-decision-target]').forEach(button=>button.onclick=()=>{if(busy||pendingCommand||consentPending)return;const show=()=>{form.reset();form.elements.namedItem('target').value=button.dataset.decisionTarget;form.querySelector('#decision-record-heading').textContent=decisionTargets[button.dataset.decisionTarget]+'を記録';form.hidden=false;form.elements.namedItem('result').focus();};window.GarrawayUx?window.GarrawayUx.guard(show,{scope:form}):show();});
 form.querySelector('[data-cancel-decision]').onclick=()=>{if(busy||pendingCommand||consentPending)return;window.GarrawayUx?window.GarrawayUx.guard(cancel,{scope:form}):cancel();};
 form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;const decision=Object.fromEntries(new FormData(form));if(decision.evidenceUrl&&!safeDecisionEvidence(decision.evidenceUrl.trim())){saving('failed','根拠リンクはGoogleドライブ・ドキュメントの共有URLを入力してください。');form.elements.namedItem('evidenceUrl').focus();return;}mutate('decision-record',{id:e.id,expectedVersion:e.version,decision});};
}
function renderRolePage(e,row,cases){
 const imported=Boolean(e.source&&!e.isExercise),exercise=e.isExercise?'<p class="meta exercise-note">架空案件の練習です。実際の予約・承認にはなりません。</p>':'';
 const history='<details class="panel"><summary>'+(applicant?'申請の変更履歴':'変更履歴')+'</summary><ol>'+e.history.map(h=>'<li>'+esc(actionName(h.action))+' <span class="meta">'+esc(h.at)+'</span></li>').join('')+'</ol></details>';
 if(applicant)return casePicker(e,cases)+applicantFocus(e)+applicantStatus(e)+agreedConditions(e)+applicationDetails(e)+calendarSection(e)+selfService(e)+consentFlow(e)+'<details class="panel"><summary>あなたの提出物と確認状況</summary>'+e.tasks.map(t=>task(t,e,true)).join('')+'</details>'+history+(config.capabilities?.submit!==false?'<button id="new">別のイベントを申請する</button>':'');
 if(window.GarrawayDashboard){
  const pane=(id,label,content)=>'<section class="sheet-pane" id="sheet-'+id+'" data-sheet-pane="'+id+'" hidden><div class="sheet-pane-heading"><h3>'+label+'</h3><button type="button" data-close-sheet-pane>閉じる</button></div>'+content+'</section>';
  const contacts='<dl><dt>主催者</dt><dd>'+esc(e.common.responsibleName)+'</dd><dt>メール</dt><dd>'+esc(e.common.email||'未記録')+'</dd><dt>電話</dt><dd>'+esc(e.common.phone||'未記録')+'</dd></dl><p class="meta">連絡先の確認用です。メールの自動送信は未接続です。</p>';
  const paneButton=(id,label)=>'<button type="button" data-sheet-open="'+id+'" aria-controls="sheet-'+id+'" aria-expanded="false">'+label+'</button>';
  const actions='<div class="sheet-primary-actions">'+paneButton('review','申請内容・提出書類')+paneButton('preparation','開催準備・当日の進行')+paneButton('report','開催後の報告')+'</div><div class="sheet-utility-actions">'+paneButton('calendar','Googleカレンダーに追加')+paneButton('contacts','連絡先・メール')+paneButton('records','変更履歴')+'</div>';
  const contextEditor=e.canEditReviewContext&&window.GarrawayReview?'<details class="panel"><summary>既存のヒアリング内容を確認・更新</summary><form id="review-context-form">'+window.GarrawayReview.fields(e.reviewContext,{operating:isOperating(e)&&e.consentWorkflow?.version!==1})+'<button class="primary">参考情報を保存する</button></form></details>':'';
  const scheduleEditor=e.canEditSchedule&&window.GarrawaySchedule?'<details class="panel"><summary>既存の希望日時・プログラムを確認・更新</summary>'+window.GarrawaySchedule.planned(e.schedule||window.GarrawaySchedule.fromCommon(e.common),true)+'</details>':'';

  return casePicker(e,cases)+'<section class="event-management-sheet" aria-label="選択イベントの管理票">'+window.GarrawayDashboard.detailSummary(e,{...config,focusedTaskId:nextWork(e)?.id})+(sharedStaff?(window.GarrawayOperationalProgress?.render(e)||''):(imported?'<p class="source-evidence">原票を表示しています。元の可否・済の記録と、アプリでの判断履歴を区別して保持します。</p>':adminFocus(e)))+window.GarrawayDashboard.sheetNotes(e,config)+(sharedStaff?internalTools(e):'')+decisionRecordsSection(e)+actions+pane('calendar','カレンダーに予定を控える',window.GarrawayCalendar?.render(e,{applicant:false})||'未接続')+pane('contacts','主催者の連絡先',contacts)+pane('review','申請内容・提出書類',reviewDetails(e)+applicationDetails(e)+(e.agreedConditions?agreedConditions(e):'')+consentFlow(e))+pane('preparation','開催準備・当日の進行',window.GarrawayDashboard.preparationDetails(e,config)+'<div class="preparation-edit-tools">'+(sharedStaff?'':internalTools(e))+contextEditor+scheduleEditor+'</div>')+pane('report','開催後の報告',(!e.report?.recordedAt?'<p class="meta">開催後の報告はまだ記録されていません。予定を実績として扱いません。</p>':'')+(window.GarrawaySchedule?.render(e,{applicant:false,plan:false})||''))+pane('records','変更履歴・作業記録',history+window.GarrawayDashboard.sheetRecords(e,config))+'</section>';
 }
 return (window.GarrawayDashboard?window.GarrawayDashboard.detailSummary(e,config):'')+casePicker(e,cases)+exercise+(sharedStaff?(window.GarrawayOperationalProgress?.render(e)||''):'')+(imported&&window.GarrawayDashboard?'<p class="source-evidence">原票の進捗を表示中です。記録済みの作業をもう一度入力する必要はありません。</p>':adminFocus(e))+(window.GarrawayDashboard?window.GarrawayDashboard.taskRows(e,config):'')+(config.role==='reviewer'?reviewDetails(e):'')+workList(e)+agreedConditions(e)+(e.changePending?'<p class="change-review">変更案は未合意です。以前の合意と新しい案を分けて確認してください。</p>':'')+(imported?'<section class="panel"><h2>開催可否：'+esc(e.source.statusRaw||'原票に記載なし')+'</h2><p>原担当者：'+esc(e.source.handlerRaw||'原票に記載なし')+'</p><p>元の日程：'+esc(e.source.scheduleRaw||'原票に記載なし')+'</p><p>元の業務が未実施という意味ではありません。原票の記録を保持しています。</p></section>':'')+(config.role==='reviewer'?'':reviewDetails(e))+applicationDetails(e)+calendarSection(e)+selfService(e)+consentFlow(e)+'<details id="all-progress" class="panel" '+(imported?'open':'')+'><summary>'+(imported?'原票の作業記録と、アプリ上の確認状態':'全体の流れ・全作業の記録')+'</summary>'+(window.GarrawayJourney?.render(e.journey?{...e.journey,changePending:e.changePending,nextDue:row.nextAction?.due}:undefined)||'')+deadlineBasis(e)+e.tasks.map(t=>task(t,e,true)).join('')+'</details>'+decisionRecordsSection(e)+internalTools(e)+history;
}
function bindRolePage(e){
 const refreshSheet=app.querySelector('[data-sheet-refresh]');if(refreshSheet)refreshSheet.onclick=()=>document.querySelector('#refresh').click();
 const showPane=id=>{app.querySelectorAll('[data-sheet-open]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.sheetOpen===id)));app.querySelectorAll('[data-sheet-pane]').forEach(p=>{p.hidden=p.dataset.sheetPane!==id;});const p=app.querySelector('[data-sheet-pane="'+id+'"]');p?.querySelectorAll(':scope > details').forEach(d=>d.open=true);p?.scrollIntoView?.({block:'nearest'});};
 app.querySelectorAll('[data-sheet-open]').forEach(b=>b.onclick=()=>showPane(b.dataset.sheetOpen));app.querySelectorAll('[data-close-sheet-pane]').forEach(b=>b.onclick=()=>{const p=b.closest('[data-sheet-pane]');p.hidden=true;const trigger=app.querySelector('[data-sheet-open="'+p.dataset.sheetPane+'"]');trigger?.setAttribute('aria-expanded','false');trigger?.focus();});
 const recordStage=app.querySelector('#sheet-record-stage');if(recordStage)recordStage.onchange=ev=>{app.querySelector('#sheet-stage-records').innerHTML=window.GarrawayDashboard.stageRecords(e,config,Number(ev.target.value));bindRolePage(e);};
 app.querySelectorAll('[data-source-task]').forEach(el=>el.onclick=()=>window.GarrawayDashboard?.showTaskRecord(e.tasks.find(t=>t.id===el.dataset.sourceTask),e));
 app.querySelectorAll('[data-event-date]').forEach(el=>el.onclick=()=>window.GarrawayDashboard?.showDay(adminEvents,el.dataset.eventDate,config,el.dataset.eventId));
 const backList=app.querySelector('[data-back-list]');if(backList)backList.onclick=()=>{const go=()=>{adminListOpen=true;render().catch(error=>message.textContent=error.message);};if(busy||pendingCommand||consentPending)return;window.GarrawayUx?window.GarrawayUx.guard(go):go();};
 app.querySelectorAll('[data-focus-work]').forEach(b=>b.onclick=()=>{const go=()=>{focusedWork=b.dataset.focusWork;render().then(()=>app.querySelector('.focus-panel')?.scrollIntoView?.({block:'start',behavior:'instant'}));};window.GarrawayUx?window.GarrawayUx.guard(go):go();});
 const openDetails=id=>{const panel=app.querySelector(id);if(panel){const pane=panel.closest('[data-sheet-pane]');if(pane)showPane(pane.dataset.sheetPane);panel.open=true;panel.scrollIntoView?.({block:'start',behavior:'instant'});panel.querySelector('summary')?.focus();}};
 app.querySelectorAll('[data-open-materials]').forEach(b=>b.onclick=()=>{openDetails('.review-overview');const target=app.querySelector('#review-summary');target?.focus();});
 app.querySelectorAll('[data-show-followup]').forEach(b=>b.onclick=()=>window.GarrawayDashboard?showPane('records'):openDetails('#followup'));
 app.querySelectorAll('[data-open-application]').forEach(b=>b.onclick=()=>openDetails('#application-content'));
}
function task(t,e,readOnly=false){const imported=Boolean(e.source&&!e.isExercise);const active=!readOnly&&t.mine&&!t.blockedBy.length&&(t.state!=='done'||t.needsReview)&&!(applicant&&t.id==='consent'&&e.consentWorkflow?.version===1&&e.canAgreeConsent!==true);return `<article class="${!applicant&&window.GarrawayDashboard?'sheet-task':'task'} ${t.state}" data-task="${t.id}"><span class="tag">${esc(imported?(t.needsReview?'アプリ再確認':t.state==='done'?'アプリ確認済':'アプリ未確認'):!applicant&&t.state==='submitted'?'受領確認待ち':status(t))}</span><h3>${esc(t.id==='approval'?'開催する候補を選び、最終承認する':!applicant&&t.id==='screening'?'事前審査フォームの受領・確認':t.title)}</h3>${t.sourceStatus!==undefined?`<p class="meta">原票の記録：<strong>${esc(t.sourceStatus||'未記入')}</strong>${t.sourceCombined?'（複数業務をまとめた原票欄）':''}。この記録を消さずに、アプリでの確認を別に管理します。</p>`:''}<dl class="action-ownership"><dt>担当</dt><dd>${esc(ownerName(t,e))}</dd><dt>期限</dt><dd>${esc(t.due||'未設定')}</dd></dl>${t.request?`<p class="request">差戻し：${esc(t.request)}</p>`:''}${t.blockedBy.length?`<p>先に必要：${esc(t.blockedBy.join('、'))}</p>`:''}${!applicant&&t.id==='screening'&&window.GarrawayReview?'<a href="#review-summary">受入判断の5観点を見る</a>':''}${taskHelp(t.id,e)}${readOnly&&!applicant&&e.canManage?'<button type="button" data-focus-work="'+t.id+'">この作業を確認・調整</button>':''}${t.id==='approval'&&active?approvalChoice(e):''}${!readOnly&&applicant&&t.id==='hearing'&&isOperating(e)?'<button type="button" data-open-details>詳細ヒアリングを入力する</button>':''}<div class="actions">${active?`<button data-action="${applicant?'submit-task':'complete-task'}" data-id="${t.id}" class="primary">${applicant?'提出して確認を依頼':t.id==='approval'?'女将・トヨタとして最終承認':t.id==='screening'?'事前審査フォームの受領を記録':t.id==='reportInquiry'?'女将・トヨタへの報告完了を記録':'完了・受領を記録'}</button>`:''}${!readOnly&&!applicant&&e.canManage&&t.state!=='done'?`<button data-open="return" data-id="${t.id}">差戻し</button><button data-open="deadline" data-id="${t.id}">期限を変更</button>`:''}</div><div class="extra"></div></article>`;}
function deadlineBasis(e){const index=e.changePending?e.agreedConditions?.approvedCandidateIndex:e.approvedCandidateIndex;return '<p class="process-help">'+([0,1].includes(index)?'自動期限は選択された第'+(index+1)+'希望の日付が基準です。':'自動期限は第1希望の日付を使った暫定です。開催日が確定した意味ではありません。')+' 個別に設定した期限は保持します。</p>';}
function candidateLabel(c,index){if(!c)return '第'+(index+1)+'希望：記録なし';return '第'+(index+1)+'希望：'+(c.undecided?'未定':(c.date||'日付未入力')+' ／ 準備 '+(c.setupDay===1?'翌日 ':'')+(c.setupStart||'未入力')+' ／ イベント '+(c.eventStartDay===1?'翌日 ':'')+(c.eventStart||'開始未入力')+'〜'+(c.eventEndDay===1?'翌日 ':'')+(c.eventEnd||'終了未入力')+' ／ 完全撤収 '+(c.clearEndDay===1?'翌日 ':'')+(c.clearEnd||'未入力'));}
function approvalChoice(e){return '<label>開催する候補<select data-approved-candidate required><option value="">候補を選択してください</option>'+(e.schedule?.candidates||[]).map((c,i)=>'<option value="'+i+'">'+esc(candidateLabel(c,i))+'</option>').join('')+'</select></label><p class="process-help">選んだ候補で最終承認します。未定・必要時刻が未入力の候補は承認できません。開催確定は承認通知の後です。</p>';}
function agreedConditions(e){const a=e.agreedConditions;if(!a)return '';const common=a.common||{},schedule=a.schedule||{},context=a.reviewContext||{};const fields=Object.entries(config.fields).filter(([key])=>! /^(first|second)(Date|Start|End)$/.test(key)&&common[key]!==undefined&&common[key]!=='').map(([key,label])=>'<dt>'+esc(label)+'</dt><dd>'+esc(common[key])+'</dd>').join('');const time=(c,key,day)=>c[key]?((c[day]===1?'翌日 ':'')+c[key]):'記録なし';const chosen=Number.isInteger(a.approvedCandidateIndex)&&[0,1].includes(a.approvedCandidateIndex)?a.approvedCandidateIndex:null;const candidates=(schedule.candidates||[]).map((c,i)=>'<li>第'+(i+1)+'希望：'+(c.undecided?'未定':esc(c.date||'日付記録なし')+' ／ 準備 '+esc(time(c,'setupStart','setupDay'))+' → イベント '+esc(time(c,'eventStart','eventStartDay'))+'〜'+esc(time(c,'eventEnd','eventEndDay'))+' → 完全撤収 '+esc(time(c,'clearEnd','clearEndDay')))+'</li>').join('');const labels={participation:'参加条件',participationNote:'参加条件の補足',sales:'販売・勧誘',salesNote:'販売・勧誘の補足',equipmentNote:'機材・設営',supportNote:'人員・支援',safetyNote:'安全・配慮'};const choices={open:'一般に参加可能',conditions:'参加条件あり',internal:'社内・関係者限定',undecided:'未定',none:'なし',sales:'販売あり',solicitation:'勧誘あり',both:'販売・勧誘あり'};const notes=Object.entries(labels).filter(([key])=>context[key]).map(([key,label])=>'<dt>'+label+'</dt><dd>'+esc(['participation','sales'].includes(key)?choices[context[key]]||context[key]:context[key])+'</dd>').join('');const program=(schedule.program||[]).map(row=>'<li>'+esc((row.startDay===1?'翌日 ':'')+(row.start||'時刻未記録'))+'〜'+esc((row.endDay===1?'翌日 ':'')+(row.end||'時刻未記録'))+' '+esc(row.title)+' '+esc(row.note||'')+'</li>').join('');return '<section class="panel agreed-conditions"><span class="tag">現在の合意を保持</span><h2>'+esc(common.eventTitle||'現在の合意')+'</h2><p>'+(e.changePending?'変更案が合意されるまでは、この条件を保持します。下の変更案は、まだ新しい約束ではありません。':'記録されている合意内容です。')+'</p>'+(chosen===null?'<p class="change-review"><strong>開催日時の確定記録がありません。</strong>どの候補を採用したか、運営に確認してください。</p><h3>当時の申請候補（確定日時ではありません）</h3><ul>'+candidates+'</ul>':'<h3>合意した開催日時</h3><p>'+esc(candidateLabel(schedule.candidates?.[chosen],chosen))+'</p>')+'<details><summary>合意している内容を確認する</summary><dl>'+fields+notes+'</dl>'+(program?'<h3>プログラム</h3><ol>'+program+'</ol>':'')+'<p class="meta">合意版 '+esc(a.agreementRevision??'記録なし')+' ／ 承認通知日時：'+esc(a.confirmedAt||'記録なし')+'</p></details></section>';}
function taskHelp(id,e={}){const help={reportInquiry:'申請内容と希望日時を報告したら、完了を記録してください。連絡は送信されません。',screening:'事前審査フォームを受領し、内容を確認します。ヒアリングシート・同意書の回収確認へ進みます。この受領だけでは開催は確定しません。',hearing:'機材・人員・準備と完全撤収時刻を具体化してください。主催者が準備・運営できる内容か、理由も含めて一緒に確認します。',consent:e.consentWorkflow?.version===1?'元の同意書と今回の条件を確認し、申請者自身の意思で署名・同意を記録します。運営の受領確認と開催判断は別の手続きです。':'内容と利用条件を確認して、本人が署名した最終利用同意書を提出します。署名文書の接続はこの試作では未設定です。',approval:'詳細ヒアリングと同意を確認し、女将・トヨタが最終判断します。開催確定は承認通知の後です。',approvalMail:'承認通知を送ると正式な開催確定になります。この試作では実送信を停止しています。',meeting:'事前リハーサルを原則とし、機材操作・不足品・受付進行・設営撤収を確認します。遠方など難しい場合は個別にご相談ください。',restore:'イベント終了と完全撤収は別です。利用終了時刻までに原状復帰と全員の退館を終えてください。他の利用者やスタッフの退勤に影響します。'};return help[id]?(applicant?'<p class="process-help">'+esc(help[id])+'</p>':'<details class="task-help"><summary>この作業の説明</summary><p class="process-help">'+esc(help[id])+'</p></details>'):'';}
function bindOperationalAutosave(e){
 if(!sharedStaff||!window.GarrawayOperationalAutosave)return;
 const controller=window.GarrawayOperationalAutosave.create({eventId:e.id,version:e.version,write:api,beforeWrite:()=>{cancelRead();++renderGeneration;},onVersion:version=>{e.version=version;}});
 window.GarrawayOperationalAutosave.current=controller;
 const note=app.querySelector('#note');
 controller.register({form:note,path:'internal-note',read:()=>({note:note.elements.note.value}),body:value=>value,accept:value=>{e.internalNote=value.note;}});
 const staff=app.querySelector('#operational-staff');
 const staffValues=()=>staff.elements.staff.value.split(/\r?\n/).map(name=>name.trim()).filter(Boolean);
 controller.register({form:staff,path:'operational-staff',read:()=>({staff:staffValues()}),body:value=>value,validate:()=>{const names=staffValues();return names.length<=12&&new Set(names).size===names.length&&names.every(name=>name.length<=80&&!/[\u0000-\u001f\u007f]/.test(name));},accept:value=>{e.operationalStaff=value.staff;}});
 const common=app.querySelector('#common');
 if(common){
  const fields=[...common.querySelectorAll('input,textarea,select')].filter(field=>field.name&&!field.readOnly&&!field.disabled);
  for(const field of fields){const key=field.name;field.maxLength=key==='summary'?200:['purpose','understanding','impact'].includes(key)?1000:key==='email'?254:120;if(key==='email')field.type='email';if(key==='attendance'){if(/^\d*$/.test(field.value))field.type='number';field.min='1';field.max='9999';field.step='1';field.inputMode='numeric';}}
  controller.register({form:common,path:'common',read:()=>Object.fromEntries(fields.map(field=>[field.name,field.value])),body:(value,baseline)=>({patch:Object.fromEntries(Object.entries(value).filter(([key,text])=>text!==baseline[key]))}),validate:()=>fields.every(field=>field.name!=='attendance'||/^\d+$/.test(field.value)&&Number(field.value)>=1&&Number(field.value)<=9999),accept:value=>{Object.assign(e.common,value);}});
 }
 const review=app.querySelector('#review-context-form');
 if(review&&window.GarrawayReview)controller.register({form:review,path:'review-context',read:()=>window.GarrawayReview.collect(review,e.reviewContext),body:value=>({reviewContext:value}),accept:value=>{e.reviewContext=value;}});
 const schedule=app.querySelector('#schedule-form');
 if(schedule&&e.canEditSchedule&&window.GarrawaySchedule)controller.register({form:schedule,path:'schedule',read:()=>window.GarrawaySchedule.collect(schedule),body:value=>({schedule:value}),validate:()=>!window.GarrawaySchedule.assess(window.GarrawaySchedule.collect(schedule)).issues.length,accept:value=>{e.schedule=value;}});
 for(const form of app.querySelectorAll('[data-operational-autosave]')){const button=form.querySelector('button:not([type=button])');if(button)button.textContent='今すぐ保存';}
}
function saving(state,text){message.dataset.saveState=state;message.textContent=text;app.setAttribute('aria-busy',state==='saving'?'true':'false');}
async function mutate(path,body,accepted=false){if(busy||consentPending)return;if(!accepted&&window.GarrawayUx){window.GarrawayUx.guard(()=>mutate(path,body,true),{saving:true});return;}const version=window.GarrawayOperationalAutosave?.current?.manualVersion(body.id||selected);if(version!==null&&version!==undefined&&body.expectedVersion!==undefined)body={...body,expectedVersion:version};const fingerprint=JSON.stringify({eventId:body.id||selected,path,body});if(pendingCommand&&pendingCommand.fingerprint!==fingerprint){saving('unknown','前の保存結果が未確認です。「同じ操作の結果を確認」から先に確認してください。');showRetry();return;}pendingCommand??={path,eventId:body.id||selected,target:path==='$submit'?'':'/'+(body.id||selected)+'/'+path,create:path==='$submit',body:{...body,key:crypto.randomUUID()},fingerprint};await executePending();}
function lockForSave(){const locked=busy||Boolean(pendingCommand)||consentPending;app.querySelectorAll('button,input,textarea,select').forEach(x=>{if(x.closest('[data-consent-flow]'))return;if(locked){if(!x.hasAttribute('data-save-disabled'))x.dataset.saveDisabled=x.disabled?'1':'0';x.disabled=true;}else if(x.hasAttribute('data-save-disabled')){x.disabled=x.dataset.saveDisabled==='1';delete x.dataset.saveDisabled;}});document.querySelector('#refresh').disabled=locked||loading;}
function showRetry(){const button=document.createElement('button');button.textContent='同じ操作の結果を確認';button.onclick=executePending;message.append(document.createElement('br'),button);}
async function executePending(){if(busy||!pendingCommand)return;cancelRead();++renderGeneration;selected=pendingCommand.eventId;const select=document.querySelector('#case-select');if(select)select.value=selected;busy=true;lockForSave();saving('saving','保存しています。このままお待ちください。');const command=pendingCommand;const activity=window.GarrawayAsyncFeedback.begin('変更を保存しています…',{priority:2,buttons:[...app.querySelectorAll('button[type=submit],button.primary')],slow:'保存結果を確認中です。入力を保持しています。同じボタンを押さずにお待ちください。'});try{const result=await api(command.target,command.body);if(!result||typeof result.id!=='string'||!/^[A-Za-z0-9-]{1,80}$/.test(result.id)||!Number.isSafeInteger(result.version)||result.version<1||(!command.create&&result.id!==command.eventId)||(Number.isSafeInteger(command.body.expectedVersion)&&result.version<command.body.expectedVersion))throw Object.assign(Error('保存結果を確認できません。同じ操作として再確認してください。'),{code:'OUTCOME_UNKNOWN'});if(command.create)selected=result.id;pendingCommand=null;saving('saved',command.create?'試験用の申請を保存しました。担当設定と受領確認を待っています。':'保存済み。同じイベントの情報に反映されました。');activity.finish('success',message.textContent);try{await render();}catch{saving('saved','保存は完了しました。最新表示を取得できないため、読み直してください。');window.GarrawayAsyncFeedback.notice('unknown',message.textContent);}}catch(error){if(error.code==='VERSION_CONFLICT'){pendingCommand=null;saving('conflict','他の担当者が先に更新しました。入力内容は残しています。コピーしてから最新状態を読み直し、変更内容を確認してください。');}else if(['VALIDATION','FORBIDDEN','NOT_FOUND','CLOSED','DELIVERY_DISABLED','UNAUTHENTICATED','CAPACITY','IDEMPOTENCY_CONFLICT'].includes(error.code)){pendingCommand=null;saving('failed','保存できませんでした：'+error.message+'。入力内容は残しています。');}else{saving('unknown',error.message+'。入力内容は残しています。');showRetry();}activity.finish(pendingCommand?'unknown':'error',message.textContent);}finally{activity.cancel();busy=false;lockForSave();app.setAttribute('aria-busy','false');}}

function bindConsentFlow(e){
 consentController?.dispose();consentController=null;if(!window.GarrawayConsent||e.consentWorkflow?.version!==1)return;
 const fail=(text,code)=>Object.assign(new Error(text),{code});
 const hasOtherInput=kind=>{const current=kind==='agreement'?'[data-consent-form]':kind==='hearing'?'[data-hearing-form]':kind==='explanation'?'[data-explanation-form]':kind==='correction'?'[data-correction-form]':kind==='contact'?'[data-contact-form]':null;return (window.GarrawayUx?.changed()||[]).some(form=>!current||!form.matches(current));};
 const write=async(path,body,kind)=>{
  if(busy||pendingCommand)throw fail('前の保存が終わるまでお待ちください','BUSY');
  if(!consentPending&&hasOtherInput(kind))throw fail('ほかの入力欄を保存してから、この操作を行ってください','UNSAVED_INPUT');
  cancelRead();++renderGeneration;busy=true;lockForSave();
  try{return await api('/'+e.id+'/'+path,body);}finally{busy=false;lockForSave();}
 };
 consentController=window.GarrawayConsent.bind(app,e,{
  onReview:async()=>{if(busy||pendingCommand||consentPending)throw fail('前の保存結果を先に確認してください','BUSY');if((window.GarrawayUx?.changed()||[]).some(form=>!form.matches('[data-consent-form]')))throw fail('ヒアリングやほかの入力欄を保存してから原文と条件を確認してください','UNSAVED_INPUT');return api('/'+e.id+'/consent-review',{key:crypto.randomUUID()});},
  onRequestConsentCode:applicant&&window.GarrawayApplicantOtp?review=>window.GarrawayApplicantOtp.requestConsentCode(review):undefined,
  onSaveHearing:body=>write('hearing',body,'hearing'),onAgree:(body,proof)=>write('consent-agree',proof?{command:body,proof}:body,'agreement'),onExplain:body=>write('explain-conditions',body,'explanation'),onRequestCorrection:body=>write('return-task',body,'correction'),onConfirmContact:body=>write('confirm-contact',body,'contact'),
  onPendingChange:value=>{consentPending=value;lockForSave();},
  onConflict:()=>saving('conflict','ほかの更新がありました。入力内容を控えてから再読み込みし、最新内容に合わせて保存してください。'),
  onSaved:async()=>{consentPending=false;await render();}
 });
}

function bindNotices(e={},intake=false){if(!window.GarrawayNotices)return;app._noticeCleanup?.();const box=document.createElement('div');box.className='admission-notices';if(intake)document.querySelector('#intake').before(box);else{const review=document.querySelector('#review-summary');const anchor=review?.closest('details.review-overview')||review||app.querySelector('.panel');anchor?.before(box);}const update=()=>{if(!box.isConnected)return;const context=document.querySelector(intake?'#intake-review-context':'#review-context-form');const schedule=document.querySelector(intake?'#intake-schedule':'#schedule-form');box.innerHTML=window.GarrawayNotices.render({reviewContext:context?window.GarrawayReview.collect(context,e.reviewContext):e.reviewContext,schedule:schedule?window.GarrawaySchedule.collect(schedule):e.schedule});};const click=event=>{if(!box.contains(event.target))queueMicrotask(update);};app.addEventListener('input',update);app.addEventListener('change',update);app.addEventListener('click',click);app._noticeCleanup=()=>{app.removeEventListener('input',update);app.removeEventListener('change',update);app.removeEventListener('click',click);};update();}
function bind(e){if(applicant&&window.GarrawayApplicantOtp){const email=app.querySelector('#common [name=email]');if(email){email.readOnly=true;email.setAttribute('aria-describedby','applicant-email-help');const help=document.createElement('small');help.id='applicant-email-help';help.className='field-hint';help.textContent='このメールは申請を再開するための確認先です。この画面では変更できません。変更が必要な場合は、先に運営へお問い合わせください。';email.after(help);}}bindConsentFlow(e);window.GarrawayOperationalProgress?.bind(e,fact=>mutate('operational-record',{id:e.id,expectedVersion:e.version,fact}));bindDecisionRecord(e);app.querySelectorAll('a[href="#review-summary"]').forEach(link=>link.onclick=()=>{const target=document.querySelector('#review-summary');const pane=target?.closest('[data-sheet-pane]');if(pane)app.querySelector('[data-sheet-open="'+pane.dataset.sheetPane+'"]')?.click();const details=target?.closest('details');if(details)details.open=true;target?.focus();});app.querySelectorAll('[data-open-details]').forEach(button=>button.onclick=()=>{const form=document.querySelector('[data-hearing-form]')||document.querySelector('#review-context-form');if(form){const pane=form.closest('[data-sheet-pane]');if(pane)app.querySelector('[data-sheet-open="'+pane.dataset.sheetPane+'"]')?.click();form.closest('details').open=true;const field=form.querySelector('input:not(:disabled),textarea:not(:disabled),select:not(:disabled)');field?.focus();form.scrollIntoView?.({block:'start',behavior:'instant'});}});const contextForm=document.querySelector('#review-context-form');if(contextForm){window.GarrawayReview.bind(contextForm);contextForm.onsubmit=ev=>{ev.preventDefault();mutate('review-context',{id:e.id,expectedVersion:e.version,reviewContext:window.GarrawayReview.collect(contextForm,e.reviewContext)});};}document.querySelector('#jump-task')?.addEventListener('click',()=>{const target=app.querySelector('[data-action]');if(target){target.focus();target.scrollIntoView?.({block:'center',behavior:'instant'});}});window.GarrawaySchedule?.bind(e,{applicant,onSave:schedule=>mutate('schedule',{id:e.id,expectedVersion:e.version,schedule}),onReport:report=>mutate('report',{id:e.id,expectedVersion:e.version,report}),message:text=>saving('failed',text)});document.querySelector('#new')?.addEventListener('click',newApplication);document.querySelector('#case-select').onchange=ev=>{if(busy||pendingCommand||consentPending){ev.target.value=selected;return;}const target=ev.target.value;ev.target.value=selected;const move=()=>{selected=target;focusedWork=null;render().catch(error=>message.textContent=error.message);};if(window.GarrawayUx)window.GarrawayUx.guard(move);else move();};const base={id:e.id,expectedVersion:e.version};if(window.GarrawaySchedule)document.querySelectorAll('#common input').forEach(input=>{if(/^(first|second)(Date|Start|End)$/.test(input.name)){input.readOnly=true;input.required=false;input.title='日時欄で編集してください';input.closest('label').hidden=true;}});document.querySelector('#common')?.addEventListener('submit',ev=>{ev.preventDefault();mutate('common',{...base,patch:Object.fromEntries(new FormData(ev.target))});});document.querySelector('#note')?.addEventListener('submit',ev=>{ev.preventDefault();mutate('internal-note',{...base,note:new FormData(ev.target).get('note')});});document.querySelector('#assign')?.addEventListener('submit',ev=>{ev.preventDefault();const f=new FormData(ev.target);mutate('assignment',{...base,caseHandler:e.caseHandler||config.defaultCaseHandler,tasks:{[f.get('taskId')]:f.get('subject')}});});app.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{if(b.dataset.id==='consent'&&e.consentWorkflow?.version!==1){message.textContent='最終利用同意書は別段階で本人が手動署名した文書が必要です。この試作から署名を自動作成しません。';return;}if(b.dataset.id==='consent'&&applicant){consentController?.openReview();return;}let candidateIndex;if(b.dataset.id==='approval'){const choice=b.closest('article').querySelector('[data-approved-candidate]');if(!choice||choice.value===''){choice?.focus();choice?.reportValidity();saving('failed','開催する候補を選択してください。');return;}candidateIndex=Number(choice.value);}mutate(b.dataset.action,{...base,taskId:b.dataset.id,...(candidateIndex===undefined?{}:{candidateIndex})});});app.querySelectorAll('[data-open]').forEach(b=>b.onclick=(event={})=>{const boxRoot=b.closest('article').querySelector('.extra');if(!event.accepted&&window.GarrawayUx){window.GarrawayUx.guard(()=>b.onclick({accepted:true}),{scope:boxRoot});return;}const deadline=b.dataset.open==='deadline',box=b.closest('article').querySelector('.extra');box.innerHTML=`<form><label>${deadline?'新しい期限':'申請者へ伝える差戻し理由'}<input name="value" type="${deadline?'date':'text'}" required maxlength="400"></label><button>変更を記録</button><button type="button" class="cancel">キャンセル</button></form>`;window.GarrawayUx?.register(box.querySelector('form'));box.querySelector('.cancel').onclick=()=>{const cancel=()=>box.replaceChildren();if(window.GarrawayUx)window.GarrawayUx.guard(cancel,{scope:box});else cancel();};box.querySelector('form').onsubmit=ev=>{ev.preventDefault();mutate(deadline?'deadline':'return-task',{...base,taskId:b.dataset.id,[deadline?'due':'reason']:new FormData(ev.target).get('value')});};});bindNotices(e);window.GarrawayUx?.bind(app);bindOperationalAutosave(e);}
document.querySelector('#refresh').onclick=()=>{if(busy||loading)return;if(consentPending){saving('unknown','同意・ヒアリングの記録結果を、同じ操作として確認してください。');return;}if(pendingCommand){saving('unknown','前の保存結果を先に確認してください。');showRetry();return;}const refresh=()=>{const generation=renderGeneration+1;return render().then(()=>{if(generation===renderGeneration)message.textContent='最新状態を読み込みました。';}).catch(error=>{if(generation===renderGeneration)message.textContent=error.message;});};if(window.GarrawayUx)return window.GarrawayUx.guard(refresh);return refresh();};render().then(()=>{if(applicant&&config.startNew===true&&!openedInitialEvent)newApplication(true);}).catch(e=>message.textContent=e.message);

function newApplication(accepted=false){if(busy||pendingCommand||consentPending)return;if(accepted!==true&&window.GarrawayUx){window.GarrawayUx.guard(()=>newApplication(true));return;}cancelRead();++renderGeneration;app.innerHTML=`<p class="intake-intro">新しいイベントの申請 · 入力は4ステップ</p><section class="panel"><h2>企画の申請</h2><p>${config.mode==='local-fixture'?'架空データでの入力確認です。':'試験用コピーに保存します。元のシートは変更しません。'}予約・送信は行いません。</p><form id="intake"><div class="fields">${Object.entries(config.fields).filter(([k])=>!['organization','phone','understanding'].includes(k)).map(([k,l])=>`<label>${esc(l)}${applicationControl(k,config.sample?.[k]??'')}</label>`).join('')}</div>${window.GarrawaySchedule?`<section id="intake-schedule"><h2>準備から完全撤収までの希望</h2>${window.GarrawaySchedule.planned(window.GarrawaySchedule.fromCommon(config.sample||{}),true,false)}</section>`:''}<p>正式な最終利用同意書は別段階で本人が署名します。</p>${config.groups.map((g,i)=>`<fieldset><legend>${esc(g.title)}</legend><ul>${g.items.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul><label><input name="group${i}" type="checkbox" required>このグループの全項目を読み、確認しました</label></fieldset>`).join('')}<label>申請者の確認署名<input name="signature" required></label><label>確認日<input type="date" name="signedDate" required></label><button class="primary">試験用に申請を保存する</button><button type="button" id="cancel-intake">戻る</button></form></section>`;if(window.GarrawaySchedule){window.GarrawaySchedule.bindPrograms(document.querySelector('#intake-schedule'));document.querySelectorAll('#intake > .fields input').forEach(input=>{if(/^(first|second)(Date|Start|End)$/.test(input.name)){input.required=false;input.closest('label').hidden=true;}});}document.querySelector('#cancel-intake').onclick=()=>window.GarrawayUx?window.GarrawayUx.guard(()=>render()):render();document.querySelector('#intake').onsubmit=ev=>{ev.preventDefault();const f=new FormData(ev.target),input=Object.fromEntries(Object.keys(config.fields).map(k=>[k,f.get(k)]));if(document.querySelector('#intake-schedule')){input.schedule=window.GarrawaySchedule.collect(document.querySelector('#intake-schedule'));input.schedule.candidates.forEach((c,i)=>{const p=i===0?'first':'second';input[p+'Date']=c.date;input[p+'Start']=c.eventStart;input[p+'End']=c.eventEnd;});const check=window.GarrawaySchedule.assess(input.schedule);if(check.issues.length){saving('failed',check.issues.join('。'));return;}}if(window.GarrawayReview)input.reviewContext=window.GarrawayReview.collect(document.querySelector('#intake-review-context'));input.screeningConfirmation={confirmedGroups:config.groups.map((g,i)=>f.get('group'+i)==='on'),signature:f.get('signature'),signedDate:f.get('signedDate')};mutate('$submit',{input});};const intake=document.querySelector('#intake');if(window.GarrawayReview){const context=document.createElement('section');context.id='intake-review-context';context.className='review-context-fields';context.innerHTML='<h3>参加条件と、運営への相談</h3>'+window.GarrawayReview.fields({},{operating:false});intake.querySelector('.fields').append(context);window.GarrawayReview.bind(context);const examples={summary:'例：対話・体験・発表など、当日何をするかを短く。',impact:'目的：参加者にどんな変化が生まれてほしいか。',purpose:'開催理由：他の会場ではなく、ここで開く意味。',audience:'例：地域の人、学生、社員など。参加条件は下で選べます。'};for(const [name,text] of Object.entries(examples)){const help=document.createElement('small');help.className='field-hint';help.id='hint-'+name;help.textContent=text;const input=intake.querySelector('[name='+name+']');input?.setAttribute('aria-describedby',help.id);input?.closest('label').append(help);}}window.GarrawayIntake?.bind(intake);bindNotices({},true);window.GarrawayUx?.bind(app);}

window.addEventListener('beforeunload',event=>{if(busy||pendingCommand||consentPending||window.GarrawayOperationalAutosave?.current?.hasChanges()){event.preventDefault();event.returnValue='';}});document.querySelector('#nav').addEventListener('click',event=>{if(busy||pendingCommand||consentPending){event.preventDefault();if(!busy){saving('unknown','保存結果を確認してから画面を移動してください。');showRetry();}}else if(window.GarrawayUx&&event.target.closest('a')){event.preventDefault();const href=event.target.closest('a').href;window.GarrawayUx.guard(()=>{window.GarrawayUx.allowUnload();window.location.assign(href);});}});

if(sharedStaff||applicant&&window.GarrawayApplicantOtp)window.GarrawaySessionView={canLogout:()=>!busy&&!pendingCommand&&!consentPending&&!window.GarrawayOperationalAutosave?.current?.hasUnresolved(),purge:()=>{consentController?.dispose();consentController=null;consentPending=false;pendingCommand=null;busy=false;window.GarrawayOperationalAutosave?.current?.dispose();if(window.GarrawayOperationalAutosave)window.GarrawayOperationalAutosave.current=null;cancelRead();++renderGeneration;adminEvents=[];selected=null;focusedWork=null;app._noticeCleanup?.();app.replaceChildren();message.textContent='';document.querySelector('#input-state').textContent='';window.GarrawayUx?.bind(app);}};
};
;
(()=>{'use strict';
 const feedback=window.GarrawayAsyncFeedback;
 const gate=document.querySelector('#applicant-login'),body=document.querySelector('#applicant-app-body');
 const requestForm=document.querySelector('#applicant-request-form'),codeForm=document.querySelector('#applicant-code-form');
 const status=document.querySelector('#applicant-status'),resend=document.querySelector('#applicant-resend'),reload=document.querySelector('#applicant-reload');
 const generic='入力内容が登録情報と一致し、送信できる場合に確認コードが届きます。';
 const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const id=value=>typeof value==='string'&&/^[A-Za-z0-9-]{1,80}$/.test(value);
 const fail=(code,message='確認できませんでした。入力内容と新しい確認コードをお確かめください。')=>Object.assign(Error(message),{code});
 let token=null,eventId=null,generation=0,started=false,closed=false,busy=false,challenge=null,request=null;
 let expiresAt=0,idleTimeoutMs=0,idleUntil=0,resendUntil=0,consentRequest=null,sessionTimer=null,resendTimer=null,challengeTimer=null;
 // Applicant credentials live only in this closure and JSON request bodies.
 // Never persist them or include them in navigation URLs.
 const APPLICANT_API='https://garraway-event-review-oct03.delpiero.chatgpt.site/api/github/applicant';
 const RPC_TIMEOUT_MS=55000;
 function rpc(input){
  return new Promise((resolve,reject)=>{
   const controller=new AbortController();
   let settled=false,rejected=false;
   const timer=setTimeout(()=>{
    finish(reject,fail('OUTCOME_UNKNOWN','接続結果を確認できません。'));
    controller.abort();
   },RPC_TIMEOUT_MS);
   function finish(fn,value){
    if(settled)return;
    settled=true;rejected=fn===reject;clearTimeout(timer);fn(value);
   }
   (async()=>{
    try{
     const response=await fetch(APPLICANT_API,{
      method:'POST',mode:'cors',credentials:'omit',redirect:'error',
      cache:'no-store',referrerPolicy:'no-referrer',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({request:input}),signal:controller.signal,
      keepalive:input.action==='logout'
     });
     // Require an exact JSON envelope, never HTML, JSONP, or an XSSI wrapper.
     const contentType=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
     if(response.redirected||contentType!=='application/json')throw fail('OUTCOME_UNKNOWN');
     const result=JSON.parse(await response.text());
     if(!result||typeof result!=='object'||Array.isArray(result))throw fail('OUTCOME_UNKNOWN');
     const keys=Object.keys(result).sort().join(',');
     const success=response.ok&&result.ok===true&&keys==='data,ok';
     const failure=result.ok===false&&keys==='error,ok'&&result.error&&
      typeof result.error==='object'&&!Array.isArray(result.error)&&
      typeof result.error.code==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(result.error.code);
     if(settled){
      // A late verification response must not leave a newly issued session active.
      if(rejected&&input.action==='verify-resume'&&hex(result?.data?.token))revoke(result.data.token,result.data.eventId);
      return;
     }
     if(success)finish(resolve,result.data);
     else finish(reject,fail(failure?result.error.code:'OUTCOME_UNKNOWN'));
    }catch{
     // A lost response is not evidence that a save or submission failed.
     finish(reject,fail('OUTCOME_UNKNOWN','接続結果を確認できません。'));
    }
   })();
  });
 }
 function revoke(previous,previousId){if(hex(previous)&&id(previousId))rpc({action:'logout',token:previous,eventId:previousId}).catch(()=>{});}
 function controls(){
  requestForm.querySelectorAll('input,select,button').forEach(node=>{node.disabled=busy||closed;});
  codeForm.querySelectorAll('input,button').forEach(node=>{node.disabled=busy||closed;});
  resend.disabled=busy||closed||Date.now()<resendUntil;
  if(!closed&&Date.now()<resendUntil){resend.textContent='再送まで '+Math.ceil((resendUntil-Date.now())/1000)+'秒';clearTimeout(resendTimer);resendTimer=setTimeout(controls,1000);}else resend.textContent='確認コードを再送する';
 }
 function clearEntry(){codeForm.elements.code.value='';challenge=null;clearTimeout(challengeTimer);}
 function purge(message){
  feedback.clear();generation++;closed=true;token=null;eventId=null;request=null;consentRequest=null;busy=false;clearEntry();
  clearTimeout(sessionTimer);clearTimeout(resendTimer);expiresAt=0;idleUntil=0;
  window.GarrawaySessionView?.purge();window.GarrawayUx?.lock();
  document.querySelectorAll('.list-modal-backdrop,.unsaved-dialog').forEach(node=>node.remove());
  body.querySelectorAll('input,textarea').forEach(node=>{node.value='';});body.replaceChildren();body.hidden=true;
  requestForm.reset();requestForm.elements.eventId.value='';requestForm.elements.email.value='';requestForm.hidden=true;codeForm.hidden=true;
  document.querySelector('#config').textContent='{}';document.body.classList.add('applicant-locked');gate.hidden=false;status.textContent=message;reload.hidden=false;controls();
 }
 function scheduleExpiry(){clearTimeout(sessionTimer);if(token)sessionTimer=setTimeout(()=>purge('利用時間が終了しました。安全のため画面を消しました。再読み込みして新しいコードで確認してください。'),Math.max(0,Math.min(expiresAt,idleUntil)-Date.now()));}
 async function authenticated(input){
  if(closed||!token||Date.now()>=Math.min(expiresAt,idleUntil)){if(!closed)purge('利用時間が終了しました。ページを再読み込みしてください。');throw fail('SESSION_EXPIRED');}
  const ticket=generation;idleUntil=Date.now()+idleTimeoutMs;scheduleExpiry();
  try{const result=await rpc({...input,token,eventId});if(ticket!==generation||closed)throw fail('SESSION_EXPIRED');if(Date.now()>=Math.min(expiresAt,idleUntil)){purge('利用時間が終了しました。再読み込みして確認してください。');throw fail('SESSION_EXPIRED');}return result;}
  catch(error){if(ticket!==generation||closed)throw fail('SESSION_EXPIRED');if(error.code==='SESSION_EXPIRED'||error.code==='OTP_DISABLED'||error.code==='OTP_INVALID'&&['read','list','mutate','consent-review'].includes(input.action))purge('確認の期限が切れたか、利用を継続できません。再読み込みして確認してください。');throw error;}
 }
 function runner(success=()=>{},failure=()=>{}){return {withSuccessHandler:fn=>runner(fn,failure),withFailureHandler:fn=>runner(success,fn),workflowRpc(input){
  let payload;
  if(input.id&&input.id!==eventId){success({ok:false,error:{code:'FORBIDDEN',message:'この申請を表示できません。'}});return;}
  if(['read','list','consent-review'].includes(input.action))payload={action:input.action};
  else if(input.action==='consent-agree'&&input.command&&input.proof)payload={action:'agree',command:input.command,challengeId:input.proof.challengeId,code:input.proof.code};
  else if(['common','schedule','review-context','hearing','report','submit-task'].includes(input.action)){const {action,...command}=input;payload={action:'mutate',actionName:action,command};}
  else{success({ok:false,error:{code:'FORBIDDEN',message:'この操作は利用できません。'}});return;}
  authenticated(payload).then(data=>success({ok:true,data}),error=>success({ok:false,error:{code:error.code||'OUTCOME_UNKNOWN',message:error.message}})).catch(failure);
 }};}
 window.GarrawayApplicantOtp=Object.freeze({requestConsentCode:async review=>{
  const bound={eventVersion:review.eventVersion,documentVersion:review.documentVersion,documentHash:review.documentHash,conditionsHash:review.conditionsHash};
  const fingerprint=JSON.stringify(bound);
  if(!consentRequest||consentRequest.fingerprint!==fingerprint)consentRequest={fingerprint,key:crypto.randomUUID()};
  const result=await authenticated({action:'request-consent',key:consentRequest.key,review:bound});
  if(!validAck(result))throw fail('OTP_UNAVAILABLE');consentRequest=null;return {challengeId:result.challengeId,expiresInSeconds:result.expiresInSeconds,resendAfterSeconds:result.resendAfterSeconds};
 }});
 function validAck(value){return value?.accepted===true&&hex(value.challengeId)&&Number.isInteger(value.expiresInSeconds)&&value.expiresInSeconds>0&&value.expiresInSeconds<=600&&Number.isInteger(value.resendAfterSeconds)&&value.resendAfterSeconds>=60&&value.resendAfterSeconds<=600;}
 function safeBootstrap(session){
  const b=session?.bootstrap;
  if(!hex(session?.token)||session.eventId!==request?.eventId||!id(session.eventId)||!Number.isSafeInteger(session.expiresAt)||session.expiresAt<=Date.now()||session.expiresAt>Date.now()+7200000||!Number.isSafeInteger(session.idleTimeoutMs)||session.idleTimeoutMs<=0||session.idleTimeoutMs>7200000||b?.role!=='applicant'||!b.fields||typeof b.fields!=='object'||Array.isArray(b.fields)||!Object.values(b.fields).every(value=>typeof value==='string'&&value.length<200)||!Array.isArray(b.groups)||b.capabilities?.submit!==false)throw fail('OTP_UNAVAILABLE');
  
  return {mode:'applicant-otp',role:'applicant',fields:b.fields,groups:b.groups,capabilities:{submit:false},initialEventId:session.eventId,pageTitle:'申請内容の確認｜デモ版｜Garraway F',notice:'申請時のメールで確認した、この申請だけを表示しています。最終利用同意では別の新しい確認コードを使います。'};
 }
 async function sendCode(){
  if(busy||closed||Date.now()<resendUntil||!request)return;const ticket=generation;busy=true;clearEntry();resendUntil=Date.now()+60000;controls();status.textContent='確認コードを依頼しています…';const activity=feedback.begin(status.textContent,{buttons:[requestForm.querySelector('button[type=submit]'),resend],slow:'コードの依頼結果を待っています。再送可能になるまでお待ちください。'});
  try{const result=await rpc(request);if(ticket!==generation||closed)return;if(!validAck(result))throw fail('OTP_UNAVAILABLE');
   request={...request,key:crypto.randomUUID()};challenge={id:result.challengeId,expiresAt:Date.now()+result.expiresInSeconds*1000};resendUntil=Math.max(resendUntil,Date.now()+result.resendAfterSeconds*1000);
   requestForm.hidden=true;codeForm.hidden=false;status.textContent=generic;activity.finish('success','確認コードの依頼を受け付けました。'+generic);
   challengeTimer=setTimeout(()=>{if(ticket===generation&&!closed){clearEntry();status.textContent='コードの有効期間が終了しました。新しいコードを依頼してください。';}},result.expiresInSeconds*1000);
  }catch(error){if(ticket===generation&&!closed){codeForm.hidden=false;requestForm.hidden=true;status.textContent=error.code==='OTP_DISABLED'?'申請者用の確認はまだ準備中です。':error.message;activity.finish(error.code==='OTP_DISABLED'?'error':'unknown',status.textContent);}}
  finally{activity.cancel();if(ticket===generation&&!closed){busy=false;controls();codeForm.elements.code.focus();}}
 }
 requestForm.addEventListener('submit',event=>{event.preventDefault();if(busy||closed||requestForm.hidden||Date.now()<resendUntil||!requestForm.reportValidity())return;const enteredId=requestForm.elements.eventId.value.trim(),email=requestForm.elements.email.value.trim();if(!id(enteredId)){status.textContent='受付番号を確認してください。';return;}generation++;request={action:'request-resume',eventId:enteredId,email,key:crypto.randomUUID()};sendCode();});
 resend.onclick=sendCode;
 document.querySelector('#applicant-restart').onclick=()=>{if(busy||closed)return;feedback.clear();generation++;clearEntry();request=null;requestForm.hidden=false;codeForm.hidden=true;status.textContent='';controls();requestForm.elements.eventId.focus();};
 codeForm.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||closed)return;const code=codeForm.elements.code.value;codeForm.elements.code.value='';
  if(!/^\d{8}$/.test(code)||!challenge||challenge.expiresAt<=Date.now()){status.textContent='有効な8桁の確認コードを入力してください。';return;}
  const ticket=generation;busy=true;controls();status.textContent='確認しています…';const activity=feedback.begin('メールを確認しています…',{buttons:[codeForm.querySelector('button[type=submit]')]});
  try{const session=await rpc({action:'verify-resume',challengeId:challenge.id,code});
   if(ticket!==generation||closed){revoke(session?.token,session?.eventId);return;}
   let bootstrap;try{bootstrap=safeBootstrap(session);}catch(error){revoke(session?.token,session?.eventId);throw error;}
   token=session.token;eventId=session.eventId;expiresAt=session.expiresAt;idleTimeoutMs=session.idleTimeoutMs;idleUntil=Date.now()+idleTimeoutMs;clearEntry();request=null;requestForm.reset();requestForm.elements.email.value='';requestForm.elements.eventId.value='';gate.hidden=true;body.hidden=false;document.body.classList.remove('applicant-locked');scheduleExpiry();
   if(started)throw fail('OTP_UNAVAILABLE');started=true;activity.finish('success','メールを確認しました。申請の読み込みへ進みます。');window.gfStartApplicantApp_(bootstrap,runner());window.gfStartApplicantApp_=null;document.querySelector('#config').textContent='{}';
  }catch(error){if(ticket===generation&&!closed){if(token)purge('画面を開けませんでした。ページを再読み込みしてください。');else{status.textContent=error.message;activity.finish('error',status.textContent);}}}
  finally{activity.cancel();if(ticket===generation&&!closed){codeForm.elements.code.value='';busy=false;controls();}}
 });
 document.querySelector('#applicant-logout').onclick=()=>{const previous=token,previousId=eventId;purge('ログアウトして画面を消しました。送信中だった操作は次回ログイン後に結果を確認してください。再び利用する場合は再読み込みしてください。');if(hex(previous)&&id(previousId)){const activity=feedback.begin('この画面の確認情報は消去済みです。終了要求の応答を待っています…',{slow:'この画面の確認情報は消去済みです。サーバー側の終了はまだ確認できていません。'});rpc({action:'logout',token:previous,eventId:previousId}).then(()=>activity.finish('success','この画面の確認情報は消去済みです。終了要求への応答を受け取りました。'),()=>activity.finish('unknown','この画面の確認情報は消去済みです。サーバー側の終了結果は確認できませんでした。'));}};
 reload.onclick=()=>{window.GarrawayUx?.allowUnload();location.reload();};
 window.addEventListener('pagehide',()=>{const previous=token,previousId=eventId;purge('安全のため画面を消しました。再読み込みして確認してください。');revoke(previous,previousId);});
 
 try{const initial=JSON.parse(document.querySelector('#config').textContent);const url=new URL(location.href);const values=url.searchParams.getAll('event');const hint=initial.initialEventId||(url.search.length<=2048&&values.length===1?values[0]:null);if(id(hint))requestForm.elements.eventId.value=hint;}catch{}
 document.querySelector('#config').textContent='{}';

 controls();
})();

