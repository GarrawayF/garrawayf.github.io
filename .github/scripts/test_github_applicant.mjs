// Local-only mocked regression checks. No browser or live endpoint calls.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../public/event-management-demo/',import.meta.url));
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const helperSource=code=>code.slice(0,code.indexOf('// End async feedback.')+'// End async feedback.'.length);
const slowTimers=timers=>[...timers.timers.values()].filter(timer=>timer.ms===8000);
const delayFeedback=timers=>slowTimers(timers).forEach(timer=>timer.fn());
function timerHarness(){let serial=0;const timers=new Map();return {timers,setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}};}
async function transport(name){
 const code=fs.readFileSync(root+name+'.js','utf8');const a=code.lastIndexOf(' const APPLICANT_API='),b=code.indexOf('\n function revoke(',a);const timers=timerHarness();let calls=[],next,revocations=[];
 const c={...timers,AbortController,Error,JSON,Promise,fetch:async(...args)=>{calls.push(args);return next(...args);},error:(code)=>Object.assign(new Error(code),{code}),fail:(code)=>Object.assign(new Error(code),{code}),hex:x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),revoke:(...v)=>revocations.push(v)};vm.createContext(c);vm.runInContext(code.slice(a,b)+'\nglobalThis.rpc=rpc;',c);
 const response=(data,opts={})=>({ok:true,redirected:false,headers:{get:()=> 'application/json; charset=utf-8'},text:async()=>JSON.stringify(data),...opts});
 next=()=>response({ok:true,data:{accepted:true}});assert.deepEqual(await c.rpc({action:'request-start',email:'fictional@example.invalid',key:'fake'}),{accepted:true});
 const [url,options]=calls.at(-1);assert.equal(url,'https://garraway-event-review-oct03.delpiero.chatgpt.site/api/github/applicant');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{request:{action:'request-start',email:'fictional@example.invalid',key:'fake'}});
 for(const r of [response({ok:true,data:{}},{headers:{get:()=> 'text/html'}}),response({ok:true,data:{}},{redirected:true}),response(null),response([]),response({ok:true,data:{},extra:1}),response({ok:true,data:{}},{ok:false}),response({}, {text:async()=>'{bad json'}),response({}, {text:async()=>")]}'\n{\"ok\":true,\"data\":{}}"})]){next=()=>r;await assert.rejects(c.rpc({action:'save-draft'}),e=>e.code==='OUTCOME_UNKNOWN');}
 next=()=>response({ok:false,error:{code:'OTP_INVALID',message:'server text must not be shown'}},{ok:false});await assert.rejects(c.rpc({action:'verify-start'}),e=>e.code==='OTP_INVALID'&&!e.message.includes('server'));
 next=()=>{throw Error('offline')};await assert.rejects(c.rpc({action:'submit-draft'}),e=>e.code==='OUTCOME_UNKNOWN');
 let resolveLate;next=()=>new Promise(resolve=>resolveLate=resolve);const late=c.rpc({action:name==='applicant'?'verify-start':'verify-resume'});const rejection=assert.rejects(late,e=>e.code==='OUTCOME_UNKNOWN');const timer=[...timers.timers.values()].find(t=>t.ms===55000);assert.ok(timer);timer.fn();await rejection;assert.equal(calls.at(-1)[1].signal.aborted,true);resolveLate(response({ok:true,data:{token:'a'.repeat(64),eventId:'demo-event'}}));await tick();assert.equal(revocations.length,1);assert.equal(revocations[0][0],'a'.repeat(64));
 next=()=>response({ok:true,data:{}});await c.rpc({action:'logout',token:'a'.repeat(64)});assert.equal(calls.at(-1)[1].keepalive,true);console.log(name+': 15 transport/security checks passed');
}
function domHarness(){
 const nodes=new Map(),listeners=new Map(),created=[];
 function node(key=''){const result={key,children:[],value:'',checked:false,textContent:key==='#config'?'{}':'',hidden:false,disabled:false,dataset:{},classList:{add(){},remove(){},toggle(){}},elements:new Proxy({},{get(o,k){return o[k]??=(node(k));}}),querySelectorAll(){return [];},querySelector(q){return get(q);},replaceChildren(...items){this.children=[...items];},append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},attributes:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},getAttribute(k){return this.attributes[k]??null;},hasAttribute(k){return k in this.attributes;},focus(){},scrollIntoView(){},reset(){for(const n of Object.values(this.elements))n.value='';},matches(){return false;},reportValidity(){return true;},checkValidity(){return true;},addEventListener(type,fn){this['on'+type]=fn;},content:{cloneNode(){return node();}}};created.push(result);return result;}
 function get(key){if(!nodes.has(key))nodes.set(key,node(key));return nodes.get(key);}
 return {nodes,get,listeners,created,document:{querySelector:get,querySelectorAll(){return [];},createElement:node,body:node('body')},addEventListener(type,fn){listeners.set(type,fn);}};
}
async function otpFlow(name,interruptVerify=null){
 const all=fs.readFileSync(root+name+'.js','utf8');let code=name==='applicant'?all:helperSource(all)+'\n'+all.slice(all.lastIndexOf("(()=>{'use strict';"));
 const hook=name==='applicant'?"globalThis.__state=()=>({token,email,closed});globalThis.__testing={mountDraft,setStep,submitDraft,showReceipt,renderRecentReceipts,saveOnce,createDraft,openDraft,refreshDrafts};":"globalThis.__state=()=>({token,eventId,closed});";
 code=code.slice(0,code.lastIndexOf('})();'))+hook+'\n})();';
 const h=domHarness(),timers=timerHarness();let calls=[],responses=[],bootstrap,runner;const challenge='b'.repeat(64),token='a'.repeat(64),eventId='11111111-2222-3333-4444-555555555555';
 const c={...timers,document:h.document,addEventListener:h.addEventListener,location:{href:'https://garrawayf.github.io/event-management-demo/resume.html?event='+eventId,reload(){}},crypto:{randomUUID:()=> '11111111-2222-3333-4444-555555555555'},AbortController,URL,Error,Intl,Date,JSON,Set,Map,WeakMap,Promise,fetch:async(url,opts)=>{calls.push(JSON.parse(opts.body).request);const next=await responses.shift();assert.ok(next,'unexpected fetch');return {ok:true,redirected:false,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(next)};},gfStartApplicantApp_:(b,r)=>{bootstrap=b;runner=r;}};c.window=c;c.globalThis=c;Object.defineProperty(c,'localStorage',{get(){throw Error('storage touched')}});Object.defineProperty(c,'sessionStorage',{get(){throw Error('storage touched')}});vm.createContext(c);vm.runInContext(code,c);
 assert.equal(calls.length,0);const request=h.get(name==='applicant'?'#preapp-email-form':'#applicant-request-form'),form=h.get(name==='applicant'?'#preapp-code-form':'#applicant-code-form');form.hidden=true;request.elements.email.value='fictional@example.invalid';if(name==='resume'){assert.equal(request.elements.eventId.value,eventId);}responses.push({ok:true,data:{accepted:true,challengeId:challenge,expiresInSeconds:600,resendAfterSeconds:60}});const event={preventDefault(){}};request.onsubmit(event);request.onsubmit(event);assert.equal(h.get('#async-feedback').dataset.state,'busy');assert.equal(request.querySelector('button[type=submit]').getAttribute('aria-busy'),'true');await tick();assert.equal(h.get('#async-feedback').dataset.state,'success');assert.match(h.get('#async-feedback').textContent,/依頼を受け付けました/);assert.equal(request.querySelector('button[type=submit]').getAttribute('aria-busy'),null);assert.equal(slowTimers(timers).length,0);assert.equal(calls.length,1);assert.equal(calls[0].action,name==='applicant'?'request-start':'request-resume');assert.equal(form.hidden,false);
 const session=name==='applicant'?{token,email:'fictional@example.invalid',expiresAt:Date.now()+600000,idleTimeoutMs:300000,drafts:[],recentReceipts:[]}:{token,eventId,expiresAt:Date.now()+600000,idleTimeoutMs:300000,bootstrap:{role:'applicant',fields:{responsibleName:'名前'},groups:[],capabilities:{submit:false},secretShouldNeverPropagate:'ignored'}};
 const verifyReply=interruptVerify?deferred():null;responses.push(verifyReply?verifyReply.promise:{ok:true,data:session});form.elements.code.value='12345678';const verifying=form.onsubmit(event);assert.equal(h.get('#async-feedback').dataset.state,'busy');
 if(interruptVerify){form.onsubmit(event);assert.equal(calls.length,2);delayFeedback(timers);assert.equal(h.get('#async-feedback').dataset.state,'slow');const lateTimer=slowTimers(timers)[0];
  if(interruptVerify==='pagehide'){h.listeners.get('pagehide')();assert.equal(h.get('#async-feedback').hidden,true);lateTimer.fn();assert.equal(h.get('#async-feedback').hidden,true);}
  else{[...timers.timers.values()].find(timer=>timer.ms===55000).fn();await verifying;assert.equal(h.get('#async-feedback').dataset.state,'error');}
  responses.push({ok:true,data:{}});verifyReply.resolve({ok:true,data:session});await verifying;await tick();assert.equal(c.__state().token,null);assert.equal(calls.at(-1).action,'logout');assert.equal(slowTimers(timers).length,0);assert.equal(h.get('#async-feedback').hidden,interruptVerify==='pagehide');console.log(name+': delayed verification '+interruptVerify+', late-token revocation and feedback cleanup passed');return;
 }
 await verifying;await tick();assert.equal(calls[1].action,name==='applicant'?'verify-start':'verify-resume');assert.equal(c.__state().token,token);assert.equal(form.elements.code.value,'');assert.equal(request.elements.email.value,'');if(name==='resume'){assert.equal(bootstrap.initialEventId,eventId);assert.equal(bootstrap.secretShouldNeverPropagate,undefined);assert.equal(h.get('#config').textContent,'{}');
  // Query changes never expand the OTP-bound event, and an explicit other event is blocked.
  const before=calls.length;let denied;runner.withSuccessHandler(v=>{denied=v;}).workflowRpc({action:'read',id:'different-event'});assert.equal(denied.error.code,'FORBIDDEN');assert.equal(calls.length,before);
  c.location.href='https://garrawayf.github.io/event-management-demo/resume.html?event=different-event';responses.push({ok:true,data:[]});let listed;runner.withSuccessHandler(v=>{listed=v;}).workflowRpc({action:'list'});await tick();assert.equal(listed.ok,true);assert.equal(calls.at(-1).eventId,eventId);assert.equal(calls.at(-1).token,token);
  let unsafe;runner.withSuccessHandler(v=>{unsafe=v;}).workflowRpc({action:'delete-event',id:eventId});assert.equal(unsafe.error.code,'FORBIDDEN');
 }
 if(name==='applicant'){
  const editor=h.get('#preapp-draft-form');
  const values={responsibleName:'Fictional Organizer',organization:'Fictional Group',phone:'000-0000-0000',email:'fictional@example.invalid',eventTitle:'Fictional Event',summary:'Fictional event for local tests',attendance:'5',audience:'Demo attendees',purpose:'Local test',understanding:'Community space',impact:'Local verification',firstDate:'2026-12-01',firstSpace:'リビングラボ',firstSetup:'09:00',firstStart:'10:00',firstEnd:'11:00',firstClear:'12:00',secondDate:'2026-12-02',secondSpace:'リビングラボ',secondSetup:'09:00',secondStart:'10:00',secondEnd:'11:00',secondClear:'12:00'};
  const inputs=Object.keys(values).map(name=>{const n=editor.elements[name];n.name=name;return n;});
  const screening=['consent0','consent1','consent2','consent3','consent4','signature','signedDate','trialConfirmed'].map(name=>{const n=editor.elements[name];n.name=name;return n;});
  editor.querySelectorAll=selector=>selector==='[data-application]'?inputs:selector==='[data-screening],[name=trialConfirmed]'?screening:selector==='input,select,textarea,button'?[...inputs,...screening]:[];
  const application={...values,screeningConfirmation:{confirmedGroups:[true,true,true,true,true],signature:'Fictional Organizer',signedDate:'2026-10-12'}};
  const draftValue={status:'draft',draftId:'fictional-draft',version:1,email:values.email,updatedAt:new Date().toISOString(),application};
  // Delayed list/create/read use one request per action and acknowledge before resolution.
  let delayed=deferred();responses.push(delayed.promise);let beforeAction=calls.length;
  const listing=c.__testing.refreshDrafts();c.__testing.refreshDrafts();assert.equal(calls.length,beforeAction+1);delayFeedback(timers);assert.equal(h.get('#async-feedback').dataset.state,'slow');delayed.resolve({ok:true,data:{drafts:[],recentReceipts:[]}});await listing;assert.equal(h.get('#async-feedback').dataset.state,'success');
  responses.push({ok:false,error:{code:'OUTCOME_UNKNOWN'}});await c.__testing.createDraft();assert.equal(h.get('#async-feedback').dataset.state,'unknown');const createRequest=JSON.stringify(calls.at(-1));responses.push({ok:true,data:draftValue});await c.__testing.createDraft();assert.equal(JSON.stringify(calls.at(-1)),createRequest);
  delayed=deferred();responses.push(delayed.promise);beforeAction=calls.length;const reading=c.__testing.openDraft('fictional-draft',{discard:true});c.__testing.openDraft('fictional-draft',{discard:true});assert.equal(calls.length,beforeAction+1);delayFeedback(timers);delayed.resolve({ok:true,data:draftValue});await reading;assert.equal(h.get('#async-feedback').dataset.state,'success');
  // Newer edits remain dirty after a validated earlier save; no green claim for all edits.
  editor.elements.eventTitle.value='First change';delayed=deferred();responses.push(delayed.promise);beforeAction=calls.length;
  const saving=c.__testing.saveOnce();const sameSaving=c.__testing.saveOnce();assert.equal(calls.length,beforeAction+1);assert.equal(h.get('#async-feedback').dataset.state,'busy');delayFeedback(timers);assert.equal(h.get('#async-feedback').dataset.state,'slow');editor.elements.eventTitle.value='Later change';delayed.resolve({ok:true,data:{status:'draft',draftId:draftValue.draftId,version:2,updatedAt:new Date().toISOString()}});await Promise.all([saving,sameSaving]);assert.equal(h.get('#preapp-save-state').dataset.state,'dirty');assert.match(h.get('#async-feedback').textContent,/その後の変更はまだ保存/);
  // A lost response retains the exact idempotent mutation and local input on retry.
  responses.push({ok:false,error:{code:'OUTCOME_UNKNOWN'}});await assert.rejects(c.__testing.saveOnce(),e=>e.code==='OUTCOME_UNKNOWN');assert.equal(h.get('#async-feedback').dataset.state,'unknown');assert.match(h.get('#preapp-save-label').textContent,/未確認/);assert.equal(editor.elements.eventTitle.value,'Later change');const saveRequest=JSON.stringify(calls.at(-1));responses.push({ok:true,data:{status:'draft',draftId:draftValue.draftId,version:3,updatedAt:new Date().toISOString()}});await c.__testing.saveOnce({retry:true});assert.equal(JSON.stringify(calls.at(-1)),saveRequest);assert.equal(h.get('#preapp-save-state').dataset.state,'saved');
  editor.elements.eventTitle.value='Conflicting change';responses.push({ok:false,error:{code:'VERSION_CONFLICT'}});await assert.rejects(c.__testing.saveOnce(),e=>e.code==='VERSION_CONFLICT');assert.equal(h.get('#async-feedback').dataset.state,'error');assert.equal(h.get('#preapp-save-state').dataset.state,'conflict');assert.equal(editor.elements.eventTitle.value,'Conflicting change');
  c.__testing.mountDraft(draftValue);

  // Copy fills only empty secondary values, preserves its date, and never submits.
  const callsBeforeCopy=calls.length;
  editor.elements.secondSetup.value='';editor.elements.secondSpace.value='';
  editor.elements.secondStart.value='10:30';
  h.get('#preapp-copy-times').onclick();
  assert.equal(editor.elements.secondSetup.value,values.firstSetup);
  assert.equal(editor.elements.secondSpace.value,values.firstSpace);
  assert.equal(editor.elements.secondStart.value,'10:30');
  assert.equal(editor.elements.secondDate.value,values.secondDate);
  assert.match(h.get('#preapp-copy-status').textContent,/2項目/);
  assert.equal(h.get('#preapp-save-state').dataset.state,'dirty');
  assert.equal(calls.length,callsBeforeCopy);
  // Review shortcuts return directly to the requested section without mutation.
  c.__testing.mountDraft(draftValue);const beforeReviewNodes=h.created.length;
  c.__testing.setStep(4);
  const editOrganizer=h.created.slice(beforeReviewNodes).find(n=>n.attributes['aria-label']==='主催者を修正する');
  assert.ok(editOrganizer);editOrganizer.onclick();
  assert.equal(h.get('#preapp-next-step').textContent,'希望日時を入力 →');
  assert.equal(calls.length,callsBeforeCopy);
  c.__testing.mountDraft(draftValue);
  console.log('applicant: copy preserves existing values and date; direct review editing does not submit');
  editor.elements.trialConfirmed.checked=true;c.__testing.setStep(4);
  const receipt={id:eventId,version:2,stage:'01',isTrial:true};responses.push({ok:true,data:receipt});const before=calls.length;
  const submission=c.__testing.submitDraft();assert.equal(h.get('#async-feedback').dataset.state,'busy');await Promise.all([submission,c.__testing.submitDraft()]);assert.equal(h.get('#async-feedback').dataset.state,'success');assert.match(h.get('#async-feedback').textContent,/受付を確認/);assert.equal(calls.length,before+1);assert.equal(calls.at(-1).action,'submit-draft');assert.equal(calls.at(-1).draftId,'fictional-draft');assert.equal(calls.at(-1).trialConfirmed,true);
  const receiptLink=new URL(h.get('#preapp-receipt-link').href);assert.equal(receiptLink.origin,'https://garrawayf.github.io');assert.equal(receiptLink.pathname,'/event-management-demo/resume.html');assert.equal(receiptLink.searchParams.get('event'),eventId);assert.equal(h.get('#preapp-receipt-id').textContent,eventId);
  const prior=h.created.length;c.__testing.renderRecentReceipts([{id:eventId,receivedAt:Date.now(),status:'received'}]);const link=h.created.slice(prior).find(n=>n.key==='a');assert.ok(link);const recentLink=new URL(link.href);assert.equal(recentLink.pathname,'/event-management-demo/resume.html');assert.equal(recentLink.searchParams.get('event'),eventId);assert.equal(recentLink.origin,'https://garrawayf.github.io');
  console.log('applicant: delayed list/read/save, duplicate suppression, unknown same-key create/save retry, dirty snapshot, conflict, validated submit and receipt URLs passed');
 }
 responses.push({ok:true,data:{}});h.get(name==='applicant'?'#preapp-logout':'#applicant-logout').onclick();assert.equal(c.__state().token,null);assert.equal(h.get('#async-feedback').dataset.state,'busy');await tick();assert.equal(h.get('#async-feedback').dataset.state,'success');assert.equal(c.__state().token,null);assert.equal(c.__state().closed,true);assert.equal(calls.at(-1).action,'logout');if(name==='resume')assert.equal(calls.at(-1).eventId,eventId);assert.ok(!c.location.href.includes(token));console.log(name+': initial/no-auto-send, repeat-click, OTP, cleared-code, safe-bootstrap, pagehide/logout checks passed');
}

