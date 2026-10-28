import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../../public/event-management-demo/concierge.html',import.meta.url),'utf8');
const helper=html.slice(html.indexOf('function createStaffNavigationIndex'),html.indexOf('window.gfStartStaffApp_='));
const renderer=html.slice(html.indexOf('async function render({navigationOnly'),html.indexOf('let focusedWork=null;'));
let checks=0;const check=(a,b)=>{assert.deepEqual(a,b);checks++;};
function setup({role='shared-concierge'}={}){
 let clock=1000, calls=[],queued=Promise.resolve(),pending=[],paint=[],list=[{id:'A',title:'A'},{id:'B',title:'B'}];
 const node={classList:{toggle(){},remove(){}},setAttribute(){},prepend(){},querySelector(){return null;},innerHTML:''};
 const context={console,Set,Date,Promise,config:{mode:'live',role},sharedStaff:role==='shared-concierge',applicant:role==='applicant',consentPending:false,renderGeneration:0,initialEventResolved:true,initialEventId:null,selected:'A',adminListOpen:false,adminEvents:[],consentController:null,openedInitialEvent:false,app:node,message:{textContent:''},document:{querySelector(){return node;},createElement(){return{};},body:node},window:{GarrawayDashboard:{},GarrawayUx:{bind(){},snapshot:()=>({}),changedSince:()=>false,guard:fn=>fn()}},listReadStatus(){},renderRolePage(e){paint.push(e);return e.id;},bind(){},bindRolePage(){},bindCaseSearch(){},validListSnapshot:()=>true};
 context.api=(path='')=>{calls.push(path);const run=()=>new Promise((resolve,reject)=>pending.push({path,resolve,reject}));const result=queued.then(run);queued=result.catch(()=>{});return result;};
 vm.createContext(context);vm.runInContext(helper+';const navigationIndex=createStaffNavigationIndex({now:()=>clock});'+renderer,context);context.clock=clock;
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 const settle=async(value,error)=>{await tick();const p=pending.shift();assert.ok(p,'pending RPC');if(error)p.reject(error);else p.resolve(value===undefined?(p.path?{id:p.path.slice(1),version:9,canManage:false}:list):value);await tick();};
 return {c:context,calls,paint,pending,tick,settle,remember:()=>vm.runInContext('navigationIndex.remember('+JSON.stringify(list)+')',context),run:options=>context.render(options),clear:()=>vm.runInContext('navigationIndex.clear()',context)};
}
// Actual render code, with the same serialized dispatch shape as production.
let t=setup();t.remember();let p=t.run({navigationOnly:true});await t.settle();await p;check(t.calls,['/A']);check(t.paint[0].version,9);check(t.paint[0].canManage,false);
t=setup();t.remember();p=t.run();await t.settle();await t.settle();await p;check(t.calls,['','/A']);
t=setup();t.remember();t.c.clock+=30000;p=t.run({navigationOnly:true});await t.settle();await p;check(t.calls,['/A']);
t=setup();t.remember();t.c.clock+=600000;p=t.run({navigationOnly:true});await t.settle();await t.settle();await p;check(t.calls,['','/A']);
t=setup();t.remember();t.c.selected='unknown';p=t.run({navigationOnly:true});await t.settle();await p;check(t.calls,['']);check(t.paint.length,0);
t=setup({role:'applicant'});t.remember();p=t.run({navigationOnly:true});await t.settle();await t.settle();await p;check(t.calls,['','/A']);
for(const code of ['FORBIDDEN','NOT_FOUND','UNAUTHENTICATED','OUTCOME_UNKNOWN']){
 t=setup();t.remember();p=t.run({navigationOnly:true});const rejected=assert.rejects(p,e=>e.code===code);await t.settle(undefined,Object.assign(Error(code),{code}));await rejected;checks++;check(t.paint.length,0);check(vm.runInContext('navigationIndex.take("A")',t.c),null);
}
// A delayed response cannot overwrite newer navigation, even with queued RPCs.
t=setup();t.remember();const a=t.run({navigationOnly:true});t.c.selected='B';const b=t.run({navigationOnly:true});await t.settle({id:'A',version:1});await t.settle({id:'B',version:12});await Promise.all([a,b]);check(t.paint.map(x=>x.id),['B']);
// Session purge invalidates both navigation data and outstanding render generation.
t=setup();t.remember();p=t.run({navigationOnly:true});t.c.renderGeneration++;t.clear();t.c.selected=null;await t.settle();await p;check(t.paint.length,0);check(vm.runInContext('navigationIndex.take("A")',t.c),null);
// Inputs changed while a fresh record was loading still require the dirty guard.
t=setup();t.remember();let guarded=0;t.c.window.GarrawayUx.changedSince=()=>true;t.c.window.GarrawayUx.guard=()=>guarded++;p=t.run({navigationOnly:true});await t.settle();await p;check(guarded,1);check(t.paint.length,0);
// Deep links never reuse navigation metadata.
t=setup();t.remember();t.c.initialEventId='A';t.c.initialEventResolved=false;p=t.run({navigationOnly:true});await t.settle();await t.settle();await p;check(t.calls,['','/A']);
// Preserve unmodified mutation/retry flow; only clear metadata before dispatch.
assert.match(html,/executePending\(\)\{if\(busy\|\|!pendingCommand\)return;navigationIndex.clear\(\)/);checks++;
assert.match(html,/const result=queue.then\(\(\)=>send\(request\)\)/);checks++;
assert.match(html,/if\(inFlight.has\(fingerprint\)\)return inFlight.get\(fingerprint\)/);checks++;
// Render the real picker: a previous list date is not presented as current detail.
const picker=html.slice(html.indexOf('function casePicker'),html.indexOf('function caseSearch'));
const pickerContext={applicant:false,esc:x=>String(x),caseSearch:()=>''};vm.createContext(pickerContext);vm.runInContext(picker,pickerContext);
const oldRows=[{id:'A',title:'A',eventDate:'2026-01-01',dateBasis:'confirmed'}];
check(pickerContext.casePicker({id:'A',common:{attendance:3}},oldRows,true).includes('2026-01-01'),false);
check(pickerContext.casePicker({id:'A',common:{attendance:3}},oldRows,false).includes('2026-01-01'),true);
assert.match(html,/renderRolePage\(e,row,cases,Boolean\(navigationCases\)\)/);checks++;
assert.match(html,/beforeWrite:\(\)=>\{navigationIndex.clear\(\);\+\+renderGeneration;/);checks++;
assert.match(html,/navigationIndex.clear\(\);\+\+renderGeneration;busy=true;lockForSave\(\);/);checks++;
assert.doesNotMatch(helper,/setTimeout|setInterval/);checks++;
// Exercise production transport duplicate suppression and same-key failure behavior.
const bridge=html.slice(html.indexOf('function createAppsScriptTransport'),html.indexOf('// Navigation metadata only.'));
const transportContext={Promise,Map,Error,JSON,setTimeout,clearTimeout,crypto:{randomUUID:()=>"fixture-key"}};vm.createContext(transportContext);vm.runInContext(bridge,transportContext);
const dispatched=[];const runner=(ok=()=>{},fail=()=>{})=>({withSuccessHandler:fn=>runner(fn,fail),withFailureHandler:fn=>runner(ok,fn),workflowRpc:request=>dispatched.push({request,ok,fail})});
const transport=transportContext.createAppsScriptTransport({runner:runner(),timeoutMs:1000});
const first=transport('/A'),again=transport('/A');await new Promise(r=>setImmediate(r));check(first===again,true);check(dispatched.length,1);dispatched[0].ok({ok:true,data:{id:'A',version:15}});check((await first).version,15);await again;
const write=transport('/A/operational-record',{id:'A',key:'same-key'});const failed=assert.rejects(write,e=>e.code==='OUTCOME_UNKNOWN');await new Promise(r=>setImmediate(r));dispatched[1].fail();await failed;checks++;check(dispatched.length,2);
const retry=transport('/A/operational-record',{id:'A',key:'same-key'});await new Promise(r=>setImmediate(r));check(dispatched[2].request.key,'same-key');dispatched[2].ok({ok:true,data:{id:'A'}});await retry;
// Deterministic latency model: serial RPCs at 500 ms each, no live network claim.
console.log(JSON.stringify({checks,fixtureSerialRpcMs:500,beforeDetailRpcCount:2,afterEligibleDetailRpcCount:1,beforeModelMs:1000,afterModelMs:500,note:'Fixture/model only. No live authenticated latency measured.'}));
