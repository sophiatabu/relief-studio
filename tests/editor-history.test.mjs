import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHistory} from '../src/editor-history.js';
function setup(){let state={color:'#fff',height:9,source:{angle:0}};const h=createHistory(()=>state,async next=>{state=next;h.commit();});return {h,get:()=>state,set:next=>{state={...state,...next};h.commit();}};}
test('a slider gesture is one undoable action; restoration does not enter history',async()=>{const {h,get,set}=setup();h.begin();for(let height=10;height<30;height++)set({height});assert.equal(h.counts.undo,0);h.end();assert.equal(h.counts.undo,1);await h.undo();assert.equal(get().height,9);await h.redo();assert.equal(get().height,29);assert.deepEqual(h.counts,{undo:1,redo:0});});
test('branching after undo clears redo and snapshots are independent',async()=>{const {h,get,set}=setup();set({source:{angle:30}});set({color:'#000'});await h.undo();set({height:12});assert.equal(h.counts.redo,0);await h.undo();assert.deepEqual(get(),{color:'#fff',height:9,source:{angle:30}});});
test('history is capped at 100; successful document replacement clears both stacks',async()=>{const {h,set}=setup();for(let height=10;height<120;height++)set({height});assert.equal(h.counts.undo,100);await h.undo();h.reset();assert.deepEqual(h.counts,{undo:0,redo:0});});
test('nested transactions and no-op gestures do not create duplicate steps',()=>{const {h,set}=setup();h.begin();h.begin();set({height:10});h.end();assert.equal(h.counts.undo,0);h.end();assert.equal(h.counts.undo,1);h.begin();set({height:10});h.end();assert.equal(h.counts.undo,1);});