async function feedbackLifecycle(){
 const source=fs.readFileSync(root+'applicant.js','utf8'),resume=fs.readFileSync(root+'resume.js','utf8');assert.equal(helperSource(source),helperSource(resume));
 const h=domHarness(),timers=timerHarness(),c={...timers,document:h.document,Set,Map};c.window=c;vm.createContext(c);vm.runInContext(helperSource(source),c);const feedback=c.GarrawayAsyncFeedback,output=h.get('#async-feedback'),button=h.get('button');
 const fast=feedback.begin('読み込んでいます',{buttons:[button]});const staleTimer=slowTimers(timers)[0];assert.equal(output.dataset.state,'busy');fast.finish('success','確認済み');staleTimer.fn();assert.equal(output.dataset.state,'success');assert.equal(button.getAttribute('aria-busy'),null);assert.equal(slowTimers(timers).length,0);
 const outer=feedback.begin('送信結果を確認中',{priority:2,buttons:[button]}),inner=feedback.begin('保存中',{priority:0,buttons:[button]});delayFeedback(timers);assert.match(output.textContent,/通常より/);inner.finish('success','保存済み');assert.equal(button.getAttribute('aria-busy'),'true');assert.equal(output.dataset.state,'slow');outer.finish('unknown','受付結果は未確認');assert.equal(output.dataset.state,'unknown');assert.equal(button.getAttribute('aria-busy'),null);
 const old=feedback.begin('以前の読込');const oldTimer=slowTimers(timers)[0];feedback.clear();const fresh=feedback.begin('新しい読込');oldTimer.fn();old.finish('success','古い結果');assert.match(output.textContent,/新しい読込/);fresh.finish('error','読み込みエラー');assert.equal(output.dataset.state,'error');assert.equal(slowTimers(timers).length,0);
 for(const name of ['applicant','resume']){const css=fs.readFileSync(root+name+'.css','utf8');assert.ok(css.includes('prefers-reduced-motion:reduce'));assert.ok(css.includes('[data-state=unknown]'));assert.ok(css.includes('animation:none'));if(name==='resume')assert.ok(css.includes('body.applicant-locked>:not(#applicant-login):not(#async-feedback):not(script):not(style)'));const html=fs.readFileSync(root+(name==='applicant'?'index':'resume')+'.html','utf8');assert.match(html,/id="async-feedback"[^>]+role="status"[^>]+aria-live="polite"[^>]+aria-atomic="true"/);}
 console.log('shared feedback: fast/slow/settled, nested priority, stale timer, clear/logout race, busy cleanup, aria and reduced motion passed');
}
async function resumeReadWriteFeedback(){
 const source=fs.readFileSync(root+'resume.js','utf8'),h=domHarness(),timers=timerHarness();let replies=[],calls=[];
 const c={...timers,document:h.document,Set,Map,Error,Number,config:{role:'applicant',capabilities:{submit:false}},app:h.get('#app'),message:h.get('#message'),busy:false,loading:false,readActivity:null,pendingCommand:null,consentPending:false,renderGeneration:0,consentController:null,applicant:true,selected:null,initialEventId:null,initialEventResolved:true,adminEvents:[],sharedStaff:false,adminListOpen:false,listReadStatus(){},renderRolePage:()=>'<p>loaded</p>',bind(){},bindRolePage(){},bindCaseSearch(){},api:async(...args)=>{calls.push(args);const result=await replies.shift();if(result instanceof Error)throw result;return result;}};c.window=c;vm.createContext(c);vm.runInContext(helperSource(source),c);
 vm.runInContext(source.slice(source.indexOf('function saving(state,text)'),source.indexOf('\nfunction bindConsentFlow(')),c);
 const a=source.indexOf('function cancelRead(){'),b=source.indexOf('\nlet focusedWork=',a);vm.runInContext(source.slice(a,b),c);
 vm.runInContext(source.slice(source.indexOf('function listReadStatus('),source.indexOf('function validListResults(')),c);
 const start=source.indexOf("document.querySelector('#refresh').onclick="),end=source.indexOf(';render().then(',start);vm.runInContext(source.slice(start,end)+';',c);
 const refresh=h.get('#refresh'),output=h.get('#async-feedback');let delayed=deferred();replies.push(delayed.promise);const first=refresh.onclick();refresh.onclick();assert.equal(calls.length,1);assert.equal(refresh.disabled,true);assert.equal(refresh.getAttribute('aria-busy'),'true');delayFeedback(timers);assert.equal(output.dataset.state,'slow');delayed.resolve([]);await first;assert.equal(output.dataset.state,'success');assert.equal(refresh.disabled,false);assert.equal(refresh.getAttribute('aria-busy'),null);
 replies.push(Error('mock read failure'));await refresh.onclick();assert.equal(output.dataset.state,'error');assert.equal(refresh.disabled,false);
 // A newer generation wins even when the older response is delivered last.
 delayed=deferred();const latest=deferred();replies.push(delayed.promise,latest.promise);const old=c.render(),current=c.render();latest.resolve([]);await current;const settled=output.textContent;delayed.resolve([]);await old;assert.equal(output.textContent,settled);assert.equal(output.dataset.state,'success');
 // Starting a write invalidates a pending read even if the write fails with no rerender.
 delayed=deferred();replies.push(delayed.promise,Object.assign(Error('invalid edit'),{code:'VALIDATION'}));const interrupted=c.render();c.pendingCommand={eventId:'demo-event',target:'/demo-event/common',create:false,body:{key:'failed-command',expectedVersion:1}};await c.executePending();assert.equal(c.loading,false);assert.equal(refresh.disabled,false);assert.equal(h.get('#list-read-status').hidden,true);assert.equal(output.dataset.state,'error');const failureText=output.textContent;delayed.resolve([]);await interrupted;assert.equal(output.textContent,failureText);
 // A mutation timeout remains unknown and uses exactly the same command on retry.
 const command={eventId:'demo-event',target:'/demo-event/common',create:false,body:{key:'same-key',expectedVersion:1,patch:{eventTitle:'Kept input'}}};c.pendingCommand=command;delayed=deferred();replies.push(delayed.promise);const mutation=c.executePending();c.executePending();assert.equal(output.dataset.state,'busy');delayFeedback(timers);assert.equal(output.dataset.state,'slow');delayed.resolve(Object.assign(Error('response lost'),{code:'OUTCOME_UNKNOWN'}));await mutation;assert.equal(output.dataset.state,'unknown');assert.equal(c.pendingCommand,command);const sent=JSON.stringify(calls.at(-1));replies.push({id:'wrong-event',version:2});await c.executePending();assert.equal(c.pendingCommand,command);assert.equal(output.dataset.state,'unknown');replies.push({id:'demo-event',version:2});c.render=async()=>{throw Error('refresh failed')};await c.executePending();assert.equal(JSON.stringify(calls.at(-1)),sent);assert.equal(c.pendingCommand,null);assert.equal(c.message.dataset.saveState,'saved');assert.match(output.textContent,/保存は完了/);assert.equal(output.dataset.state,'unknown');assert.equal(slowTimers(timers).length,0);
 console.log('resume: immediate/slow load, refresh duplicate lock, failed load, stale read generation, same-key unknown retry and saved-but-refresh-failed passed');
}


