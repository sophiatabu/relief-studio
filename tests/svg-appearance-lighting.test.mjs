import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDarkness} from '../src/darkness.js';
import {makeMaterial,mergeMetalRegions} from '../src/geometry.js';
import {disposeRenderPipeline} from '../src/render-pipeline.js';
test('SVG pigment texture retains spatial color/alpha and reuses geometry during light updates',()=>{
 const model=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshPhysicalMaterial({color:0xffffff}));mesh.material.userData.svgAppearance=true;mesh.userData.role='enamel';model.add(mesh);
 const pixels=new Float32Array(512*512*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=.2;pixels[i+1]=.6;pixels[i+2]=.8;pixels[i+3]=.5;}model.svgAppearance={pixels};
 const darkness=createDarkness(),geometry=mesh.geometry;darkness.update(model,[]);const map=mesh.material.map;
 assert.ok(Math.abs(THREE.DataUtils.fromHalfFloat(map.image.data[0])-.2)<.001);assert.equal(THREE.DataUtils.fromHalfFloat(map.image.data[3]),.5);
 darkness.update(model,[{kind:'dark',enabled:true,power:.3,azimuth:40,elevation:45,distance:2,softness:2,richness:0,blendMode:'neutral'}]);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material.map,map);
 let disposed=0;map.addEventListener('dispose',()=>disposed++);darkness.dispose();assert.equal(disposed,1);disposeRenderPipeline(model);
});
test('gradient metallic regions are not merged with unpainted metal',()=>{
 const loop=[[{X:0,Y:0},{X:100,Y:0},{X:100,Y:100},{X:0,Y:100}]];
 const groups=mergeMetalRegions([{id:'a',role:'rim',loops:loop},{id:'b',role:'rim',loops:loop,svgAppearance:true,gradient:{id:'g'}}]);assert.equal(groups.length,2);
 const mat=makeMaterial(groups.find(g=>g.gradient),{roughness:.4});assert.equal(mat.userData.svgAppearance,true);mat.dispose();
});
