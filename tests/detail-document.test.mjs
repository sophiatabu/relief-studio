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

test('gradient role changes retain pigment and effects survive project roundtrip',()=>{
 const a={...asset,hasAppearance:true,effects:[{id:'shadow'}],editablePaints:[{...asset.editablePaints[0],gradient:{id:'g',type:'radialGradient'}}]};
 const edited=compileDetailAssignments(a,{base:{role:'rim'},'effect:shadow':{enabled:false}});
 assert.equal(edited.regions[0].gradient.id,'g');assert.equal(edited.regions[0].overrideColor,undefined);assert.equal(edited.regions[0].svgAppearance,true);
 const saved=JSON.parse(JSON.stringify(edited));assert.deepEqual(compileDetailAssignments(saved,saved.detailAssignments).regions,edited.regions);
 assert.equal(saved.detailAssignments['effect:shadow'].enabled,false);
 const solid=compileDetailAssignments(a,{base:{color:'#ffffff'}});assert.equal(solid.regions[0].overrideColor,'#ffffff');
 assert.deepEqual(normalizeAssignments(a.editablePaints,{'effect:unknown':{enabled:false}},a.effects),{});
});
