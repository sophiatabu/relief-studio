import test from 'node:test';
import assert from 'node:assert/strict';
import {shadowMultipliers} from '../src/darkness-blend.js';
import {normalizeLights} from '../src/lighting.js';
test('zero richness and unshadowed areas preserve the original colour',()=>{
 assert.deepEqual(shadowMultipliers([.1,.5,1],.4,0),[.4,.4,.4]);
 assert.deepEqual(shadowMultipliers([.1,.5,1],1,.8),[1,1,1]);
});
test('subtle multiply brightens dominant channels and preserves neutral whites',()=>{
 const rgb=shadowMultipliers([.04,.7,1],.4,.2);
 assert.ok(rgb[2]>.4&&rgb[2]<.44);assert.ok(rgb[2]>rgb[0]);
 const white=shadowMultipliers([1,1,1],.4,.2);assert.equal(white[0],white[1]);assert.equal(white[1],white[2]);
 for(const a of [0,.01,.4,.9,1])for(const value of shadowMultipliers([0,.5,1],a,1))assert.ok(value>=0&&value<=1);
});
test('blend choice and strength persist through recipes, with safe defaults',()=>{
 const sources=normalizeLights([{kind:'dark',blendMode:'neutral',richness:.35},{kind:'dark'}]);
 assert.equal(sources[0].blendMode,'neutral');assert.equal(sources[1].richness,.2);
 assert.deepEqual(normalizeLights(JSON.parse(JSON.stringify(sources))),sources);
});
test('each source keeps independent material influence with legacy-safe defaults',()=>{
 const legacy=normalizeLights([{kind:'dark'}])[0];assert.equal(legacy.surfaceInfluence,1);assert.equal(legacy.contourInfluence,1);
 const split=normalizeLights([{kind:'dark',surfaceInfluence:.84,contourInfluence:.12}])[0];
 assert.equal(split.surfaceInfluence,.84);assert.equal(split.contourInfluence,.12);
 assert.deepEqual(normalizeLights(JSON.parse(JSON.stringify([split])))[0],split);
});
