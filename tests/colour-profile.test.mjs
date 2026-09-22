import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {cleanEnamelColour} from '../src/enamel-colour.js';import {STUDIO,migrateColourBalance} from '../src/studio.js';
test('brightens turquoise without clipping or shifting its hue',()=>{
 const c=new THREE.Color('#33d3cf'),r=cleanEnamelColour(c),before=c.getHSL({},THREE.SRGBColorSpace),after=r.getHSL({},THREE.SRGBColorSpace);
 assert.ok(after.l>before.l);assert.ok(Math.abs(after.h-before.h)<1e-6);
 assert.ok(Math.max(...r.toArray())<=1);assert.equal(c.getHexString(),'33d3cf');
});
test('neutrals and already full-intensity primary pigments stay unchanged',()=>{
 for(const hex of ['#ffffff','#000000','#888888','#ff0000','#ffff1d'])assert.ok(cleanEnamelColour(new THREE.Color(hex)).toArray().every((v,i)=>Math.abs(v-new THREE.Color(hex).toArray()[i])<1e-6));
});
test('surface vividness deepens chroma without changing the brightest channel',()=>{
 const source=new THREE.Color('#33d3cf'),normal=cleanEnamelColour(source,1),vivid=cleanEnamelColour(source,1.25);
 const a=normal.getRGB({},THREE.SRGBColorSpace),b=vivid.getRGB({},THREE.SRGBColorSpace);
 assert.ok(b.r<a.r);assert.ok(Math.abs(b.g-a.g)<1e-6);assert.ok(b.b<a.b);
});
test('migrate old defaults once, retain positions and future edits',()=>{
 const old={sources:[{kind:'light',power:1,azimuth:12},{kind:'dark',power:.7,azimuth:-101}],fill:.45,exposure:1},s=migrateColourBalance(old);
 assert.equal(s.sources[1].azimuth,-101);assert.equal(s.sources[1].power,.3);assert.equal(s.profile,STUDIO.version);assert.equal(old.sources[1].power,.7);
 s.sources[1].power=.6;s.fill=.2;assert.deepEqual(migrateColourBalance(s),s);
});

test('meditation blue and cyan gain saturation even with an already full blue channel',()=>{
 for(const hex of ['#4384ed','#83d9ff']){const source=new THREE.Color(hex),result=cleanEnamelColour(source),a=source.getHSL({},THREE.SRGBColorSpace),b=result.getHSL({},THREE.SRGBColorSpace);const ar=source.getRGB({},THREE.SRGBColorSpace),br=result.getRGB({},THREE.SRGBColorSpace);assert.ok((br.b-br.r)/br.b>(ar.b-ar.r)/ar.b);assert.ok(br.b>=ar.b);assert.ok(Math.abs(a.h-b.h)<1e-6);assert.ok(Math.max(...result.toArray())<=1+1e-6);}
});

test('vivid defaults only replace untouched studio values',()=>{
 const custom={profile:'clean-colour-v1',fill:.2,exposure:.9,sources:[{kind:'dark',power:.1,azimuth:15}]},updated=migrateColourBalance(custom);assert.equal(updated.fill,.2);assert.equal(updated.exposure,.9);assert.deepEqual(updated.sources,custom.sources);
 const defaults=migrateColourBalance({...custom,fill:.65,exposure:1.15});assert.equal(defaults.fill,STUDIO.fill);assert.equal(defaults.exposure,STUDIO.exposure);
});
