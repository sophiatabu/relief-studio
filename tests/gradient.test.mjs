import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createDarkness} from '../src/darkness.js';import {gradientField} from '../src/gradient-field.js';import {exportGradientTexture,modelForGLTF} from '../src/gradient-texture.js';
const source={kind:'dark',enabled:true,power:.3,softness:3,distance:1.8,azimuth:-135,elevation:25,blendMode:'multiply',richness:.35};
const light={kind:'light',enabled:true,power:1,azimuth:35,blendMode:'screen',richness:.15};
function model(){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshPhysicalMaterial({color:'#333333'}));mesh.userData.role='enamel';return mesh;}
test('dark enamel retains smooth levels through half-float storage',()=>{
 const m=model(),d=createDarkness();d.update(m,[source,light]);const t=m.material.map,values=Array.from({length:512},(_,x)=>THREE.DataUtils.fromHalfFloat(t.image.data[(256*512+x)*4]));
 assert.equal(t.type,THREE.HalfFloatType);assert.ok(new Set(values).size>450);assert.ok(new Set(values.map(v=>Math.round(v*255))).size<20,'old 8-bit linear atlas reproduces the broad steps');
 assert.ok(Math.max(...values.slice(1).map((v,i)=>Math.abs(v-values[i])))<.00015);assert.ok(!d.update(m,[source,light]));d.dispose();
});
test('gradient matches original blend endpoints and keeps white neutral',()=>{
 const field=gradientField([{...source,distance:0,elevation:0,softness:1,azimuth:90}]);assert.equal(field(0,.5)[0],1);assert.ok(Math.abs(field(1,.5)[0]-new THREE.Color().setRGB(.745,.745,.745,THREE.SRGBColorSpace).r)<1e-6);
 const m=model(),d=createDarkness();m.material.color.set('white');d.update(m,[source,light]);const a=m.material.map.image.data;for(let i=0;i<a.length;i+=4){assert.equal(a[i],a[i+1]);assert.equal(a[i],a[i+2]);}d.dispose();
});
test('GLB conversion preserves visible colour and does not change render textures',()=>{
 const m=model(),d=createDarkness();d.update(m,[source,light]);const original=m.material.map,t=exportGradientTexture(original);assert.equal(t.type,THREE.UnsignedByteType);assert.equal(t.colorSpace,THREE.SRGBColorSpace);
 for(let i=0;i<t.image.data.length;i+=4){assert.ok(t.image.data[i]>20&&t.image.data[i]<100);assert.equal(t.image.data[i],t.image.data[i+1]);assert.equal(t.image.data[i+3],255);}
 const exported=modelForGLTF(m);assert.notEqual(exported.model.material,m.material);assert.notEqual(exported.model.material.map,original);assert.equal(m.material.map,original);exported.dispose();t.dispose();d.dispose();
});
test('one darkness source can shade enamel strongly and metal lightly',()=>{
 const enamelMesh=model(),rim=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshPhysicalMaterial({color:'#888888'}));rim.userData.role='rim';
 const group=new THREE.Group();group.add(enamelMesh,rim);const d=createDarkness();
 d.update(group,[{...source,power:1,surfaceInfluence:1,contourInfluence:0}],undefined,{metalShadeGain:2.2});
 const enamelData=enamelMesh.material.map.image.data,metalData=rim.material.map.image.data;let enamelMin=1,metalMin=1;
 for(let i=0;i<enamelData.length;i+=4){enamelMin=Math.min(enamelMin,THREE.DataUtils.fromHalfFloat(enamelData[i]));metalMin=Math.min(metalMin,THREE.DataUtils.fromHalfFloat(metalData[i]));}
 assert.ok(metalMin>.99,'zero contour influence leaves metal unshaded');assert.ok(enamelMin<.3,'surface keeps the full darkness');d.dispose();
});
