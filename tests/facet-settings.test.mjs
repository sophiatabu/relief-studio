import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeContour,migrateContourDefaults,CONTOUR_DEFAULTS} from '../src/contour-settings.js';
test('new defaults include the facet; old saved recipes retain their previous appearance',()=>{
 assert.equal(normalizeContour(null).facet,true);
 assert.equal(normalizeContour({enabled:true,highlight:true}).facet,false);
 assert.equal(normalizeContour(null,true).facet,false);
});
test('facet controls survive a recipe round trip without changing independent shadow direction',()=>{
 const original=normalizeContour({facet:true,facetWidth:.6,facetStrength:.4,highlightAngle:45,shadowAngle:225});
 assert.deepEqual(normalizeContour(JSON.parse(JSON.stringify(original))),original);
 assert.equal(normalizeContour({...original,facetWidth:5}).facetWidth,.95);
 assert.equal(normalizeContour({...original,facetStrength:-1}).facetStrength,0);
 assert.equal(normalizeContour({...original,highlightAngle:90}).shadowAngle,225);
});
test('facet can become very narrow and highlight can become broader',()=>{
 assert.equal(normalizeContour({facetWidth:0}).facetWidth,.03);
 assert.equal(normalizeContour({highlightWidth:5}).highlightWidth,1.5);
});
test('requested contour recipe is the default and the temporary altered preset migrates to it',()=>{
 assert.equal(CONTOUR_DEFAULTS.highlightAngle,32);assert.equal(CONTOUR_DEFAULTS.facetWidth,.95);assert.equal(CONTOUR_DEFAULTS.highlightWidth,1.5);
 const altered={enabled:true,facet:true,facetWidth:.42,facetStrength:.58,highlight:true,highlightAngle:0,highlightWidth:.55,highlightStrength:.72,highlightSoftness:.42,shadow:true,shadowAngle:225,shadowOffset:.8,shadowSoftness:1.35,shadowStrength:.58};
 assert.deepEqual(migrateContourDefaults(altered),CONTOUR_DEFAULTS);
 assert.equal(migrateContourDefaults({...altered,facetStrength:.4}).facetWidth,.42);
});
