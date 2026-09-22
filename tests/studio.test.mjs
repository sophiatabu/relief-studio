import test from 'node:test';
import assert from 'node:assert/strict';
import {STUDIO,migrateAppearance,migrateColourBalance} from '../src/studio.js';
import {CONTOUR_DEFAULTS} from '../src/contour-settings.js';
test('robot-hand recipe is the single source for every default setting',()=>{
 assert.equal(STUDIO.name,'По умолчанию');
 assert.equal(STUDIO.version,'robot-reference-v3');
 assert.equal(STUDIO.exposure,1.05);
 assert.equal(STUDIO.appearance.enamelSaturation,1.25);
 assert.equal(STUDIO.appearance.enamelBrightness,1.15);
 assert.equal(STUDIO.sources.find(source=>source.kind==='dark').power,.27);
 assert.equal(STUDIO.sources.find(source=>source.kind==='dark').surfaceInfluence,1);
 assert.equal(STUDIO.sources.find(source=>source.kind==='dark').contourInfluence,.18);
 assert.equal(CONTOUR_DEFAULTS,STUDIO.contour);
 const old={profile:'soft-enamel-v3',fill:.2,exposure:.8,sources:[{kind:'dark',power:.11}]};
 assert.deepEqual(migrateColourBalance(old),{...old,profile:STUDIO.version});
});
test('the new recipe updates untouched defaults but retains custom lighting',()=>{
 const source={kind:'dark',power:.22,softness:3,azimuth:-135,distance:1.8,enabled:true};
 const saved={profile:'soft-enamel-v1',fill:.4,exposure:1.1,sources:[source,{...source,power:.1,azimuth:20}]};
 const migrated=migrateColourBalance(saved);
 assert.equal(migrated.sources[0].azimuth,180);assert.equal(migrated.sources[0].power,.26);
 assert.deepEqual(migrated.sources[1],saved.sources[1]);assert.equal(migrated.fill,.4);assert.equal(migrated.exposure,1.1);
 assert.equal(saved.sources[0].power,.22);assert.deepEqual(migrateColourBalance(migrated),migrated);
});
test('only the complete previous default appearance is upgraded',()=>{
 const previous={height:9,bevel:1.5,dome:1,roughness:.44,gloss:.45,rimHighlight:.7,rimHighlightWidth:.35,metalShadeGain:1.8};
 assert.deepEqual(migrateAppearance(previous),STUDIO.appearance);
 const custom={...previous,dome:.3};assert.deepEqual(migrateAppearance(custom),custom);
 assert.equal(migrateAppearance(null),null);
});
