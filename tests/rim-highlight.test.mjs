import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import{roundedRimGeometry}from'../src/rim.js';import{updateRimHighlight,edgeHighlight}from'../src/rim-highlight.js';
const lights=[{kind:'light',enabled:true,power:1,azimuth:0}];
function fixture(){const s=new THREE.Shape();s.moveTo(-30,-20);s.lineTo(30,-20);s.lineTo(30,20);s.lineTo(-30,20);s.closePath();const g=roundedRimGeometry([s],9,1.2),m=new THREE.MeshPhysicalMaterial({color:'#b5b6b2'}),mesh=new THREE.Mesh(g,m);mesh.userData.surface='rim-cap';return mesh;}
test('zero removes the stripe, strength changes edge colours without moving vertices',()=>{
 const mesh=fixture(),base=mesh.material.color.clone(),positions=mesh.geometry.attributes.position.array.slice(),settings={rimHighlight:0,rimHighlightWidth:.35};updateRimHighlight(mesh,settings,lights);
 const colors=mesh.geometry.attributes.color;for(let i=0;i<colors.count;i++)assert.ok(Math.abs(colors.getX(i)-base.r)<1e-6);
 updateRimHighlight(mesh,{...settings,rimHighlight:1},lights);assert.ok(Array.from({length:colors.count},(_,i)=>colors.getX(i)).some(v=>v>base.r+.4));assert.deepEqual(mesh.geometry.attributes.position.array,positions);assert.equal(mesh.material.emissiveIntensity,1);assert.equal(mesh.material.emissive.getHex(),0);
 updateRimHighlight(mesh,settings,lights);assert.ok(Math.abs(colors.getX(0)-base.r)<1e-6);mesh.geometry.dispose();mesh.material.dispose();
});
test('width expands the visible stripe; the plateau and unlit side remain unpainted',()=>{
 const light=[{x:0,y:1,power:1}],count=w=>Array.from({length:1001},(_,i)=>edgeHighlight(i/1000,0,1,1,w,light)).filter(v=>v>.3).length;
 assert.ok(count(1)>count(0)*3);assert.equal(edgeHighlight(1,0,1,1,1,light),0);assert.equal(edgeHighlight(.38,0,-1,1,1,light),0);assert.equal(edgeHighlight(.38,0,1,1,1,[]),0);
});

test('tracer receives opaque non-black cap colours and uploads subsequent slider changes',async()=>{
 const {PathTracingSceneGenerator}=await import('three-gpu-pathtracer');
 const cap=fixture(),scene=new THREE.Scene(),other=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshPhysicalMaterial());scene.add(other,cap);scene.updateMatrixWorld(true);
 const settings={rimHighlight:0,rimHighlightWidth:.35};updateRimHighlight(cap,settings,lights);
 const generator=new PathTracingSceneGenerator(scene),before=generator.generate();
 const values=result=>{const c=result.geometry.attributes.color;return Array.from({length:c.count},(_,i)=>[c.getX(i),c.getY(i),c.getZ(i),c.getW(i)]);};
 const initial=values(before);assert.ok(initial.every(c=>c.every(v=>v>.2)&&c[3]===1),'merged colours must remain opaque and non-black');
 updateRimHighlight(cap,{...settings,rimHighlight:1},lights);const after=generator.generate();assert.equal(after.bvhChanged,true);const changed=values(after);assert.ok(changed.some((c,i)=>c[0]>initial[i][0]+.3),'slider must change merged colour buffer');
 assert.ok(changed.every(c=>c[3]===1));cap.geometry.dispose();cap.material.dispose();other.geometry.dispose();other.material.dispose();
});
