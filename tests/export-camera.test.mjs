import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {squareExportCamera} from '../src/export-presets.js';
test('square PNG keeps geometry proportions for wide and tall previews',()=>{
 for(const [x,y] of [[8,1.52],[1.52,8]]){
  const source=new THREE.OrthographicCamera(-x,x,y,-y,.01,50);source.zoom=1.4;
  const exported=squareExportCamera(source);
  assert.equal(exported.right-exported.left,exported.top-exported.bottom);
  assert.equal(exported.zoom,1.4);assert.equal(source.right,x);assert.equal(source.top,y);
  const origin=new THREE.Vector3().applyMatrix4(exported.projectionMatrix),px=new THREE.Vector3(1,0,0).applyMatrix4(exported.projectionMatrix),py=new THREE.Vector3(0,1,0).applyMatrix4(exported.projectionMatrix);
  assert.equal(px.distanceTo(origin),py.distanceTo(origin));
 }
});
