import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {isBlackSilhouette} from '../src/render-health.js';
import {usePreciseGradientAtlas} from '../src/gradient-texture.js';
test('black opaque pixels fail while transparent padding is ignored',()=>{
 const pixels=new Uint8Array(64*4);
 for(let i=0;i<16;i++)pixels[i*4+3]=255;
 assert.equal(isBlackSilhouette(pixels),true);
 pixels[0]=3;
 assert.equal(isBlackSilhouette(pixels),false);
 assert.equal(isBlackSilhouette(new Uint8Array(64*4)),false);
});
test('the path tracing atlas preserves precision without half-float sampling',()=>{
 const tracer={_pathTracer:{material:{textures:{}}},textureSize:new THREE.Vector2()};
 usePreciseGradientAtlas(tracer);
 assert.equal(tracer._pathTracer.material.textures.type,THREE.FloatType);
 assert.deepEqual(tracer.textureSize.toArray(),[512,512]);
});