async function consentFeedback(){
 const source=fs.readFileSync(root+'resume.js','utf8'),h=domHarness(),timers=timerHarness();const c={...timers,document:h.document,Set,Map,JSON,Error,Date,URL,crypto:{randomUUID:()=> 'fictional-operation'}};c.window=c;vm.createContext(c);vm.runInContext(helperSource(source),c);
 const end=source.indexOf('root.GarrawayConsent='),start=source.lastIndexOf('(function(root){',end),close=source.indexOf('})(window);',end)+'})(window);'.length;vm.runInContext(source.slice(start,close),c);
 const event={id:'demo-event',version:1,hearing:{}},review={eventId:event.id,eventVersion:1,conditionsHash:'c'.repeat(64),conditions:{},document:{version:'v1',hash:'d'.repeat(64),fullText:'Fictional clauses',clauses:Array.from({length:30},(_,i)=>({id:'clause'+i,group:'Fictional group',text:'Fictional clause '+i}))},missingHearing:[]};
 let read=deferred(),request=deferred(),write=deferred(),reads=0,requests=0,writes=[];
 const controller=c.GarrawayConsent.bind(h.get('container'),event,{onReview:()=>{reads++;return read.promise;},onRequestConsentCode:()=>{requests++;return request.promise;},onAgree:(command,proof)=>{writes.push(JSON.stringify({command,proof}));return write.promise;},onSaved:async()=>{throw Error('mock refresh failed');}});
 const output=h.get('#async-feedback');const reading=controller.openReview();controller.openReview();assert.equal(reads,1);assert.equal(output.dataset.state,'busy');delayFeedback(timers);assert.equal(output.dataset.state,'slow');read.resolve(review);await reading;assert.equal(output.dataset.state,'success');assert.match(output.textContent,/同意はまだ/);
 const requestButton=h.get('[data-consent-request-code]');const requesting=requestButton.onclick();requestButton.onclick();assert.equal(requests,1);delayFeedback(timers);assert.equal(output.dataset.state,'slow');request.resolve({challengeId:'b'.repeat(64),expiresInSeconds:600,resendAfterSeconds:60});await requesting;assert.equal(output.dataset.state,'success');assert.match(output.textContent,/依頼を受け付けました/);
 const form=h.get('form'),group=h.get('consent-group');group.checked=true;form.querySelectorAll=selector=>selector==='[data-consent-group]'?[group]:[];h.get('[data-consent-attested]').checked=true;h.get('[data-consent-signature]').value='Fictional signature';h.get('[data-consent-code]').value='12345678';
 const action={preventDefault(){},currentTarget:form};const writing=form.onsubmit(action);form.onsubmit(action);assert.equal(writes.length,1);assert.equal(h.get('[data-consent-code]').value,'');delayFeedback(timers);assert.equal(output.dataset.state,'slow');write.reject(Object.assign(Error('lost response'),{code:'OUTCOME_UNKNOWN'}));await writing;assert.equal(controller.hasUnresolved(),true);assert.equal(output.dataset.state,'unknown');assert.equal(h.get('[data-consent-signature]').value,'Fictional signature');
 write=deferred();const retry=h.get('[data-consent-retry]').onclick();assert.equal(writes.length,2);assert.equal(writes[0],writes[1]);write.resolve({id:event.id,version:2});await retry;assert.equal(controller.hasUnresolved(),false);assert.equal(output.dataset.state,'unknown');assert.match(output.textContent,/記録は保存されました/);assert.equal(h.get('[data-consent-signature]').value,'');
 read=deferred();const stale=controller.openReview();const timer=slowTimers(timers)[0];controller.close();timer.fn();read.resolve(review);await stale;assert.equal(output.hidden,true);assert.equal(slowTimers(timers).length,0);controller.dispose();
 console.log('consent: delayed review/request/write, duplicates, request-not-delivery acknowledgement, retained unknown same-command/proof retry, saved-but-refresh-failed, close cleanup passed');
}

