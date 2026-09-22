import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {normalizeLights,syncLightRig,moveLightOnScreen} from '../src/lighting.js';
for(const [view,eye] of [['front',[0,0,7]],['rotated',[2.5,-2.8,5.8]]])test(`drag follows pointer and persists in ${view} view`,()=>{
 const camera=new THREE.OrthographicCamera(-1.52,1.52,1.52,-1.52,.01,50);camera.position.set(...eye);camera.lookAt(0,0,.04);camera.updateMatrixWorld();
 const scene=new THREE.Scene(),objects=new Map(),sources=normalizeLights([{}, {azimuth:130,power:.45}]);syncLightRig(scene,objects,sources);
 const other=objects.get('light-1').position.clone(),depth=objects.get('light-0').position.clone().project(camera).z;
 moveLightOnScreen(sources[0],camera,.3,-.25,depth);syncLightRig(scene,objects,sources);
 const p=objects.get('light-0').position.clone().project(camera);
 assert.ok(Math.abs(p.x-.3)<1e-8&&Math.abs(p.y+.25)<1e-8);
 assert.ok(objects.get('light-1').position.equals(other));
 const restored=normalizeLights(JSON.parse(JSON.stringify(sources)));assert.deepEqual(restored,sources);
});
test('old recipes keep the original distance and dragging over the center stays finite',()=>{
 const source=normalizeLights()[0];assert.equal(source.distance,Math.hypot(3.5,3.2));
 const camera=new THREE.OrthographicCamera(-1.52,1.52,1.52,-1.52,.01,50);camera.position.z=7;camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const depth=new THREE.Vector3(0,0,3.2).project(camera).z;
 moveLightOnScreen(source,camera,0,0,depth);assert.equal(source.elevation,90);
 assert.ok(Number.isFinite(source.azimuth)&&Number.isFinite(source.distance));assert.deepEqual(normalizeLights([source])[0],source);
});
test('darkness is draggable, persists and never emits light',()=>{
 const sources=normalizeLights([{}, {kind:'dark',name:'Затемнение',distance:1.8,azimuth:-135,elevation:25,power:.7,softness:3}]);
 const scene=new THREE.Scene(),objects=new Map();syncLightRig(scene,objects,sources);
 assert.equal(objects.get('light-1').isLight,undefined);
 const camera=new THREE.OrthographicCamera(-1.52,1.52,1.52,-1.52,.01,50);camera.position.z=7;camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const depth=objects.get('light-1').position.clone().project(camera).z;
 moveLightOnScreen(sources[1],camera,-.35,-.6,depth);syncLightRig(scene,objects,sources);
 const p=objects.get('light-1').position.clone().project(camera);assert.ok(Math.abs(p.x+.35)<1e-8&&Math.abs(p.y+.6)<1e-8);
 assert.deepEqual(normalizeLights(JSON.parse(JSON.stringify(sources))),sources);
});
