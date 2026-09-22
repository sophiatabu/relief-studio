import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchByColor,disposeRenderPipeline,refreshBatchMaterials,setModelDepth,createRenderScheduler,EXTRUDE_DEFAULTS} from '../src/render-pipeline.js';

function fixture(){
 const model=new THREE.Group();model.userData.baseDepth=8;model.scale.setScalar(.01);
 for(let i=0;i<4;i++){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:i<3?'#ff0000':'#0000ff'}));
  mesh.position.x=i*3;mesh.userData={regionId:String(i),role:'enamel'};model.add(mesh);
 }
 return model;
}
test('color batches preserve positions, triangle counts and individual ranges',()=>{
 const model=fixture();assert.equal(batchByColor(model),2);
 assert.equal(model.children.length,2);
 assert.deepEqual(model.children.map(m=>m.userData.colorKey).sort(),['#0000ff','#ff0000']);
 const red=model.children.find(m=>m.userData.colorKey==='#ff0000');
 assert.equal(red.geometry.attributes.position.count,108);
 assert.deepEqual(red.userData.parts.map(p=>p.start),[0,36,72]);
 red.geometry.computeBoundingBox();assert.equal(red.geometry.boundingBox.max.x,6.5);
 for(const mesh of model.children){assert.equal(mesh.geometry.groups.length,0);for(const a of Object.values(mesh.geometry.attributes))assert.equal(a.count,mesh.geometry.attributes.position.count);}
 disposeRenderPipeline(model);
});
test('material editing splits and regroups without changing vertices or part IDs',()=>{
 const model=fixture();batchByColor(model);
 refreshBatchMaterials(model,part=>new THREE.MeshStandardMaterial({color:part.regionId==='1'?'#00ff00':'#ff0000'}));
 assert.equal(model.children.length,2);
 assert.equal(model.children.reduce((sum,m)=>sum+m.geometry.attributes.position.count,0),144);
 assert.deepEqual(model.children.flatMap(m=>m.userData.parts.map(p=>p.regionId)).sort(),['0','1','2','3']);
 disposeRenderPipeline(model);
});
test('depth scales existing geometry and keeps XY unchanged',()=>{
 const model=fixture();batchByColor(model);const geometry=model.children[0].geometry;
 assert.equal(setModelDepth(model,16),true);assert.equal(model.scale.z,.02);
 assert.equal(model.scale.x,.01);assert.equal(model.children[0].geometry,geometry);
 assert.equal(setModelDepth(model,NaN),false);disposeRenderPipeline(model);
});
test('disposal releases shared geometry and material arrays exactly once',()=>{
 const model=new THREE.Group(),g=new THREE.BoxGeometry(),a=new THREE.MeshBasicMaterial(),b=new THREE.MeshBasicMaterial();
 let geometries=0,materials=0;g.addEventListener('dispose',()=>geometries++);a.addEventListener('dispose',()=>materials++);b.addEventListener('dispose',()=>materials++);
 model.add(new THREE.Mesh(g,[a,b]),new THREE.Mesh(g,a));disposeRenderPipeline(model);
 assert.equal(geometries,1);assert.equal(materials,2);assert.equal(model.children.length,0);
});
test('scheduler coalesces inputs, stops after refinement and cancels teardown',()=>{
 const queue=new Map();let serial=0,calls=0;
 const scheduler=createRenderScheduler(()=>++calls<3,{schedule:fn=>{queue.set(++serial,fn);return serial;},cancel:id=>queue.delete(id)});
 scheduler.requestRender();scheduler.requestRender();assert.equal(queue.size,1);
 while(queue.size){const [id,fn]=queue.entries().next().value;queue.delete(id);fn(0);}
 assert.equal(calls,3);assert.equal(queue.size,0);
 scheduler.requestRender();scheduler.dispose();assert.equal(queue.size,0);scheduler.requestRender();assert.equal(queue.size,0);
});
test('extrusion defaults are low resolution at the source',()=>{assert.deepEqual(EXTRUDE_DEFAULTS,{curveSegments:3,steps:1,bevelSegments:1});});

test('production badge batches rim caps and bodies with complete finite attributes',async()=>{
 const {buildBadge,disposeModel}=await import('../src/geometry.js');
 const box=(x,y,w)=>[{X:x*1000,Y:y*1000},{X:(x+w)*1000,Y:y*1000},{X:(x+w)*1000,Y:(y+w)*1000},{X:x*1000,Y:(y+w)*1000}];
 const {model,metrics}=buildBadge({name:'Fixture',regions:[{id:'rim',role:'rim',loops:[box(100,100,40)],color:{r:0,g:0,b:0}},{id:'plate',role:'metal-plate',loops:[box(160,100,20)],color:{r:.5,g:.5,b:.5}}]}, {height:9,bevel:1,dome:0,roughness:.5,gloss:.4,rimWidthGain:1});
 assert.equal(new Set(model.children.map(m=>m.userData.colorKey)).size,model.children.length);
 assert.equal(metrics.drawCalls,model.children.length);
 assert.ok(metrics.triangles>0);
 for(const mesh of model.children){
  for(const attribute of Object.values(mesh.geometry.attributes)){assert.equal(attribute.count,mesh.geometry.attributes.position.count);assert.ok(attribute.array.every(Number.isFinite));}
 }
 const rim=model.children.find(m=>m.userData.role==='rim');
 assert.ok(rim.geometry.attributes.surfaceRole.array.includes(2));
 assert.ok(rim.geometry.attributes.surfaceRole.array.includes(3));
 disposeModel(model);
});

test('equal pigment with different light response remains in separate batches',()=>{
 const model=fixture();model.children[1].material.roughness=.12;model.children[2].userData.role='rim';batchByColor(model);
 assert.equal(model.children.length,4);disposeRenderPipeline(model);
});
test('uniform roughness edit reuses geometry and material identities',()=>{
 const model=fixture();batchByColor(model);const geometries=model.children.map(m=>m.geometry),materials=model.children.map(m=>m.material);
 const changed=refreshBatchMaterials(model,(part,old)=>new THREE.MeshStandardMaterial({color:old.color,roughness:.12}));
 assert.equal(changed,false);assert.deepEqual(model.children.map(m=>m.geometry),geometries);assert.deepEqual(model.children.map(m=>m.material),materials);
 assert.ok(model.children.every(m=>m.material.roughness===.12));disposeRenderPipeline(model);
});
