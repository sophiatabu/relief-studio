import test from 'node:test';
import assert from 'node:assert/strict';
import C from 'clipper-lib';
import {widenRim} from '../src/rim-width.js';
const rect=(x,y,w,h)=>[{X:x,Y:y},{X:x+w,Y:y},{X:x+w,Y:y+h},{X:x,Y:y+h}];
test('straight border expands equally to 125% of source width',()=>{
 const loops=[rect(0,0,5000,40000)],out=widenRim(loops,5),p=out.flat();
 assert.equal(Math.max(...p.map(p=>p.X))-Math.min(...p.map(p=>p.X)),6250);
 assert.equal(Math.min(...p.map(p=>p.X)),-625);
});
test('narrow holes remain open and original geometry stays untouched',()=>{
 const loops=[rect(0,0,10000,10000),rect(4800,3000,400,4000).reverse()],copy=structuredClone(loops);
 const out=widenRim(loops,5);assert.deepEqual(loops,copy);
 assert.equal(out.filter(p=>!C.Clipper.Orientation(p)).length,1);
 assert.equal(out.filter(p=>C.Clipper.Orientation(p)).length,1);
 assert.deepEqual(widenRim(loops,5,0),loops);
});
test('nearby strokes join smoothly without cancelling width gain everywhere',()=>{
 const out=widenRim([rect(0,0,5000,40000),rect(5500,0,5000,40000)],5);
 assert.equal(out.length,1);
 const points=out.flat();assert.equal(Math.min(...points.map(p=>p.X)),-625);
 assert.equal(Math.max(...points.map(p=>p.X)),11125);
});
