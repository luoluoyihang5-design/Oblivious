import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutoSleep } from '../src/auto-sleep.mjs';
import { normalize, patchPreferences } from '../src/model.mjs';
function fixture() {
  let now=0,id=0; const jobs=new Map(),events=[];
  const controller=createAutoSleep({now:()=>now,schedule:(fn,ms)=>{const key=++id;jobs.set(key,{fn,at:now+ms});return key;},unschedule:key=>jobs.delete(key),onSleep:()=>events.push('sleep'),onWake:()=>events.push('wake')});
  return { controller,events,advance(ms){const target=now+ms;while(true){const next=[...jobs].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>target)break;now=next[1].at;jobs.delete(next[0]);next[1].fn();}now=target;} };
}
test('all preset and custom delays sleep exactly once and persist until pet interaction',()=>{
  for(const minutes of [5,10,15,30,7]){
    const f=fixture();f.controller.configure({enabled:true,eligible:true,minutes});
    f.advance(minutes*60000-1);assert.deepEqual(f.events,[]);
    f.advance(1);assert.deepEqual(f.events,['sleep']);
    f.advance(24*60000);assert.deepEqual(f.events,['sleep']);
    assert.equal(f.controller.sleeping,true);
    f.controller.touch();assert.deepEqual(f.events,['sleep','wake']);
    f.advance(minutes*60000);assert.equal(f.events.at(-1),'sleep');
  }
});
test('interaction resets only the pet clock; disabled/hidden/custom modes never auto sleep',()=>{
  const f=fixture();f.controller.configure({enabled:true,eligible:true,minutes:5});
  f.advance(4*60000);f.controller.touch();f.advance(60000);assert.equal(f.events.length,0);
  f.advance(4*60000);assert.deepEqual(f.events,['sleep']);
  f.controller.configure({enabled:true,eligible:false,minutes:5});assert.equal(f.events.at(-1),'wake');
  f.advance(10*60000);assert.equal(f.events.length,2);
  f.controller.configure({enabled:false,eligible:true,minutes:5});f.advance(10*60000);assert.equal(f.events.length,2);
  f.controller.sleep();assert.equal(f.events.at(-1),'sleep'); // right-menu sleep does not require auto mode
  f.controller.touch();assert.equal(f.events.at(-1),'wake');
  f.controller.destroy();f.controller.touch();f.advance(24*60000);assert.equal(f.events.at(-1),'wake');
});
test('auto sleep settings migrate safely and persist presets/custom minutes',()=>{
  assert.equal(normalize({}).autoSleepEnabled,false);assert.equal(normalize({}).autoSleepMinutes,5);
  for(const minutes of [5,10,15,30,8])assert.equal(normalize(JSON.parse(JSON.stringify(patchPreferences(normalize({}),{autoSleepEnabled:true,autoSleepMinutes:minutes})))).autoSleepMinutes,minutes);
  assert.equal(normalize({autoSleepMinutes:0}).autoSleepMinutes,1);
  assert.equal(normalize({autoSleepMinutes:9999}).autoSleepMinutes,1440);
  assert.throws(()=>patchPreferences(normalize({}),{autoSleepMinutes:NaN}));
  assert.throws(()=>patchPreferences(normalize({}),{autoSleepEnabled:'true'}));
});
