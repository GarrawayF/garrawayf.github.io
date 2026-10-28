import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext, Script } from 'node:vm';
const html=readFileSync(new URL('../../public/event-management-demo/concierge.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
const source=scripts.find(script=>script.includes('window.GarrawayOperationalProgress={render,bind}'));
assert.ok(source);
const window={};runInNewContext(source,{window});
const tasks=[{id:'screening',status:'recorded',blockedBy:[],due:'2026-11-01'},{id:'hearing',status:'pending',blockedBy:[]},{id:'approval',status:'needs-review',blockedBy:['同意書'],due:''}];
const event={canRecordOperationalFact:true,common:{},schedule:{candidates:[]},operationalProgress:{nextTaskId:'hearing',tasks,stages:[{index:0,label:'事前申し込み',ids:['screening','hearing','approval']}]}};
const rendered=window.GarrawayOperationalProgress.render(event);
assert.match(rendered,/1 \/ 3 記録済み/);
assert.match(rendered,/✓/);assert.match(rendered,/再確認/);assert.match(rendered,/先に確認：同意書/);
assert.match(rendered,/判断・通知を確認/);
assert.match(rendered,/data-operational-task="hearing" aria-expanded="true"/);
assert.equal((rendered.match(/id="operational-record"/g)||[]).length,1);
assert.equal(window.GarrawayOperationalProgress.render({...event,canRecordOperationalFact:false}),'');
event.operationalProgress.stages[0].label='<img src=x onerror=alert(1)>';
assert.ok(!window.GarrawayOperationalProgress.render(event).includes('<img src=x'));
assert.match(source,/GarrawayUx\.guard\(change,\{scope:root\}\)/);
assert.match(source,/GarrawayUx\?\.markSaved\(form,window.GarrawayUx.capture\(form\)\)/);
assert.doesNotMatch(source,/localStorage|sessionStorage/);
assert.match(source,/fact\.result==='completed'&&\['consent','report'\]\.includes/);
assert.match(source,/fact\.result==='reopened'&&!fact\.comment/);
for(const [i,script] of scripts.entries()){
 if(script.trim().startsWith('{')){JSON.parse(script);continue;}
 new Script(script,{filename:`concierge-script-${i}.js`});
 assert.ok(html.includes(`'sha256-${createHash('sha256').update(script).digest('base64')}'`),`CSP ${i}`);
}
console.log('Admin checklist render, escaping, safeguards, script syntax and CSP checks passed.');
