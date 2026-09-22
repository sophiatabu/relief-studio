import test from 'node:test';
import assert from 'node:assert/strict';
import {shadowMultipliers,shadowChannelMultiplier} from '../src/darkness-blend.js';
import {gradientField} from '../src/gradient-field.js';
test('allocation-free gradient channels preserve old light values exactly',()=>{
 for(const base of [[0,0,0],[.001,.8,.34],[1,1,1],[.12,.24,.48]])for(let i=0;i<=200;i++){
  const a=i/200,peak=Math.max(...base,1e-6),expected=shadowMultipliers(base,a,1);
  assert.deepEqual(base.map(c=>shadowChannelMultiplier(Math.max(0,Math.min(1,c/peak)),a)),expected);
 }
 const field=gradientField([]),target=[];assert.equal(field(.2,.7,target),target);assert.deepEqual(target,field(.2,.7));
});

test('gradient export retains source alpha',async()=>{
 const {gradientTexture,exportGradientTexture}=await import('../src/gradient-texture.js');
 const THREE=await import('three');const source=gradientTexture(1);source.image.data.set([THREE.DataUtils.toHalfFloat(.2),THREE.DataUtils.toHalfFloat(.3),THREE.DataUtils.toHalfFloat(.4),THREE.DataUtils.toHalfFloat(.5)]);
 const exported=exportGradientTexture(source);assert.equal(exported.image.data[3],128);source.dispose();exported.dispose();
});
