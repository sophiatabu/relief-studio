import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeMetalRegions} from '../src/geometry.js';

const box=(x0,y0,x1,y1)=>[[{X:x0,Y:y0},{X:x1,Y:y0},{X:x1,Y:y1},{X:x0,Y:y1}]];

test('touching stroke and filled metal become one render region without an internal seam',()=>{
 const regions=[
  {id:'surface',role:'enamel',loops:box(0,0,10,10)},
  {id:'svg-rim',role:'rim',loops:box(0,0,4,10),renderLoops:box(0,0,4,10)},
  {id:'svg-expanded-rim',role:'rim',loops:box(4,0,8,10),renderLoops:box(4,0,8,10)},
 ];
 const merged=mergeMetalRegions(regions),metal=merged.find(r=>r.role==='rim');
 assert.equal(merged.filter(r=>r.role==='rim').length,1);
 assert.deepEqual(metal.mergedRegionIds,['svg-rim','svg-expanded-rim']);
 assert.equal(metal.renderLoops.length,1);
});
