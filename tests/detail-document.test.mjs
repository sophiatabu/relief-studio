import test from 'node:test';
import assert from 'node:assert/strict';
import C from 'clipper-lib';
import {compileDetailAssignments,normalizeAssignments} from '../src/detail-document.js';
const box=(a,b,c,d)=>[[{X:a,Y:b},{X:c,Y:b},{X:c,Y:d},{X:a,Y:d}]];
const asset={editablePaints:[{id:'base',paint:'fill',role:'enamel',color:'#ffffff',loops:box(0,0,100,100)},{id:'cover',paint:'fill',role:'enamel',color:'#ffffff',loops:box(50,0,100,100)}]};
const area=r=>Math.abs(r.loops.reduce((sum,l)=>sum+C.Clipper.Area(l),0));
test('hiding cover restores geometry behind it without changing original document',()=>{
 assert.equal(area(compileDetailAssignments(asset).regions[0]),5000);
 const hidden=compileDetailAssignments(asset,{cover:{role:'hidden'}});
 assert.equal(hidden.regions.length,1);assert.equal(area(hidden.regions[0]),10000);assert.equal(asset.editablePaints.length,2);
});
test('role and pigment remain independent; assignments survive JSON roundtrip',()=>{
 const result=compileDetailAssignments(asset,{base:{role:'rim',color:'#8eff59'}});
 assert.equal(result.regions[0].role,'rim');assert.equal(result.regions[0].overrideColor,'#8eff59');
 assert.deepEqual(compileDetailAssignments(asset,JSON.parse(JSON.stringify(result.detailAssignments))).regions,result.regions);
});
test('unknown IDs cannot mutate document; all-hidden edits are rejected',()=>{
 assert.deepEqual(normalizeAssignments(asset.editablePaints,{unknown:{role:'hidden'}}),{});
 assert.throws(()=>compileDetailAssignments(asset,{base:{role:'hidden'},cover:{role:'hidden'}}),/видимую/);
});

test('cutout removes occluded material without becoming a mesh or revealing strokes',()=>{
 const edited=compileDetailAssignments(asset,{cover:{role:'cutout'}});
 assert.equal(edited.regions.length,1);assert.equal(area(edited.regions[0]),5000);
});
