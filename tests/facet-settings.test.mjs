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
test('range expansion keeps the original defaults and repairs the temporary altered preset',()=>{
 assert.equal(CONTOUR_DEFAULTS.facetWidth,.72);assert.equal(CONTOUR_DEFAULTS.highlightWidth,.3);
 const altered={...CONTOUR_DEFAULTS,facetWidth:.42,highlightWidth:.55};
 assert.deepEqual(migrateContourDefaults(altered),CONTOUR_DEFAULTS);
 assert.equal(migrateContourDefaults({...altered,facetStrength:.4}).facetWidth,.42);
});