async function consentReadinessRegression(){
 const source=fs.readFileSync(root+'resume.js','utf8');
 const moduleEnd=source.indexOf('root.GarrawayConsent='),moduleStart=source.lastIndexOf('(function(root){',moduleEnd),moduleClose=source.indexOf('})(window);',moduleEnd)+'})(window);'.length;
 const h=domHarness(),timers=timerHarness(),c={...timers,document:h.document,Set,Map,JSON,Error,Date,URL,crypto:{randomUUID:()=> 'fictional-readiness'}};c.window=c;vm.createContext(c);vm.runInContext(source.slice(moduleStart,moduleClose),c);
 const document={version:'fictional-v1',hash:'a'.repeat(64),fullText:'Fictional full text',clauses:Array.from({length:30},(_,i)=>({id:'clause'+i,group:'group',text:'Fictional original '+i}))};
 const event={id:'fictional-event',version:1,outcome:'active',common:{},hearing:{},canAgreeConsent:true,canProvideOperationalDetails:true,tasks:[{id:'screening',state:'done',needsReview:false}],consentWorkflow:{version:1,current:false,missingHearing:[],records:[],explanation:null,document}};
 const render=e=>c.GarrawayConsent.render(e,{applicant:true});
 assert.equal(c.GarrawayConsent.readiness(event).ready,true);assert.match(render(event),/data-consent-start/);assert.match(render(event),/個別説明は必要/);assert.match(render(event),/基本規約の確認/);
 const pending={...event,canProvideOperationalDetails:false,tasks:[{id:'screening',state:'submitted',needsReview:true}]};assert.equal(c.GarrawayConsent.readiness(pending).ready,false);assert.match(render(pending),/運営の事前確認待ち/);assert.doesNotMatch(render(pending),/data-consent-start/);assert.match(render(pending),/data-consent-reference/);for(const clause of document.clauses)assert.ok(render(pending).includes(clause.text));
 const fallback={...pending,canProvideOperationalDetails:undefined};assert.equal(c.GarrawayConsent.readiness(fallback).ready,false);
 assert.equal(c.GarrawayConsent.readiness({...pending,canProvideOperationalDetails:true}).ready,true,'server operational acceptance is authoritative');
 const missing={...event,consentWorkflow:{...event.consentWorkflow,missingHearing:['架空の不足項目']}};assert.match(render(missing),/あなたの詳細入力・確認待ち/);assert.doesNotMatch(render(missing),/data-consent-start/);
 const changed={...event,consentWorkflow:{...event.consentWorkflow,records:[{documentVersion:'old'}]}};assert.match(render(changed),/変更後の条件への再同意待ち/);assert.match(render(changed),/data-consent-start/);
 assert.match(render({...event,canAgreeConsent:false}),/本人確認の状態/);assert.doesNotMatch(render({...event,canAgreeConsent:false}),/data-consent-start/);
 assert.equal(c.GarrawayConsent.readiness({...event,outcome:'cancelled'}).ready,false);
 assert.match(render({...event,consentWorkflow:{...event.consentWorkflow,current:true}}),/最終同意は記録済み/);
 assert.equal(c.GarrawayConsent.validReview({eventId:event.id,eventVersion:1,conditionsHash:'b'.repeat(64),conditions:{},document,missingHearing:[]},event.id),true);
 assert.equal(c.GarrawayConsent.validReview({eventId:event.id,eventVersion:1,conditionsHash:'b'.repeat(64),conditions:{},document:{...document,clauses:document.clauses.slice(1)},missingHearing:[]},event.id),false);
 // Exercise actual save handlers: business prerequisites and expired auth never become uncertain saves.
 for(const [code,expected] of [['VALIDATION',/運営の事前確認待ち/],['SESSION_EXPIRED',/本人確認の期限/],['OTP_DISABLED',/確認コード機能を利用できません。運営へ確認/],['FORBIDDEN',/権限/],['OUTCOME_UNKNOWN',/保存結果を確認できません/],['VERSION_CONFLICT',/条件または文書が更新/]]){
  const local=domHarness(),ctx={...timerHarness(),document:local.document,Set,Map,JSON,Error,Date,URL,crypto:{randomUUID:()=> 'fictional-error'}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source.slice(moduleStart,moduleClose),ctx);
  const controller=ctx.GarrawayConsent.bind(local.get('container'),pending,{onSaveHearing:async()=>{throw Object.assign(Error('Generic authentication text must not leak'),{code});}});
  await local.get('[data-hearing-form]').onsubmit({preventDefault(){}});assert.match(local.get('[data-hearing-status]').textContent,expected,code);assert.doesNotMatch(local.get('[data-hearing-status]').textContent,/Generic authentication/);assert.equal(controller.hasUnresolved(),code==='OUTCOME_UNKNOWN',code);controller.dispose();
 }
 console.log('consent readiness: explanation optional, 30 original clauses, screening/review waits, authoritative gate, missing details, changed conditions, auth expiry, unknown save and version conflict passed');
}

