import test from 'node:test';
import assert from 'node:assert/strict';
import {installWindowSelectionClear} from '../src/part-selection.js';

class PointerTarget extends EventTarget{
 closest(){return this.preserved?{}:null;}
 dispatch(type,{pointerId=1,button=0,x=0,y=0,preserved=false}={}){
  this.preserved=preserved;const event=new Event(type);Object.assign(event,{pointerId,button,clientX:x,clientY:y});this.dispatchEvent(event);
 }
}

test('a click anywhere clears selection while part controls and drags preserve it',()=>{
 const target=new PointerTarget();let clears=0;installWindowSelectionClear(target,()=>clears++);
 target.dispatch('pointerdown');target.dispatch('pointerup');assert.equal(clears,1);
 target.dispatch('pointerdown',{preserved:true});target.dispatch('pointerup',{preserved:true});assert.equal(clears,1);
 target.dispatch('pointerdown');target.dispatch('pointermove',{x:6});target.dispatch('pointerup',{x:6});assert.equal(clears,1);
 target.dispatch('pointerdown',{pointerId:2});target.dispatch('pointercancel',{pointerId:2});target.dispatch('pointerup',{pointerId:2});assert.equal(clears,1);
});
