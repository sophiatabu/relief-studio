import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {highlightSource,normalizeLights,syncLightRig} from '../src/lighting.js';
test('highlight light survives recipe serialization and emits from a narrow strip',()=>{
 const source=normalizeLights(JSON.parse(JSON.stringify([highlightSource()])))[0];
 assert.equal(source.shape,'strip');assert.equal(source.blendMode,'none');assert.equal(source.richness,0);
 const scene=new THREE.Scene(),objects=new Map();syncLightRig(scene,objects,[source]);const light=objects.get(source.id);
 assert.ok(light.isRectAreaLight);assert.ok(light.height/light.width>15);
 const energy=light.width*light.height*light.intensity;source.softness=3;syncLightRig(scene,objects,[source]);
 assert.ok(Math.abs(light.width*light.height*light.intensity-energy)<1e-6);
 source.enabled=false;syncLightRig(scene,objects,[source]);assert.equal(light.intensity,0);
});
test('physical light uses only the strength shared by both material groups',()=>{
 const scene=new THREE.Scene(),objects=new Map(),source=normalizeLights([{surfaceInfluence:1,contourInfluence:.2}])[0];syncLightRig(scene,objects,[source]);
 const light=objects.get(source.id),split=light.intensity;source.contourInfluence=1;syncLightRig(scene,objects,[source]);
 assert.ok(Math.abs(light.intensity*.2-split)<1e-8);
});
