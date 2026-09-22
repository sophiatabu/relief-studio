import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import C from 'clipper-lib';import {redundantRims} from '../src/rim-dedup.js';
const square=(x=0)=>[{X:x,Y:0},{X:x+100000,Y:0},{X:x+100000,Y:100000},{X:x,Y:100000}];
const paint=(x,filled,closed=true)=>{const footprint=[square(x)],offset=new C.ClipperOffset(),loops=[];offset.AddPath(footprint[0],C.JoinType.jtMiter,C.EndType.etClosedLine);offset.Execute(loops,3000);return {role:'rim',filled,closed,footprint,loops,width:6,color:new THREE.Color('#888888')};};
test('a filled outline owns overlapping, almost identical closed stroke copies',()=>{const owner=paint(0,true),copy=paint(200,false);assert.deepEqual([...redundantRims([owner,copy])],[copy]);});
test('distinct outlines and open line details survive',()=>{const owner=paint(0,true),separate=paint(20000,false),open=paint(0,false,false);assert.equal(redundantRims([owner,separate,open]).size,0);});