function hearingNextActionRegression(){
 const source=fs.readFileSync(root+'resume.js','utf8'),end=source.indexOf('root.GarrawayConsent='),start=source.lastIndexOf('(function(root){',end),close=source.indexOf('})(window);',end)+'})(window);'.length;
 const c={URL,JSON,Date,Set,Map};c.window=c;vm.createContext(c);vm.runInContext(source.slice(start,close),c);
 const make=(task={},workflow={})=>({id:'fictional-hearing',outcome:'active',canAgreeConsent:true,canProvideOperationalDetails:true,tasks:[{id:'hearing',state:'pending',needsReview:false,request:'',mine:true,blockedBy:[],...task}],consentWorkflow:{version:1,current:true,records:[{}],missingHearing:[],...workflow}});
 const focus=e=>c.GarrawayConsent.hearingFocus(e,e.tasks[0]),state=e=>c.GarrawayConsent.hearingAction(e),lower=e=>c.GarrawayConsent.readinessNotice(e);
 const saved=make();assert.equal(state(saved).state,'ready');assert.match(focus(saved),/保存済みの詳細を確認して提出する/);assert.match(focus(saved),/詳細を提出して確認を依頼/);assert.match(lower(saved),/保存だけでは運営への提出は完了しません/);assert.match(focus(saved),/最終同意は記録済み/);assert.match(lower(saved),/再同意は不要/);
 const incomplete=make({}, {missingHearing:['架空の不足']});assert.equal(state(incomplete).state,'incomplete');assert.match(focus(incomplete),/当日の詳しい内容を入力する/);assert.match(focus(incomplete),/data-action="submit-task"/);
 for(const missingHearing of [undefined,null,'',{}]){const e=make({}, {missingHearing});assert.equal(state(e).state,'unknown');assert.doesNotMatch(focus(e),/必要な項目は保存されています/);assert.match(focus(e),/入力・保存状況を確認/);}
 const submitted=make({state:'submitted'});assert.equal(state(submitted).state,'waiting');assert.match(focus(submitted),/運営の受領確認待ち/);assert.doesNotMatch(focus(submitted),/data-action="submit-task"/);assert.match(lower(submitted),/運営：提出された詳細を確認/);assert.doesNotMatch(lower(submitted),/詳細を提出して確認を依頼/);
 for(const task of [{state:'submitted',needsReview:true},{state:'submitted',request:'修正依頼'},{state:'done',needsReview:true}]){const e=make(task);assert.equal(state(e).state,'revision');assert.match(focus(e),/詳細を再提出して確認を依頼/);assert.match(lower(e),/詳細を再提出/);assert.doesNotMatch(focus(e),/運営の受領確認待ち/);}
 const corrected=make({request:'<script>unsafe</script>'});assert.ok(!focus(corrected).includes('<script>'));assert.match(focus(corrected),/&lt;script&gt;/);
 const before=JSON.stringify(saved);focus(saved);lower(saved);assert.equal(JSON.stringify(saved),before,'rendering must not mutate tasks or consent');
 assert.equal(state(make({state:'done'})).state,'done');assert.equal(state({...saved,tasks:[]}),null);
 console.log('hearing next action: incomplete/saved/submitted/revision/unknown, upper-lower agreement, no auto-submit or consent mutation passed');
}

async function resumeRequestFeedbackRegression(){
 const all=fs.readFileSync(root+'resume.js','utf8'),source=helperSource(all)+'\n'+all.slice(all.lastIndexOf("(()=>{'use strict';"));
 const ack={accepted:true,challengeId:'b'.repeat(64),expiresInSeconds:600,resendAfterSeconds:60,message:'Generic backend acknowledgement'};
 const cases=[['accepted',{ok:true,data:ack},'success',/依頼を受け付けました/],['malformed-ack',{ok:true,data:{accepted:true}},'unknown',/依頼の受付結果を確認できません/],['bad-ttl',{ok:true,data:{...ack,expiresInSeconds:601}},'unknown',/依頼の受付結果を確認できません/],['backend-unavailable',{ok:false,error:{code:'OTP_UNAVAILABLE'}},'unknown',/依頼の受付結果を確認できません/],['unknown-envelope',{unexpected:true},'unknown',/依頼の受付結果を確認できません/],['network',null,'unknown',/依頼の受付結果を確認できません/],['disabled',{ok:false,error:{code:'OTP_DISABLED'}},'error',/確認コード機能を利用できません/],['rate-limit',{ok:false,error:{code:'RATE_LIMIT'}},'error',/依頼回数が上限/]];
 for(const [label,response,state,expected] of cases){
  const h=domHarness(),timers=timerHarness(),calls=[];const c={...timers,document:h.document,addEventListener:h.addEventListener,location:{href:'https://garrawayf.github.io/event-management-demo/resume.html',reload(){}},crypto:{randomUUID:()=> 'fictional-request'},AbortController,URL,Error,Date,JSON,Set,Map,fetch:async(_url,opts)=>{calls.push(JSON.parse(opts.body).request);if(response===null)throw Error('network');return {ok:response.ok!==false,redirected:false,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(response)};}};c.window=c;vm.createContext(c);vm.runInContext(source,c);
  const form=h.get('#applicant-request-form');form.hidden=false;form.elements.eventId.value='fictional-event';form.elements.email.value='fictional@example.invalid';form.onsubmit({preventDefault(){}});await tick();await tick();
  assert.equal(calls.length,1,label);assert.equal(calls[0].action,'request-resume',label);assert.equal(h.get('#async-feedback').dataset.state,state,label);assert.match(h.get('#async-feedback').textContent,expected,label);assert.doesNotMatch(h.get('#applicant-status').textContent,/新しい確認コードをお確かめください/,label);
  if(state!=='success'){assert.doesNotMatch(h.get('#async-feedback').textContent,/依頼を受け付けました/,label);assert.doesNotMatch(h.get('#applicant-status').textContent,/コード.*間違|コード.*誤り/,label);}
  // No verify request, automatic retry, or resend occurs from a request failure.
  [...timers.timers.values()].filter(t=>t.ms===1000).forEach(t=>t.fn());assert.equal(calls.length,1,label);
 }
 console.log('resume OTP request: valid v13 ACK, invalid ACK/TTL, unavailable/network, disabled/rate-limit, no false success or automatic resend passed');
}

(async()=>{await resumeRequestFeedbackRegression();hearingNextActionRegression();await consentReadinessRegression();await feedbackLifecycle();await consentFeedback();await resumeReadWriteFeedback();await transport('applicant');await transport('resume');await otpFlow('applicant');await otpFlow('resume');for(const page of ['applicant','resume'])for(const interruption of ['pagehide','timeout'])await otpFlow(page,interruption);})().catch(e=>{console.error(e);process.exitCode=1;});

